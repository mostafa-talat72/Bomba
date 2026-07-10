// Script to fix orders with bill=null by creating/finding bills and linking them
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";
import Table from "../models/Table.js";

async function fixOrphanOrders() {
    const dateStr = "260710";
    const prefix = `ORD-${dateStr}-`;

    console.log(`🔍 Finding orders with ${prefix} and bill = null...`);

    const orphanOrders = await Order.find({
        orderNumber: { $regex: `^${prefix}` },
        bill: null,
    }).sort({ table: 1, createdAt: 1 });

    if (orphanOrders.length === 0) {
        console.log("✅ No orphan orders found.");
        return;
    }

    console.log(`📋 Found ${orphanOrders.length} orphan orders.`);

    // Group by table
    const ordersByTable = {};
    for (const order of orphanOrders) {
        if (!order.table) {
            console.log(`⚠️ Order ${order.orderNumber} has no table, skipping.`);
            continue;
        }
        const tableId = order.table.toString();
        if (!ordersByTable[tableId]) ordersByTable[tableId] = [];
        ordersByTable[tableId].push(order);
    }

    for (const [tableId, orders] of Object.entries(ordersByTable)) {
        console.log(`\n📌 Processing table ${tableId} (${orders.length} orders):`);

        // Find existing draft/partial/overdue bill for this table
        let bill = await Bill.findOne({
            table: tableId,
            status: { $in: ["draft", "partial", "overdue"] },
        }).sort({ createdAt: -1 });

        if (bill) {
            console.log(`  ✅ Found existing bill ${bill.billNumber}`);
        } else {
            // Create new bill
            const tableDoc = await Table.findById(tableId);
            const tableNumber = tableDoc ? tableDoc.number : tableId;

            bill = await Bill.create({
                table: tableId,
                customerName: `طاولة ${tableNumber}`,
                orders: [],
                sessions: [],
                subtotal: 0,
                total: 0,
                discount: 0,
                tax: 0,
                paid: 0,
                remaining: 0,
                status: "draft",
                paymentMethod: "cash",
                billType: "cafe",
                createdBy: orders[0].createdBy,
                organization: orders[0].organization,
            });
            console.log(`  ✅ Created new bill ${bill.billNumber}`);
        }

        // Link orders to bill
        for (const order of orders) {
            order.bill = bill._id;
            await order.save();
            console.log(`  🔗 Linked ${order.orderNumber} -> ${bill.billNumber}`);

            // Add order to bill's orders array if not already there
            const orderExists = bill.orders.some(
                (o) => o.toString() === order._id.toString()
            );
            if (!orderExists) {
                bill.orders.push(order._id);
            }
        }

        bill.markModified("orders");
        await bill.save();
        console.log(`  💾 Saved bill ${bill.billNumber} with ${orders.length} orders`);

        // Update table status to occupied
        await Table.findByIdAndUpdate(tableId, { status: "occupied" });
        console.log(`  🪑 Table ${tableId} marked as occupied`);
    }

    console.log("\n✅ Done! All orphan orders have been linked to bills.");
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(async () => {
        console.log("📦 Connected to MongoDB");
        await fixOrphanOrders();
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
