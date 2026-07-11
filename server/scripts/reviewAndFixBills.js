import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";

async function scanBills() {
    const bills = await Bill.find({}).sort({ createdAt: -1 });
    const problems = [];

    for (const bill of bills) {
        const issues = [];
        let expectedSubtotal = 0;
        let expectedTotal = 0;
        let expectedPaid = 0;
        let expectedRemaining = 0;
        let expectedStatus = bill.status;

        // Check orders
        const actualOrders = await Order.find({ bill: bill._id });
        const actualOrderIds = actualOrders.map((o) => o._id.toString());
        const currentOrderIds = (bill.orders || []).map((o) =>
            o.toString ? o.toString() : o
        );
        const missingOrders = actualOrderIds.filter(
            (id) => !currentOrderIds.includes(id)
        );
        const extraOrders = currentOrderIds.filter(
            (id) => !actualOrderIds.includes(id)
        );
        if (missingOrders.length > 0)
            issues.push(`ناقص ${missingOrders.length} أوردر`);
        if (extraOrders.length > 0)
            issues.push(`زيادة ${extraOrders.length} أوردر وهمي`);

        // Check sessions
        const actualSessions = await Session.find({ bill: bill._id });
        const actualSessionIds = actualSessions.map((s) => s._id.toString());
        const currentSessionIds = (bill.sessions || []).map((s) =>
            s.toString ? s.toString() : s
        );
        const missingSessions = actualSessionIds.filter(
            (id) => !currentSessionIds.includes(id)
        );
        const extraSessions = currentSessionIds.filter(
            (id) => !actualSessionIds.includes(id)
        );
        if (missingSessions.length > 0)
            issues.push(`ناقص ${missingSessions.length} جلسة`);
        if (extraSessions.length > 0)
            issues.push(`زيادة ${extraSessions.length} جلسة وهمية`);

        // Calculate expected subtotal
        for (const order of actualOrders) {
            if (order.status !== "cancelled") {
                expectedSubtotal +=
                    order.finalAmount || order.totalAmount || 0;
            }
        }
        for (const session of actualSessions) {
            expectedSubtotal +=
                session.finalCost || session.totalCost || 0;
        }
        if (Math.abs(bill.subtotal - expectedSubtotal) > 0.01) {
            issues.push(`subtotal: ${bill.subtotal} -> ${expectedSubtotal}`);
        }

        // Calculate expected total
        let discountAmount = bill.discountPercentage
            ? Math.round((expectedSubtotal * bill.discountPercentage) / 100)
            : bill.discount || 0;
        expectedTotal = Math.max(
            0, expectedSubtotal + (bill.tax || 0) - discountAmount
        );
        if (Math.abs(bill.total - expectedTotal) > 0.01) {
            issues.push(`total: ${bill.total} -> ${expectedTotal}`);
        }

        // Calculate expected paid
        if (bill.itemPayments && bill.itemPayments.length > 0) {
            for (const ip of bill.itemPayments) {
                expectedPaid += ip.paidAmount || 0;
            }
        }
        if (bill.sessionPayments && bill.sessionPayments.length > 0) {
            for (const sp of bill.sessionPayments) {
                expectedPaid += sp.paidAmount || 0;
            }
        }
        const hasItemPayments = bill.itemPayments && bill.itemPayments.length > 0;
        const hasSessionPayments = bill.sessionPayments && bill.sessionPayments.length > 0;
        if (!hasItemPayments && !hasSessionPayments && bill.payments && bill.payments.length > 0) {
            for (const p of bill.payments) expectedPaid += p.amount || 0;
        }
        if (Math.abs(bill.paid - expectedPaid) > 0.01) {
            issues.push(`paid: ${bill.paid} -> ${expectedPaid}`);
        }

        if (expectedPaid > expectedTotal) expectedPaid = expectedTotal;
        expectedRemaining = Math.max(0, expectedTotal - expectedPaid);
        if (Math.abs(bill.remaining - expectedRemaining) > 0.01) {
            issues.push(`remaining: ${bill.remaining} -> ${expectedRemaining}`);
        }

        if (expectedPaid <= 0 && expectedTotal > 0) expectedStatus = "draft";
        else if (expectedPaid > 0 && expectedPaid < expectedTotal) expectedStatus = "partial";
        else if (expectedPaid >= expectedTotal && expectedTotal > 0) expectedStatus = "paid";
        else if (expectedTotal === 0) expectedStatus = "draft";

        if (bill.status !== expectedStatus) {
            issues.push(`status: ${bill.status} -> ${expectedStatus}`);
        }

        if (!bill.billNumber || bill.billNumber === "undefined") {
            issues.push("رقم فاتورة غير معروف");
        }

        if (issues.length > 0) {
            const paidFixed = expectedPaid > expectedTotal ? expectedTotal : expectedPaid;
            problems.push({
                index: problems.length + 1,
                _id: bill._id,
                billNumber: bill.billNumber || "UNDEFINED",
                customerName: bill.customerName || "(بدون اسم)",
                table: bill.table,
                status: bill.status,
                issues,
                fix: {
                    orders: actualOrderIds,
                    sessions: actualSessionIds,
                    subtotal: expectedSubtotal,
                    total: expectedTotal,
                    discount: discountAmount,
                    paid: paidFixed,
                    remaining: expectedRemaining,
                    status: expectedStatus,
                    billNumber:
                        !bill.billNumber || bill.billNumber === "undefined"
                            ? `BILL-FIX-${Date.now()}-${problems.length}`
                            : bill.billNumber,
                },
            });
        }
    }

    return problems;
}

