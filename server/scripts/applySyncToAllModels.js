import fs from "fs/promises";
import path from "path";

/**
 * Script to add sync middleware import to all model files
 * This ensures middleware is applied BEFORE model creation
 */

const MODELS_DIR = "./models";

const SYNC_IMPORT = `// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(SCHEMA_NAME);

`;

async function applyToAllModels() {
    console.log("🔄 Adding sync middleware to all models...");
    console.log("=".repeat(60));

    try {
        // Get all model files
        const files = await fs.readdir(MODELS_DIR);
        const modelFiles = files.filter((f) => f.endsWith(".js"));

        console.log(`\n📁 Found ${modelFiles.length} model files\n`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const file of modelFiles) {
            const filePath = path.join(MODELS_DIR, file);
            let content = await fs.readFile(filePath, "utf8");

            // Skip if already has sync middleware
            if (content.includes("applySyncMiddleware")) {
                console.log(`⏭️  ${file} - Already has sync middleware`);
                skippedCount++;
                continue;
            }

            // Find the export line
            const exportMatch = content.match(
                /export default mongoose\.model\("(\w+)", (\w+)\);/
            );

            if (!exportMatch) {
                console.log(`⚠️  ${file} - No export found`);
                skippedCount++;
                continue;
            }

            const [fullMatch, modelName, schemaName] = exportMatch;

            // Create the sync import with correct schema name
            const syncCode = SYNC_IMPORT.replace("SCHEMA_NAME", schemaName);

            // Replace the export line
            const newExport = syncCode + fullMatch;
            content = content.replace(fullMatch, newExport);

            // Write back
            await fs.writeFile(filePath, content, "utf8");

            console.log(`✅ ${file} - Added sync middleware`);
            updatedCount++;
        }

        console.log("\n" + "=".repeat(60));
        console.log(`✅ Updated: ${updatedCount} files`);
        console.log(`⏭️  Skipped: ${skippedCount} files`);
        console.log("=".repeat(60));
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

applyToAllModels();
