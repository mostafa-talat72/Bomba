/**
 * Fix corrupted BSON types in the database (stringified Dates/ObjectIds/Numbers,
 * mangled Binary ids, duplicate string-_id docs).
 *
 * This is the same self-heal that runs automatically on every server boot,
 * exposed as a manual command:
 *
 *   npm run fix:types              → scan + fix (local + Atlas)
 *   npm run fix:types -- --dry-run → report only, change nothing
 *
 * Env overrides: SKIP_TYPE_AUDIT=true, TYPE_AUDIT_FIX=false
 */
process.env.ENABLE_LOGGING = "true";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) process.env.TYPE_AUDIT_FIX = "false";

await import("../config/env-loader.js");
await import("../config/applySync.js"); // registers all models (no DB needed)
const { default: connectDB } = await import("../config/database.js");
const { runStartupTypeAudit } = await import("../utils/startupTypeAudit.js");

console.log(`🔍 fixBsonTypes starting (${dryRun ? "DRY-RUN" : "FIX MODE"})...`);
try {
    await connectDB();
} catch (err) {
    console.error("❌ Could not connect to local MongoDB:", err.message);
    process.exit(1);
}

const stats = await runStartupTypeAudit({ fix: !dryRun });

console.log("\n========== SUMMARY ==========");
console.log(`Collections scanned : ${new Set(stats.collections.map((c) => c.collection)).size}`);
console.log(`Documents fixed     : ${stats.totalFixedDocs}`);
console.log(`Fields fixed        : ${stats.totalFixedFields}`);
for (const c of stats.collections) {
    if (c.fixedDocs > 0 || c.resolvedIds > 0) {
        console.log(`  - ${c.collection}${c.phase && c.phase !== "all" ? ` [${c.phase}]` : ""}: ${c.fixedDocs} docs, ${c.fixedFields} fields`);
    }
}
console.log(dryRun ? "(dry-run: nothing was changed)" : "Done.");
const mongoose = (await import("mongoose")).default;
await mongoose.disconnect().catch(() => {});
process.exit(0);
