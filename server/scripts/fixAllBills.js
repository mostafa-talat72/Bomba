import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";

async function fixAllBills() {
    const bills = await Bill.find({}).sort({ createdAt: -1 });

    console.log(`📋 Reviewing all ${bills.length} bills...\n`);

    let fixed = 0;
    let errors = [];

    for (const bill of bills) {
        const report = { billNumber: bill.billNumber || "UNDEFINED", fixes: [] };

        // 1. Fix orders array
        const actualOrders = await Order.find({ bill: bill._id });
        const actualOrderIds = actualOrders.map((o) => o._id.toString());
        const currentOrderIds = (bill.orders || []).map((o) =>
            o.toString ? o.toString() : o
        );
        const missingIds = actualOrderIds.filter(
            (id) => !currentOrderIds.includes(id)
        );
        const extraIds = currentOrderIds.filter(
            (id) => !actualOrderIds.includes(id)
        );
        if (missingIds.length > 0 || extraIds.length > 0) {
            bill.orders = actualOrderIds;
            bill.markModified("orders");
            report.fixes.push(
                `orders: ${missingIds.length} added, ${extraIds.length} removed`
            );
        }

        // 2. Fix sessions array
        const actualSessions = await Session.find({ bill: bill._id });
        const actualSessionIds = actualSessions.map((s) => s._id.toString());
        const currentSessionIds = (bill.sessions || []).map((s) =>
            s.toString ? s.toString() : s
        );
        const missingSessionIds = actualSessionIds.filter(
            (id) => !currentSessionIds.includes(id)
        );
        const extraSessionIds = currentSessionIds.filter(
            (id) => !actualSessionIds.includes(id)
        );
        if (missingSessionIds.length > 0 || extraSessionIds.length > 0) {
            bill.sessions = actualSessionIds;
            bill.markModified("sessions");
            report.fixes.push(
                `sessions: ${missingSessionIds.length} added, ${extraSessionIds.length} removed`
            );
        }

        // 3. Recalculate subtotal from orders + sessions
        let calculatedSubtotal = 0;
        for (const order of actualOrders) {
            if (order.status !== "cancelled") {
                calculatedSubtotal +=
                    order.finalAmount || order.totalAmount || 0;
            }
        }
        for (const session of actualSessions) {
            calculatedSubtotal +=
                session.finalCost || session.totalCost || 0;
        }
        if (Math.abs(bill.subtotal - calculatedSubtotal) > 0.01) {
            report.fixes.push(
                `subtotal: ${bill.subtotal} -> ${calculatedSubtotal}`
            );
            bill.subtotal = calculatedSubtotal;
        }

        // 4. Recalculate total
        let discountAmount = bill.discountPercentage
            ? Math.round((calculatedSubtotal * bill.discountPercentage) / 100)
            : bill.discount || 0;
        let calculatedTotal = Math.max(
            0, calculatedSubtotal + (bill.tax || 0) - discountAmount
        );
        if (Math.abs(bill.total - calculatedTotal) > 0.01) {
            report.fixes.push(`total: ${bill.total} -> ${calculatedTotal}`);
            bill.total = calculatedTotal;
            bill.discount = discountAmount;
        }

        // 5. Recalculate paid from itemPayments + sessionPayments + payments
        let calculatedPaid = 0;

        const hasItemPayments =
            bill.itemPayments && bill.itemPayments.length > 0;
        const hasSessionPayments =
            bill.sessionPayments && bill.sessionPayments.length > 0;

        if (hasItemPayments) {
            for (const ip of bill.itemPayments) {
                calculatedPaid += ip.paidAmount || 0;
            }
        }
        if (hasSessionPayments) {
            for (const sp of bill.sessionPayments) {
                calculatedPaid += sp.paidAmount || 0;
            }
        }
        if (
            !hasItemPayments &&
            !hasSessionPayments &&
            bill.payments &&
            bill.payments.length > 0
        ) {
            for (const p of bill.payments) {
                calculatedPaid += p.amount || 0;
            }
        }

        if (Math.abs(bill.paid - calculatedPaid) > 0.01) {
            report.fixes.push(`paid: ${bill.paid} -> ${calculatedPaid}`);
            bill.paid = calculatedPaid;
        }

        // 6. Fix paid if exceeds total
        if (bill.paid > bill.total) {
            report.fixes.push(`paid exceeded total: ${bill.paid} -> ${bill.total}`);
            bill.paid = bill.total;
        }

        // 7. Recalculate remaining
        let calculatedRemaining = Math.max(0, bill.total - bill.paid);
        if (Math.abs(bill.remaining - calculatedRemaining) > 0.01) {
            report.fixes.push(
                `remaining: ${bill.remaining} -> ${calculatedRemaining}`
            );
            bill.remaining = calculatedRemaining;
        }

        // 8. Fix status based on actual paid vs total
        let expectedStatus = bill.status;
        if (bill.paid <= 0 && bill.total > 0) expectedStatus = "draft";
        else if (bill.paid > 0 && bill.paid < bill.total) expectedStatus = "partial";
        else if (bill.paid >= bill.total && bill.total > 0) expectedStatus = "paid";
        else if (bill.total === 0) expectedStatus = "draft";

        if (bill.status !== expectedStatus) {
            report.fixes.push(`status: ${bill.status} -> ${expectedStatus}`);
            bill.status = expectedStatus;
        }

        // 9. Fix undefined billNumber
        if (!bill.billNumber || bill.billNumber === "undefined") {
            const newNumber = `BILL-FIX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            report.fixes.push(`billNumber: undefined -> ${newNumber}`);
            bill.billNumber = newNumber;
        }

        if (report.fixes.length > 0) {
            try {
                await Bill.updateOne(
                    { _id: bill._id },
                    {
                        $set: {
                            orders: bill.orders,
                            sessions: bill.sessions,
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
                console.log(`✅ ${report.billNumber}: ${report.fixes.join(" | ")}`);
                fixed++;
            } catch (err) {
                errors.push({ bill: report.billNumber, error: err.message });
                console.error(`❌ ${report.billNumber}: save failed - ${err.message}`);
            }
        }
    }

    console.log(`\n📊 Summary: ${fixed}/${bills.length} bills fixed`);
    if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors:`);
        for (const e of errors) console.log(`   ${e.bill}: ${e.error}`);
    }
    console.log("✅ Done!");
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(async () => {
        console.log("📦 Connected to MongoDB\n");
        await fixAllBills();
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });
