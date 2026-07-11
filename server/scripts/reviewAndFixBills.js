import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";

function calcPaidFromPayments(bill) {
    let totalPaid = 0;
    if (bill.itemPayments && bill.itemPayments.length > 0) {
        for (const ip of bill.itemPayments) totalPaid += ip.paidAmount || 0;
    }
    if (bill.sessionPayments && bill.sessionPayments.length > 0) {
        for (const sp of bill.sessionPayments) totalPaid += sp.paidAmount || 0;
    }
    const hasItemPayments = bill.itemPayments && bill.itemPayments.length > 0;
    const hasSessionPayments = bill.sessionPayments && bill.sessionPayments.length > 0;
    if (!hasItemPayments && !hasSessionPayments && bill.payments && bill.payments.length > 0) {
        for (const p of bill.payments) totalPaid += p.amount || 0;
    }
    return totalPaid;
}

async function scanBills() {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const bills = await Bill.find({
        createdAt: { $gte: twoMonthsAgo },
    }).sort({ createdAt: -1 });

    const results = [];

    for (const bill of bills) {
        const issues = [];
        let expectedSubtotal = 0;
        let shouldFix = false;

        // Actual linked orders & sessions
        const actualOrders = await Order.find({ bill: bill._id });
        const actualSessions = await Session.find({ bill: bill._id });
        const actualOrderIds = actualOrders.map((o) => o._id.toString());
        const actualSessionIds = actualSessions.map((s) => s._id.toString());

        // Check orders array
        const currentOrderIds = (bill.orders || []).map((o) => o.toString ? o.toString() : o);
        const missingOrders = actualOrderIds.filter((id) => !currentOrderIds.includes(id));
        const extraOrders = currentOrderIds.filter((id) => !actualOrderIds.includes(id));
        if (missingOrders.length > 0) { issues.push(`ناقص ${missingOrders.length} أوردر`); shouldFix = true; }
        if (extraOrders.length > 0) { issues.push(`زيادة ${extraOrders.length} أوردر وهمي`); shouldFix = true; }

        // Check sessions array
        const currentSessionIds = (bill.sessions || []).map((s) => s.toString ? s.toString() : s);
        const missingSessions = actualSessionIds.filter((id) => !currentSessionIds.includes(id));
        const extraSessions = currentSessionIds.filter((id) => !actualSessionIds.includes(id));
        if (missingSessions.length > 0) { issues.push(`ناقص ${missingSessions.length} جلسة`); shouldFix = true; }
        if (extraSessions.length > 0) { issues.push(`زيادة ${extraSessions.length} جلسة وهمية`); shouldFix = true; }

        // Calculate expected subtotal
        for (const order of actualOrders) {
            if (order.status !== "cancelled") expectedSubtotal += order.finalAmount || order.totalAmount || 0;
        }
        for (const session of actualSessions) {
            expectedSubtotal += session.finalCost || session.totalCost || 0;
        }

        // Calculate total
        const discountAmount = bill.discountPercentage
            ? Math.round((expectedSubtotal * bill.discountPercentage) / 100)
            : bill.discount || 0;
        const expectedTotal = Math.max(0, expectedSubtotal + (bill.tax || 0) - discountAmount);

        // Paid from itemPayments / sessionPayments
        const paidFromPayments = calcPaidFromPayments(bill);
        const expectedPaid = paidFromPayments > expectedTotal ? expectedTotal : paidFromPayments;
        const expectedRemaining = Math.max(0, expectedTotal - expectedPaid);

        // Breakdown: orders subtotal vs sessions subtotal
        let ordersSubtotal = 0;
        for (const order of actualOrders) {
            if (order.status !== "cancelled") ordersSubtotal += order.finalAmount || order.totalAmount || 0;
        }
        let sessionsSubtotal = 0;
        for (const session of actualSessions) {
            sessionsSubtotal += session.finalCost || session.totalCost || 0;
        }

        // Paid from items (itemPayments) vs sessions (sessionPayments)
        let paidFromItems = 0;
        if (bill.itemPayments && bill.itemPayments.length > 0) {
            for (const ip of bill.itemPayments) paidFromItems += ip.paidAmount || 0;
        }
        let paidFromSessionsCalc = 0;
        if (bill.sessionPayments && bill.sessionPayments.length > 0) {
            for (const sp of bill.sessionPayments) paidFromSessionsCalc += sp.paidAmount || 0;
        }

        const remainingOrders = Math.max(0, ordersSubtotal - paidFromItems);
        const remainingSessions = Math.max(0, sessionsSubtotal - paidFromSessionsCalc);

        // تجاهل الفروق البسيطة (أقل من 2 جنيه) طالما المدفوع >= الإجمالي
        const TOLERANCE = 2;
        const subtotalDiff = Math.abs(bill.subtotal - expectedSubtotal);
        const totalDiff = Math.abs(bill.total - expectedTotal);
        const paidDiff = Math.abs(bill.paid - expectedPaid);
        const remainingDiff = Math.abs(bill.remaining - expectedRemaining);
        const isEffectivelyPaid = expectedPaid >= expectedTotal && paidFromItems >= ordersSubtotal && paidFromSessionsCalc >= sessionsSubtotal;

        if (subtotalDiff > TOLERANCE || (subtotalDiff > 0.01 && !isEffectivelyPaid)) {
            issues.push(`subtotal: ${bill.subtotal} -> ${expectedSubtotal}`);
            shouldFix = true;
        }
        if (totalDiff > TOLERANCE || (totalDiff > 0.01 && !isEffectivelyPaid)) {
            issues.push(`total: ${bill.total} -> ${expectedTotal}`);
            shouldFix = true;
        }
        if (paidDiff > TOLERANCE || (paidDiff > 0.01 && !isEffectivelyPaid)) {
            issues.push(`paid: ${bill.paid} -> ${expectedPaid}`);
            shouldFix = true;
        }
        if (remainingDiff > TOLERANCE || (remainingDiff > 0.01 && !isEffectivelyPaid)) {
            issues.push(`remaining: ${bill.remaining} -> ${expectedRemaining}`);
            shouldFix = true;
        }

        // Status
        let expectedStatus = bill.status;
        if (expectedPaid <= 0 && expectedTotal > 0) expectedStatus = "draft";
        else if (expectedPaid > 0 && expectedPaid < expectedTotal) expectedStatus = "partial";
        else if (expectedPaid >= expectedTotal && expectedTotal > 0) expectedStatus = "paid";
        else if (expectedTotal === 0) expectedStatus = "draft";
        if (bill.status !== expectedStatus) {
            issues.push(`status: ${bill.status} -> ${expectedStatus}`);
            shouldFix = true;
        }

        // Bill number
        if (!bill.billNumber || bill.billNumber === "undefined") {
            issues.push("رقم فاتورة غير معروف");
            shouldFix = true;
        }

        const d = bill.createdAt;
        const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

        results.push({
            index: results.length + 1,
            createdAt: bill.createdAt,
            dateStr,
            _id: bill._id,
            billNumber: bill.billNumber || "UNDEFINED",
            customerName: bill.customerName || "(بدون اسم)",
            status: bill.status,
            expectedStatus,
            currentTotal: bill.total,
            expectedTotal,
            currentPaid: bill.paid,
            paidFromPayments,
            expectedPaid,
            currentRemaining: bill.remaining,
            expectedRemaining,
            ordersCount: actualOrders.length,
            sessionsCount: actualSessions.length,
            ordersSubtotal,
            sessionsSubtotal,
            paidFromItems,
            paidFromSessions: paidFromSessionsCalc,
            remainingOrders,
            remainingSessions,
            issues,
            shouldFix,
            fix: {
                orders: actualOrderIds,
                sessions: actualSessionIds,
                subtotal: expectedSubtotal,
                total: expectedTotal,
                discount: discountAmount,
                paid: expectedPaid,
                remaining: expectedRemaining,
                status: expectedStatus,
                billNumber: !bill.billNumber || bill.billNumber === "undefined"
                    ? `BILL-FIX-${Date.now()}-${results.length}`
                    : bill.billNumber,
            },
        });
    }

    return results;
}

