import mongoose from "mongoose";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";

mongoose.set("strictQuery", false);

async function fixLinkedBills() {
    const bills = await Bill.find({}).sort({ createdAt: -1 });

    for (const bill of bills) {
        const linkedOrders = await Order.find({ bill: bill._id });
        if (linkedOrders.length === 0) continue;

        const linkedIds = linkedOrders.map((o) => o._id);
        const currentBillOrderIds = (bill.orders || []).map((o) =>
            o.toString()
        );
        const missingIds = linkedIds.filter(
            (id) => !currentBillOrderIds.includes(id.toString())
        );

        if (missingIds.length === 0) {
            console.log(
                `✓ Bill ${bill.billNumber} already has all ${linkedOrders.length} orders`
            );
            continue;
        }

        // Calculate subtotal manually from linked orders
        let subtotal = 0;
        for (const order of linkedOrders) {
            if (order.status !== "cancelled") {
                subtotal += order.finalAmount || order.totalAmount || 0;
            }
        }
        let discountAmount = bill.discountPercentage
            ? Math.round((subtotal * bill.discountPercentage) / 100)
            : bill.discount || 0;
        let total = Math.max(0, subtotal + (bill.tax || 0) - discountAmount);

        // Update bill directly using $set (bypass pre-save hooks)
        await Bill.updateOne(
            { _id: bill._id },
            {
                $set: {
                    orders: linkedIds,
                    subtotal,
                    discount: discountAmount,
                    total,
                },
            }
        );

        console.log(
            `✅ Bill ${bill.billNumber}: added ${missingIds.length} missing orders (total orders: ${linkedIds.length}, total: ${total})`
        );
    }

    console.log("\n✅ All bills updated!");
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(async () => {
        console.log("📦 Connected to MongoDB");
        await fixLinkedBills();
        console.log("🏁 Done!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
