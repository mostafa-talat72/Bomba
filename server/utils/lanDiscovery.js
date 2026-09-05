/**
 * Simple LAN peer discovery (mesh, offline-first).
 *
 * - Uses built-in `dgram` UDP only (no new dependencies).
 * - Advertises `bomba-server` on UDP multicast 224.0.0.1:41234 every 5s:
 *     { service, type, deviceId, port, name, ip, ts }
 * - Listens for peers, keeps `peers: Map<deviceId, { ip, port, name, lastSeen }>`.
 * - Prunes peers not seen for > 15s.
 *
 * NOTE: This is intentionally separate from `services/sync/lanDiscovery.js`
 * (primary/secondary election + socket.io). This mesh layer needs no Atlas,
 * no replicaSet and no election — every device keeps a full Local DB and
 * pushes writes directly to peers over HTTP (see `lanPeerSync.js`).
 * Messages are tagged with `service: 'bomba-server'` so the two discovery
 * mechanisms can share UDP port 41234 without interfering.
 */
import dgram from "dgram";
import os from "os";
import { EventEmitter } from "events";
import { getDeviceId } from "./deviceIdentity.js";
import Logger from "../middleware/logger.js";

export const LAN_SERVICE = "bomba-server";
export const LAN_MULTICAST = "224.0.0.1";
export const LAN_DISCOVERY_PORT = parseInt(process.env.LAN_DISCOVERY_PORT || "41234", 10);
export const LAN_ANNOUNCE_INTERVAL_MS = 5000;
export const LAN_PEER_TIMEOUT_MS = 15000;

function getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "127.0.0.1";
}

function getBroadcastAddresses() {
    const addrs = new Set([LAN_MULTICAST, "255.255.255.255"]);
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) {
                const parts = String(iface.address).split(".").map(Number);
                const mask = String(iface.netmask || "255.255.255.0").split(".").map(Number);
                if (parts.length === 4 && mask.length === 4) {
                    addrs.add(parts.map((p, i) => p | (~mask[i] & 255)).join("."));
                }
            }
        }
    }
    return [...addrs];
}

class LanMeshDiscovery extends EventEmitter {
    constructor() {
        super();
        this.deviceId = getDeviceId();
        this.name = process.env.LAN_DEVICE_NAME || os.hostname();
        this.httpPort = parseInt(process.env.PORT || "5000", 10);
        this.discoveryPort = LAN_DISCOVERY_PORT;
        this.localIP = getLocalIP();
        this.peers = new Map(); // deviceId -> { deviceId, ip, port, name, lastSeen }
        this.socket = null;
        this.announceTimer = null;
        this.pruneTimer = null;
        this.isRunning = false;
    }

    helloPayload() {
        return {
            service: LAN_SERVICE,
            type: "BOMBA_HELLO",
            deviceId: this.deviceId,
            port: this.httpPort,
            name: this.name,
            ip: getLocalIP(),
            ts: Date.now(),
        };
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.deviceId = getDeviceId();
        this.localIP = getLocalIP();

        this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        this.socket.on("error", (err) => {
            Logger.warn(`[LanMesh] socket error: ${err.message}`);
        });
        this.socket.on("message", (msg, rinfo) => this.handleMessage(msg, rinfo));

        await new Promise((resolve) => {
            this.socket.bind(this.discoveryPort, () => {
                try {
                    this.socket.setBroadcast(true);
                    try { this.socket.setMulticastTTL(128); } catch {}
                    try { this.socket.addMembership(LAN_MULTICAST); } catch {}
                } catch {}
                resolve();
            });
            this.socket.once("error", () => resolve());
        });

        // Announce immediately, then every 5s
        this.announce();
        this.announceTimer = setInterval(() => this.announce(), LAN_ANNOUNCE_INTERVAL_MS);
        if (this.announceTimer.unref) this.announceTimer.unref();

        // Prune peers older than 15s
        this.pruneTimer = setInterval(() => this.prune(), 5000);
        if (this.pruneTimer.unref) this.pruneTimer.unref();

        Logger.info(
            `[LanMesh] discovery started deviceId=${this.deviceId} name=${this.name} ` +
            `http=${this.localIP}:${this.httpPort} udp=${LAN_MULTICAST}:${this.discoveryPort}`
        );
    }

    announce() {
        if (!this.socket) return;
        const msg = Buffer.from(JSON.stringify(this.helloPayload()));
        for (const addr of getBroadcastAddresses()) {
            try {
                this.socket.send(msg, 0, msg.length, this.discoveryPort, addr, () => {});
            } catch {}
        }
    }

    handleMessage(msg, rinfo) {
        let data;
        try {
            data = JSON.parse(msg.toString());
        } catch {
            return;
        }
        if (!data || data.service !== LAN_SERVICE) return; // ignore election-discovery + foreign traffic
        if (!data.deviceId || data.deviceId === this.deviceId) return; // ignore self

        // Prefer the packet's source address (rinfo.address): it is the actual
        // reachable interface (e.g. Ethernet APIPA 169.254.x.x on a direct
        // cable), while the advertised data.ip may be a different NIC (WiFi).
        const reachableIp = rinfo.address || data.ip;
        const isNew = !this.peers.has(data.deviceId);
        this.peers.set(data.deviceId, {
            deviceId: data.deviceId,
            ip: reachableIp,
            port: data.port || 5000,
            name: data.name || "unknown",
            lastSeen: Date.now(),
        });
        if (isNew) {
            Logger.info(`[LanMesh] peer up: ${data.name || data.deviceId} @ ${reachableIp}:${data.port || 5000}`);
            this.emit("peer-up", this.peers.get(data.deviceId));
        }
    }

    prune() {
        const now = Date.now();
        for (const [id, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > LAN_PEER_TIMEOUT_MS) {
                this.peers.delete(id);
                Logger.info(`[LanMesh] peer down: ${peer.name} (${id})`);
                this.emit("peer-down", peer);
            }
        }
    }

    getPeers() {
        return [...this.peers.values()];
    }

    getStatus() {
        return {
            service: LAN_SERVICE,
            deviceId: this.deviceId,
            name: this.name,
            localIP: getLocalIP(),
            port: this.httpPort,
            peers: this.getPeers(),
        };
    }

    async stop() {
        this.isRunning = false;
        if (this.announceTimer) { clearInterval(this.announceTimer); this.announceTimer = null; }
        if (this.pruneTimer) { clearInterval(this.pruneTimer); this.pruneTimer = null; }
        if (this.socket) {
            try { this.socket.close(); } catch {}
            this.socket = null;
        }
        Logger.info("[LanMesh] discovery stopped");
    }
}

const lanMeshDiscovery = new LanMeshDiscovery();
export default lanMeshDiscovery;