function showResults(results, showAll) {
    let withIssues = results.filter((r) => r.shouldFix);
    let ok = results.filter((r) => !r.shouldFix);

    console.log(`\n📋 إجمالي الفواتير (آخر شهرين): ${results.length}`);
    console.log(`   ✅ سليمة: ${ok.length}`);
    console.log(`   ⚠️  بها مشاكل: ${withIssues.length}\n`);

    if (withIssues.length === 0) {
        console.log("🎉 جميع الفواتير سليمة، لا توجد مشاكل.\n");
        return;
    }

    console.log("─── فواتير بها مشاكل ───\n");
    for (const r of withIssues) {
        console.log(`[${String(r.index).padStart(3)}] ${r.billNumber}  (${r.dateStr})`);
        console.log(`     العميل: ${r.customerName}`);
        console.log(`     الحالة: ${r.status}`);
        console.log(`     ────────── التفاصيل ──────────`);
        console.log(`     الطلبات:      ${r.ordersSubtotal} ج.م  (مدفوع: ${r.paidFromItems} | باقي: ${r.remainingOrders})`);
        console.log(`     الجلسات:     ${r.sessionsSubtotal} ج.م  (مدفوع: ${r.paidFromSessions} | باقي: ${r.remainingSessions})`);
        console.log(`     ─────────────────────────────`);
        console.log(`     الإجمالي:    ${r.expectedTotal} ج.م`);
        console.log(`     المدفوع:    ${r.expectedPaid} ج.م`);
        console.log(`     الباقي:     ${r.expectedRemaining} ج.م`);
        console.log(`     ─────────────────────────────`);
        console.log(`     المشاكل: ${r.issues.join(" | ")}`);
        console.log("");
    }
}

