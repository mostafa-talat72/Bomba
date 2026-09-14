import dns from "node:dns";
import { promisify } from "node:util";

const resolveSrv = promisify(dns.resolveSrv);
const resolveTxt = promisify(dns.resolveTxt);

/**
 * Build a standard (non-SRV) Atlas connection URI from a `mongodb+srv://` one.
 *
 * Why: some ISPs/modems/DNS servers answer A-record queries fine but REFUSE
 * SRV queries (`querySrv EREFUSED`). The app then never reaches Atlas even
 * though the network is perfectly fine. This helper resolves the SRV + TXT
 * records itself (plain A/DNS lookups) and writes a `mongodb://host1:27017,
 * host2:27017,.../db?tls=true&replicaSet=...` URI that works even on those
 * networks.
 *
 * Returns null if resolution fails or the URI is not an SRV URI.
 */
export async function buildNonSrvAtlasUri(srvUri) {
    if (typeof srvUri !== "string" || !srvUri.startsWith("mongodb+srv://")) {
        return null;
    }
    try {
        const rest = srvUri.slice("mongodb+srv://".length);

        // Split credentials (everything up to the first '@') from the host part.
        const at = rest.indexOf("@");
        const credentials = at > -1 ? rest.slice(0, at + 1) : "";
        const hostAndPath = rest.slice(at > -1 ? at + 1 : 0);

        // Host is up to the first '/' (db name) or '?' (query params).
        const slashIdx = hostAndPath.indexOf("/");
        const qIdx = hostAndPath.indexOf("?");
        let baseHost;
        let suffix = "";
        if (slashIdx > -1 && (qIdx === -1 || slashIdx < qIdx)) {
            baseHost = hostAndPath.slice(0, slashIdx);
            suffix = hostAndPath.slice(slashIdx);
        } else if (qIdx > -1) {
            baseHost = hostAndPath.slice(0, qIdx);
            suffix = hostAndPath.slice(qIdx);
        } else {
            baseHost = hostAndPath;
        }

        baseHost = baseHost.replace(/\.$/, "");
        if (!baseHost) return null;

        // topologyHint/replicaSet + authSource live in the TXT record of the
        // base domain (e.g. cluster0.xxxx.mongodb.net).
        let replicaSet = "";
        let authSource = "admin";
        try {
            const rows = await resolveTxt(baseHost);
            for (const row of rows) {
                const line = Array.isArray(row) ? row.join("") : String(row);
                const rs = line.match(/replicaSet=([^&\s]+)/);
                const as = line.match(/authSource=([^&\s]+)/);
                if (rs) replicaSet = rs[1];
                if (as) authSource = as[1];
            }
        } catch {}

        const records = await resolveSrv(`_mongodb._tcp.${baseHost}`);
        if (!records || !records.length) return null;
        const hosts = records
            .map((r) => `${r.name}:${r.port || 27017}`)
            .join(",");
        if (!hosts) return null;

        // Keep any existing query params, and force the ones SRV mode implies:
        // TLS and the replica set name (without them the driver can't connect).
        const existingQuery = suffix.includes("?") ? suffix.slice(suffix.indexOf("?") + 1) : "";
        const queryParams = new URLSearchParams(existingQuery);
        queryParams.set("tls", "true");
        if (replicaSet && !queryParams.has("replicaSet")) {
            queryParams.set("replicaSet", replicaSet);
        }
        if (!queryParams.has("authSource")) {
            queryParams.set("authSource", authSource);
        }

        // Rebuild path: keep database name if present, otherwise none.
        const qInSuffix = suffix.indexOf("?");
        const dbName = qInSuffix > -1 ? suffix.slice(0, qInSuffix) : suffix;
        const qs = queryParams.toString();

        return `mongodb://${credentials}${hosts}${dbName}?${qs}`;
    } catch {
        return null;
    }
}