/**
 * fix-data-types.js
 * Manual, standalone data-type healer for the whole database.
 *
 * Walks every registered collection and converts corrupted BSON types back
 * WITHOUT changing any content:
 *   - numeric strings ("250") in Number fields  -> Number
 *   - ISO date strings in Date fields           -> Date
 *   - 24-hex strings in ObjectId fields         -> ObjectId
 *   - 12-byte Binary in ObjectId fields         -> ObjectId
 *   - string/Binary _id docs                    -> re-inserted with ObjectId _id
 *     (exact duplicates resolved last-write-wins)
 *
 * Anything unparseable is left untouched and reported as skipped.
 *
 * Usage (from server/ folder):
 *   node scripts/fix-data-types.js [--uri mongodb://...] [--dry-run]
 *
 * Examples:
 *   node scripts/fix-data-types.js
 *   node scripts/fix-data-types.js --dry-run
 *   node scripts/fix-data-types.js --uri "mongodb://192.168.1.50:27017/bomba"
 */

// Force visible output (Logger is silent unless ENABLE_LOGGING=true).
// NOTE: dynamic imports below — static imports would evaluate BEFORE this
// assignment (ESM hoisting) and Logger would stay silent.
process.env.ENABLE_LOGGING = "true";

// Load server/.env so MONGODB_* / SKIP_* flags behave like the app.
// Never exits: falls back to defaults when the file is absent.
try {
    const dotenv = (await import("dotenv")).default;
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: join(here, "..", ".env") });
} catch {
    // dotenv not installed — defaults below still work for local Mongo
}

const mongoose = (await import("mongoose")).default;
await import("../config/applySync.js"); // registers all models (no side effects on its own)
const { runStartupTypeAudit } = await import("../utils/startupTypeAudit.js");

function parseArgs() {
    const args = process.argv.slice(2);
    let uri = process.env.MONGODB_LOCAL_URI || "mongodb://localhost:27017/bomba";
    let dryRun = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--uri" && args[i + 1]) {
            uri = args[i + 1];
            i++;
        } else if (args[i] === "--dry-run") {
            dryRun = true;
        } else if (args[i] === "--help" || args[i] === "-h") {
            console.log("Usage: node scripts/fix-data-types.js [--uri <mongo-uri>] [--dry-run]");
            process.exit(0);
        }
    }
    return { uri: uri.trim(), dryRun };
}

// Never print credentials
function safeUri(uri) {
    try {
        const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
        const u = new URL(uri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
        return `${scheme}://${u.hostname}${u.pathname}`;
    } catch {
        return "(unparseable uri)";
    }
}

const { uri, dryRun } = parseArgs();
console.log(`Connecting to ${safeUri(uri)} ...`);
try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
} catch (e) {
    console.error(`❌ Cannot connect to the database (${safeUri(uri)}).`);
    console.error(`   Reason: ${e.message}`);
    console.error(`   Check that MongoDB is running, the URI is correct (--uri), and credentials/firewall allow access.`);
    process.exit(1);
}
console.log(`Connected. Mode: ${dryRun ? "DRY-RUN (report only, no writes)" : "FIX (writes enabled)"}`);

const stats = await runStartupTypeAudit({ fix: !dryRun });

console.log("\n========== SUMMARY ==========");
console.log(`Collections scanned : ${new Set(stats.collections.map((c) => c.collection)).size}`);
console.log(`Documents fixed     : ${stats.totalFixedDocs}`);
console.log(`Fields fixed        : ${stats.totalFixedFields}`);
for (const c of stats.collections) {
    if (c.fixedDocs > 0 || (c.resolvedIds || 0) > 0) {
        console.log(`  - ${c.collection}${c.phase && c.phase !== "all" ? ` [${c.phase}]` : ""}: ${c.fixedDocs} docs, ${c.fixedFields} fields`);
    }
}
console.log("==============================");

await mongoose.disconnect();
process.exit(0);
