import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";

async function fixUnpaidBills() {
    const bills = await Bill.find({
        status: { $in: ["draft", "partial", "overdue"] },
    }).sort({ createdAt: -1 });

    console.log(`📋 Reviewing ${bills.length} unpaid bills...\n`);

    let fixed = 0;
    let errors = [];

    for (const bill of bills) {
        const report = { billNumber: bill.billNumber || "UNDEFINED", fixes: [] };

        // 1. Verify linked orders match actual orders in DB
        const actualOrders = await Order.find({ bill: bill._id });
        const actualIds = actualOrders.map((o) => o._id.toString());
        const currentIds = (bill.orders || []).map((o) =>
            o.toString ? o.toString() : o
        );
        const missingIds = actualIds.filter(
            (id) => !currentIds.includes(id)
        );
        const extraIds = currentIds.filter(
            (id) => !actualIds.includes(id)
        );

        if (missingIds.length > 0) {
            bill.orders = actualIds;
            bill.markModified("orders");
            report.fixes.push(
                `orders: added ${missingIds.length} missing order(s)`
            );
        }
        if (extraIds.length > 0) {
            bill.orders = actualIds;
            bill.markModified("orders");
            report.fixes.push(
                `orders: removed ${extraIds.length} extra order(s) not linked to this bill`
            );
        }

        // 2. Recalculate subtotal from linked orders
        let calculatedSubtotal = 0;
        for (const order of actualOrders) {
            if (order.status !== "cancelled") {
                calculatedSubtotal +=
                    order.finalAmount || order.totalAmount || 0;
            }
        }

        if (Math.abs(bill.subtotal - calculatedSubtotal) > 0.01) {
            report.fixes.push(
                `subtotal: ${bill.subtotal} -> ${calculatedSubtotal}`
            );
            bill.subtotal = calculatedSubtotal;
        }

        // 3. Recalculate total
        let discountAmount = bill.discountPercentage
            ? Math.round((calculatedSubtotal * bill.discountPercentage) / 100)
            : bill.discount || 0;
        let calculatedTotal = Math.max(
            0,
            calculatedSubtotal + (bill.tax || 0) - discountAmount
        );

        if (Math.abs(bill.total - calculatedTotal) > 0.01) {
            report.fixes.push(
                `total: ${bill.total} -> ${calculatedTotal}`
            );
            bill.total = calculatedTotal;
            bill.discount = discountAmount;
        }

        // 4. Fix paid / remaining if paid > total
        if (bill.paid > bill.total) {
            report.fixes.push(
                `paid: ${bill.paid} -> ${bill.total} (exceeded total)`
            );
            bill.paid = bill.total;
        }

        // 5. Recalculate remaining
        let calculatedRemaining = Math.max(0, bill.total - bill.paid);
        if (Math.abs(bill.remaining - calculatedRemaining) > 0.01) {
            report.fixes.push(
                `remaining: ${bill.remaining} -> ${calculatedRemaining}`
            );
            bill.remaining = calculatedRemaining;
        }

        // 6. Fix status based on actual state
        let expectedStatus = bill.status;
        if (bill.paid <= 0 && bill.total > 0) {
            expectedStatus = "draft";
        } else if (bill.paid > 0 && bill.paid < bill.total) {
            expectedStatus = "partial";
        } else if (bill.paid >= bill.total && bill.total > 0) {
            expectedStatus = "paid";
        }

        if (
            bill.status !== "paid" &&
            bill.status !== expectedStatus &&
            expectedStatus !== bill.status
        ) {
            report.fixes.push(
                `status: ${bill.status} -> ${expectedStatus}`
            );
            bill.status = expectedStatus;
        }

        // 7. Fix undefined billNumber
        if (!bill.billNumber || bill.billNumber === "undefined") {
            const newNumber = `BILL-FIX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            report.fixes.push(`billNumber: undefined -> ${newNumber}`);
            bill.billNumber = newNumber;
        }

        // Save if any fixes were made
        if (report.fixes.length > 0) {
            try {
                await Bill.updateOne(
                    { _id: bill._id },
                    {
                        $set: {
                            orders: bill.orders,
                            subtotal: bill.subtotal,
                            total: bill.total,
                            discount: bill.discount,
                            paid: bill.paid,
                            remaining: bill.remaining,
                            status: bill.status,
                            billNumber: bill.billNumber,
                        },
                    }
                );
                console.log(
                    `✅ ${report.billNumber}: ${report.fixes.join(" | ")}`
                );
                fixed++;
            } catch (err) {
                errors.push({ bill: report.billNumber, error: err.message });
                console.error(
                    `❌ ${report.billNumber}: save failed - ${err.message}`
                );
            }
        } else {
            console.log(`✓ ${report.billNumber}: no fixes needed`);
        }
    }

    console.log(`\n📊 Summary: ${fixed}/${bills.length} bills fixed`);
    if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors:`);
        for (const e of errors) {
            console.log(`   ${e.bill}: ${e.error}`);
        }
    }
    console.log("✅ Done!");
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(async () => {
        console.log("📦 Connected to MongoDB\n");
        await fixUnpaidBills();
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
