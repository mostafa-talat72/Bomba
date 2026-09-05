import Logger from "../middleware/logger.js";

const PLACEHOLDER_RE = /^(YOUR_|PLACEHOLDER|CHANGEME|changeme|example|test|1234|password|secret)/i;
const WEAK_JWT = new Set(["secret", "jwtsecret", "test", "development", "changeme"]);

function isPlaceholder(v) {
    if (!v || typeof v !== "string" || v.trim() === "") return true;
    const t = v.trim();
    if (WEAK_JWT.has(t.toLowerCase())) return true;
    return PLACEHOLDER_RE.test(t);
}

/**
 * Validate critical environment variables on startup.
 * - Fatal (process.exit): JWT secrets, Mongo URIs — server cannot run safely without them.
 * - Warn only: Fawry (subscriptions), Email (verification/reports), Frontend URL.
 * Never logs secret values — only set/placeholder status.
 */
export function validateEnv() {
    const fatals = [];
    const warnings = [];

    const jwt = process.env.JWT_SECRET || "";
    const jwtRefresh = process.env.JWT_REFRESH_SECRET || "";
    if (jwt.length < 32 || isPlaceholder(jwt)) {
        fatals.push("JWT_SECRET is missing, too short (<32 chars), or a placeholder — auth tokens would be forgeable.");
    }
    if (jwtRefresh.length < 32 || isPlaceholder(jwtRefresh)) {
        fatals.push("JWT_REFRESH_SECRET is missing, too short (<32 chars), or a placeholder.");
    }
    if (jwt && jwtRefresh && jwt === jwtRefresh) {
        fatals.push("JWT_SECRET and JWT_REFRESH_SECRET must be different values.");
    }

    const hasMongo =
        process.env.MONGODB_LOCAL_URI || process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    if (!hasMongo) {
        fatals.push("No MongoDB URI set (need MONGODB_LOCAL_URI and/or MONGODB_ATLAS_URI).");
    }

    if (isPlaceholder(process.env.FAWRY_MERCHANT_CODE) || isPlaceholder(process.env.FAWRY_SECURE_KEY)) {
        warnings.push("Fawry keys are placeholders — subscription payments are DISABLED until real FAWRY_MERCHANT_CODE / FAWRY_SECURE_KEY are set.");
    }
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USER_ENC;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASS_ENC;
    if (!emailUser || !emailPass) {
        warnings.push("Email credentials missing — verification emails and email reports are DISABLED.");
    }
    if (!process.env.FRONTEND_URL) {
        warnings.push("FRONTEND_URL not set — QR links fall back to localhost.");
    }

    for (const w of warnings) {
        Logger.warn(`⚠️ ENV: ${w}`);
    }

    if (fatals.length > 0) {
        Logger.error("❌ ENV validation failed — refusing to start:");
        fatals.forEach((f) => Logger.error(`   - ${f}`));
        Logger.error("Fix server/.env (see .env.example) and restart.");
        process.exit(1);
    }

    Logger.info("✅ ENV validation passed (secrets set, no placeholders on critical keys)");
}

export default { validateEnv };