function showProblems(problems) {
    console.log(`\n📋 تم العثور على ${problems.length} فاتورة بها مشاكل:\n`);
    for (const p of problems) {
        console.log(`[${String(p.index).padStart(3)}] ${p.billNumber}`);
        console.log(`     العميل: ${p.customerName}`);
        console.log(`     الحالة: ${p.status}`);
        console.log(`     المشاكل: ${p.issues.join(" | ")}`);
        console.log("");
    }
}

async function fixProblems(problems, selectedIndices) {
    let fixed = 0;
    for (const p of problems) {
        if (!selectedIndices.includes(p.index)) continue;
        try {
            await Bill.updateOne(
                { _id: p._id },
                { $set: {
                    orders: p.fix.orders,
                    sessions: p.fix.sessions,
                    subtotal: p.fix.subtotal,
                    total: p.fix.total,
                    discount: p.fix.discount,
                    paid: p.fix.paid,
                    remaining: p.fix.remaining,
                    status: p.fix.status,
                    billNumber: p.fix.billNumber,
                }}
            );
            console.log(`  ✅ [${p.index}] ${p.billNumber} (${p.customerName})`);
            fixed++;
        } catch (err) {
            console.error(`  ❌ [${p.index}] ${p.billNumber}: ${err.message}`);
        }
    }
    console.log(`\n📊 تم تصليح ${fixed}/${selectedIndices.length} فاتورة`);
}

async function main() {
    const cmd = process.argv[2];
    if (!cmd || cmd === "show" || cmd === "help") {
        console.log("🔍 جاري فحص جميع الفواتير...");
        const problems = await scanBills();
        if (problems.length === 0) {
            console.log("✅ جميع الفواتير سليمة.");
            return;
        }
        showProblems(problems);
        console.log("----------------------------");
        console.log("\nلتصليح فواتير معينة:");
        console.log("  node scripts/reviewAndFixBills.js fix all          # تصليح الكل");
        console.log("  node scripts/reviewAndFixBills.js fix 1,3,5-10    # أرقام محددة");
        console.log("  node scripts/reviewAndFixBills.js show            # عرض فقط");
        return;
    }

    if (cmd === "fix") {
        const arg = process.argv[3];
        if (!arg) {
            console.error("⚠️  حدد الفواتير: fix all أو fix 1,3,5-10");
            process.exit(1);
        }

        console.log("🔍 جاري فحص جميع الفواتير...");
        const problems = await scanBills();
        if (problems.length === 0) {
            console.log("✅ جميع الفواتير سليمة.");
            return;
        }

        showProblems(problems);

        let selectedIndices = [];
        if (arg === "all") {
            selectedIndices = problems.map((p) => p.index);
        } else {
            const parts = arg.split(",");
            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed.includes("-")) {
                    const [start, end] = trimmed.split("-").map(Number);
                    for (let i = start; i <= end; i++) selectedIndices.push(i);
                } else {
                    const num = parseInt(trimmed);
                    if (!isNaN(num)) selectedIndices.push(num);
                }
            }
        }

        const validIndices = problems.map((p) => p.index);
        const invalid = selectedIndices.filter((i) => !validIndices.includes(i));
        if (invalid.length > 0) {
            console.error(`⚠️  أرقام غير صحيحة: ${invalid.join(", ")}`);
            process.exit(1);
        }

        console.log(`\n🔧 جاري تصليح ${selectedIndices.length} فاتورة...`);
        await fixProblems(problems, selectedIndices);
        console.log("✅ تم!");
    }
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(main)
    .then(() => process.exit(0))
    .catch((err) => {
        if (err.code !== "ERR_USE_AFTER_CLOSE") {
            console.error("❌", err.message);
        }
        process.exit(1);
    });