async function fixResults(results, selectedIndices) {
    let fixed = 0;
    for (const r of results) {
        if (!selectedIndices.includes(r.index)) continue;
        if (!r.shouldFix) {
            console.log(`  - [${r.index}] ${r.billNumber} — سليمة، لا تحتاج تصليح`);
            continue;
        }
        try {
            await Bill.updateOne(
                { _id: r._id },
                { $set: {
                    orders: r.fix.orders,
                    sessions: r.fix.sessions,
                    subtotal: r.fix.subtotal,
                    total: r.fix.total,
                    discount: r.fix.discount,
                    paid: r.fix.paid,
                    remaining: r.fix.remaining,
                    status: r.fix.status,
                    billNumber: r.fix.billNumber,
                }}
            );
            console.log(`  ✅ [${r.index}] ${r.billNumber} (${r.customerName})`);
            fixed++;
        } catch (err) {
            console.error(`  ❌ [${r.index}] ${r.billNumber}: ${err.message}`);
        }
    }
    console.log(`\n📊 تم تصليح ${fixed}/${selectedIndices.length} فاتورة`);
}

async function main() {
    const cmd = process.argv[2];

    console.log("🔍 جاري فحص جميع الفواتير (آخر شهرين)...");
    const results = await scanBills();

    if (cmd === "show" || !cmd || cmd === "help") {
        showResults(results);
        console.log("----------------------------");
        console.log("\nلتصليح فواتير:");
        console.log("  node scripts/reviewAndFixBills.js fix all          # تصليح الكل");
        console.log("  node scripts/reviewAndFixBills.js fix 1,3,5-10    # أرقام محددة");
        console.log("  node scripts/reviewAndFixBills.js show            # عرض فقط");
        return;
    }

    if (cmd === "fix") {
        const arg = process.argv[3];
        if (!arg) { console.error("⚠️  حدد الفواتير: fix all أو fix 1,3,5-10"); process.exit(1); }
        showResults(results);

        let selectedIndices = [];
        if (arg === "all") {
            selectedIndices = results.filter((r) => r.shouldFix).map((r) => r.index);
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

        const validIndices = results.map((r) => r.index);
        const invalid = selectedIndices.filter((i) => !validIndices.includes(i));
        if (invalid.length > 0) { console.error(`⚠️  أرقام غير صحيحة: ${invalid.join(", ")}`); process.exit(1); }

        console.log(`\n🔧 جاري تصليح ${selectedIndices.length} فاتورة...`);
        await fixResults(results, selectedIndices);
        console.log("✅ تم!");
    }
}

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bomba")
    .then(main)
    .then(() => process.exit(0))
    .catch((err) => {
        if (err.code !== "ERR_USE_AFTER_CLOSE") console.error("❌", err.message);
        process.exit(1);
    });
