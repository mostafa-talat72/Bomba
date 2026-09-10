import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readVersionFromPackage(pkgPath) {
    try {
        if (!fs.existsSync(pkgPath)) return null;
        const raw = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw);
        if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
            return pkg.version.trim();
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * App version, resolved in order:
 * 1. process.env.APP_VERSION
 * 2. server/package.json "version"
 * 3. project root package.json "version" (../../package.json)
 * 4. fallback "0.0.0"
 */
export function getAppVersion() {
    if (process.env.APP_VERSION && String(process.env.APP_VERSION).trim()) {
        return String(process.env.APP_VERSION).trim();
    }
    const serverPkg = readVersionFromPackage(path.resolve(__dirname, "../package.json"));
    if (serverPkg) return serverPkg;
    const rootPkg = readVersionFromPackage(path.resolve(__dirname, "../../package.json"));
    if (rootPkg) return rootPkg;
    return "0.0.0";
}

/**
 * Directory where built installers (*.exe) are dropped.
 * Defaults to <project>/desktop/release (electron-builder output dir).
 * Nothing is created here — the directory is only read at request time.
 */
export const UPDATE_DIR =
    process.env.UPDATE_DIST_DIR || path.resolve(__dirname, "../../desktop/release");
