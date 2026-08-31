import mongoose from "mongoose";
import Table from "../models/Table.js";
import Bill from "../models/Bill.js";
import dotenv from "dotenv";

// Load env
try {
    dotenv.config();
} catch (e) {}

async function fixTableStatuses() {
    console.log("🔧 Starting table status fix...\n");

    const tables = await Table.find({}).select("_id number status organization").lean();
    console.log(`📋 Found ${tables.length} tables to check\n`);

    let fixed = 0;
    let occupied = 0;
    let empty = 0;
    let errors = [];
    const bulkOps = [];
    const details = [];

    for (const table of tables) {
        try {
            // Efficient: use exists instead of fetching all bills
            const hasUnpaid = await Bill.exists({
                table: table._id,
                status: { $in: ["draft", "partial", "overdue"] },
                organization: table.organization,
            });

            const newStatus = hasUnpaid ? "occupied" : "empty";

            if (newStatus === "occupied") occupied++;
            else empty++;

            if (table.status !== newStatus) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: table._id },
                        update: { $set: { status: newStatus } },
                    },
                });
                details.push({ table, newStatus, hasUnpaid: !!hasUnpaid });
            } else {
                console.log(
                    `✓ Table ${table.number} (${table._id}) already ${newStatus} (${hasUnpaid ? 'has unpaid' : 'no unpaid'})`
                );
            }
        } catch (err) {
            errors.push({ table: table.number || table._id, error: err.message });
            console.error(`❌ Table ${table.number || table._id}: ${err.message}`);
        }
    }

    // Batch updates
    if (bulkOps.length > 0) {
        try {
            const result = await Table.bulkWrite(bulkOps);
            fixed = result.modifiedCount ?? bulkOps.length;
            for (const d of details) {
                console.log(
                    `✅ Table ${d.table.number} (${d.table._id}) : ${d.table.status} -> ${d.newStatus} (${d.hasUnpaid ? 'has unpaid' : 'no unpaid'})`
                );
            }
        } catch (bulkErr) {
            console.error("❌ Bulk update failed:", bulkErr.message);
            errors.push({ table: "bulkWrite", error: bulkErr.message });
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total tables: ${tables.length}`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Occupied: ${occupied}`);
    console.log(`   Empty: ${empty}`);
    if (errors.length > 0) {
        console.log(`   Errors: ${errors.length}`);
        for (const e of errors) console.log(`   - ${e.table}: ${e.error}`);
    }
    console.log("\n✅ Done!");
    return { total: tables.length, fixed, occupied, empty, errors, details };
}

// Allow running as standalone script
const isDirectRun = process.argv[1] && process.argv[1].includes("fixTableStatuses");
if (isDirectRun || process.argv.includes("--run")) {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/bomba";
    mongoose
        .connect(uri)
        .then(async () => {
            console.log(`📦 Connected to MongoDB: ${uri}\n`);
            await fixTableStatuses();
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ MongoDB connection error:", err);
            process.exit(1);
        });
}

export default fixTableStatuses;
