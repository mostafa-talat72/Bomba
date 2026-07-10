import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";

async function showUnpaidBills() {
    const bills = await Bill.find({
        status: { $in: ["draft", "partial", "overdue"] },
    })
        .populate("table")
        .sort({ createdAt: -1 });

    if (bills.length === 0) {
        console.log("✅ No unpaid bills found.");
        return;
    }

    console.log(`📋 Found ${bills.length} unpaid bills:\n`);

    for (const bill of bills) {
        const tableNumber = bill.table?.number || "—";
        const orders = await Order.find({ bill: bill._id });

        console.log(`━━━ ${bill.billNumber} ━━━`);
        console.log(`  Table:   ${tableNumber}`);
        console.log(`  Status:  ${bill.status}`);
        console.log(`  Total:   ${bill.total} EGP`);
        console.log(`  Paid:    ${bill.paid} EGP`);
        console.log(`  Remain:  ${bill.remaining} EGP`);
        console.log(`  Orders:  ${orders.length} orders`);
        for (const order of orders) {
            const itemCount = order.items?.length || 0;
            const amount = order.finalAmount || order.totalAmount || 0;
            console.log(`    • ${order.orderNumber} (${itemCount} items, ${amount} EGP)`);
        }
        console.log("");
    }
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(async () => {
        console.log("📦 Connected to MongoDB\n");
        await showUnpaidBills();
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
