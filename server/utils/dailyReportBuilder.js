// Shared daily-report builder with per-recipient scope (mini-reports).
// Used by both the scheduled sender (generateAndSendDailyReport) and the
// manual sender (sendReportNow) so logic can't drift between them.
//
// Scope semantics (chosen by the owner): each recipient's numbers are computed
// ONLY from their scope — selected menu sections (item-level), PlayStation /
// Computer toggles (sessions), Costs toggle, Employees toggle (payroll PDFs).
// Empty sectionIds = ALL sections (backward compatible with old entries).

// Normalize one recipient entry -> canonical scope (defaults = full report).
export function normalizeRecipientScope(r) {
    const sectionIds = Array.isArray(r?.sectionIds)
        ? r.sectionIds.map(String).filter(Boolean).sort()
        : [];
    return {
        sectionIds, // [] = all
        includeEmployees: r?.includeEmployees !== false,
        includeCosts: r?.includeCosts !== false,
        includePlaystation: r?.includePlaystation !== false,
        includeComputer: r?.includeComputer !== false,
    };
}

export function scopeKey(scope) {
    return [
        scope.sectionIds.length ? scope.sectionIds.join(",") : "ALL",
        scope.includeEmployees ? 1 : 0,
        scope.includeCosts ? 1 : 0,
        scope.includePlaystation ? 1 : 0,
        scope.includeComputer ? 1 : 0,
    ].join("|");
}

// Group recipients sharing the exact same scope -> build once per group.
export function groupRecipients(emails, defaultLanguage = "ar") {
    const groups = new Map();
    for (const item of emails || []) {
        const email = typeof item === "string" ? item : item?.email;
        if (!email) continue;
        const language =
            (typeof item === "object" && item?.language) || defaultLanguage;
        const scope = normalizeRecipientScope(typeof item === "object" ? item : null);
        const key = scopeKey(scope);
        if (!groups.has(key)) groups.set(key, { scope, recipients: [] });
        groups.get(key).recipients.push({ email, language });
    }
    return [...groups.values()];
}

// Raw data fetch (shared by all groups of one send run).
export async function fetchDailyRaw(organizationId, startOfReport, endOfReport, findReportEligibleOrders) {
    const { default: Session } = await import("../models/Session.js");
    const { default: Cost } = await import("../models/Cost.js");
    const { default: MenuItem } = await import("../models/MenuItem.js");

    const orders = await findReportEligibleOrders(organizationId, {
        createdAt: { $gte: startOfReport, $lte: endOfReport },
    });
    const sessions = await Session.find({
        endTime: { $gte: startOfReport, $lte: endOfReport },
        status: "completed",
        organization: organizationId,
    }).lean();
    const costs = await Cost.find({
        date: { $gte: startOfReport, $lte: endOfReport },
        organization: organizationId,
    }).lean();
    const menuItems = await MenuItem.find({ organization: organizationId })
        .populate({ path: "category", populate: { path: "section" } })
        .lean();

    const menuItemMap = {};
    menuItems.forEach((item) => {
        menuItemMap[item.name] = item;
    });
    return { orders, sessions, costs, menuItemMap };
}

function sectionOfItem(item, menuItemMap) {
    const menuItem = menuItemMap[item.name];
    if (menuItem && menuItem.category && menuItem.category.section) {
        const section = menuItem.category.section;
        return {
            sectionId: section._id ? section._id.toString() : "other",
            sectionName: section.name || "أخرى",
        };
    }
    return { sectionId: "other", sectionName: "أخرى" };
}

// Build one scoped reportData (same shape + formulas as the legacy full
// computation, filtered to scope). Pass the SAME period/userLocale the
// caller computed so scheduled and manual sends stay identical.
export function buildDailyReportData({ organization, raw, startOfReport, endOfReport, startTimeStr, userLocale, scope }) {
    const { orders, sessions, costs, menuItemMap } = raw;
    const inScope = (sectionId) =>
        !scope.sectionIds.length || scope.sectionIds.includes(String(sectionId));

    // Orders count only when they contain >= 1 in-scope item; revenue sums
    // in-scope item totals (an order may span sections).
    let cafeRevenue = 0;
    let countedOrders = 0;
    const productSales = {};
    const sectionData = {};
    for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;
        let orderTouched = false;
        for (const item of order.items) {
            if (!item.name) continue;
            const { sectionId, sectionName } = sectionOfItem(item, menuItemMap);
            if (!inScope(sectionId)) continue;
            orderTouched = true;

            const variant = item.variant || "";
            const key = `${item.name}|${variant}`;
            const variantText = variant && variant !== "عادي" ? ` (${variant})` : "";
            const displayName = `${item.name}${variantText}`;
            if (!productSales[key]) {
                productSales[key] = { name: displayName, variant, quantity: 0, revenue: 0 };
            }
            const itemQuantity = Number(item.quantity) || 0;
            const itemPrice = Number(item.price) || 0;
            const itemTotal = Number(item.itemTotal) || itemPrice * itemQuantity;
            productSales[key].quantity += itemQuantity;
            productSales[key].revenue += itemTotal;
            cafeRevenue += itemTotal;

            if (!sectionData[sectionId]) {
                sectionData[sectionId] = {
                    sectionId,
                    sectionName,
                    products: {},
                    totalRevenue: 0,
                    totalQuantity: 0,
                };
            }
            if (!sectionData[sectionId].products[key]) {
                sectionData[sectionId].products[key] = {
                    name: displayName,
                    variant,
                    quantity: 0,
                    revenue: 0,
                };
            }
            sectionData[sectionId].products[key].quantity += itemQuantity;
            sectionData[sectionId].products[key].revenue += itemTotal;
            sectionData[sectionId].totalRevenue += itemTotal;
            sectionData[sectionId].totalQuantity += itemQuantity;
        }
        if (orderTouched) countedOrders++;
    }

    const psSessions = scope.includePlaystation
        ? sessions.filter((s) => s.deviceType === "playstation")
        : [];
    const pcSessions = scope.includeComputer
        ? sessions.filter((s) => s.deviceType === "computer")
        : [];
    // Sessions of other device types are cafe-neutral: keep them only when at
    // least one gaming module is wanted (they carry no gaming revenue).
    const otherSessions =
        scope.includePlaystation || scope.includeComputer
            ? sessions.filter((s) => s.deviceType !== "playstation" && s.deviceType !== "computer")
            : [];
    const countedSessions = [...psSessions, ...pcSessions, ...otherSessions];
    const playstationRevenue = psSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
    const computerRevenue = pcSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);

    const totalRevenue = cafeRevenue + playstationRevenue + computerRevenue;
    const totalCosts = scope.includeCosts
        ? costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0)
        : 0;
    const netProfit = totalRevenue - totalCosts;

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    const topProductsBySection = Object.values(sectionData)
        .map((section) => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            totalRevenue: section.totalRevenue,
            totalQuantity: section.totalQuantity,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
        date: startOfReport.toLocaleDateString(userLocale),
        organizationName: organization.name,
        totalRevenue: totalRevenue || 0,
        totalCosts: totalCosts || 0,
        netProfit: netProfit || 0,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        totalBills: countedOrders + countedSessions.length,
        totalOrders: countedOrders,
        totalSessions: countedSessions.length,
        topProducts,
        topProductsBySection,
        revenueByType: {
            playstation: playstationRevenue || 0,
            computer: computerRevenue || 0,
            cafe: cafeRevenue || 0,
        },
        soldItemsBySection: Object.values(sectionData).map((section) => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            items: Object.values(section.products).map((product) => ({
                name: product.name,
                variant: product.variant,
                quantity: product.quantity,
                totalRevenue: product.revenue,
            })),
        })),
        allSoldItems: Object.values(productSales)
            .map((data) => ({
                name: data.name,
                variant: data.variant,
                quantity: data.quantity,
                totalRevenue: data.revenue,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue),
        startOfReport,
        endOfReport,
        reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString(userLocale, { weekday: "long", day: "numeric", month: "long" })} 
                     إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString(userLocale, { weekday: "long", day: "numeric", month: "long" })}`,
        // Scope flags for PDF/HTML templates (conditional module blocks).
        _scope: {
            sectionIds: scope.sectionIds,
            includeEmployees: scope.includeEmployees,
            includeCosts: scope.includeCosts,
            includePlaystation: scope.includePlaystation,
            includeComputer: scope.includeComputer,
        },
    };
}

// Heavy payroll block (shared parallel version). Call ONLY when the group
// wants employees — otherwise skip entirely.
export async function buildPayrollBlock(organizationId, organizationName) {
    let payrollSummaryData = null;
    let allEmployeesPDFData = null;
    try {
        const { getPayrollSummaryData } = await import("../controllers/payrollController.js");
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        payrollSummaryData = await getPayrollSummaryData(organizationId, currentMonth, currentYear);
    } catch (payrollError) {
        console.error(`❌ Failed to generate payroll summary for ${organizationName}:`, payrollError);
    }
    try {
        if (payrollSummaryData && payrollSummaryData.employees && payrollSummaryData.employees.length > 0) {
            const { default: Employee } = await import("../models/Employee.js");
            const { default: Attendance } = await import("../models/Attendance.js");
            const { default: Advance } = await import("../models/Advance.js");
            const { default: Payment } = await import("../models/Payment.js");
            const { default: Deduction } = await import("../models/Deduction.js");
            const { default: Bonus } = await import("../models/Bonus.js");
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;
            const startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
            const detailedResults = await Promise.all(
                payrollSummaryData.employees.map(async (empSummary) => {
                    try {
                        const [employee, attendance, advances, bonuses, deductions, payments] = await Promise.all([
                            Employee.findById(empSummary.employeeId),
                            Attendance.find({
                                employeeId: empSummary.employeeId,
                                organizationId,
                                date: { $gte: startDate, $lte: endDate },
                            })
                                .sort({ date: 1 })
                                .lean(),
                            Advance.find({ employeeId: empSummary.employeeId, organizationId, month: monthStr })
                                .sort({ requestDate: -1 })
                                .lean(),
                            Bonus.find({ employeeId: empSummary.employeeId, organizationId, month: monthStr })
                                .sort({ date: -1 })
                                .lean(),
                            Deduction.find({ employeeId: empSummary.employeeId, organizationId, month: monthStr })
                                .sort({ date: -1 })
                                .lean(),
                            Payment.find({ employeeId: empSummary.employeeId, organizationId, month: monthStr })
                                .sort({ paymentDate: -1 })
                                .lean(),
                        ]);
                        if (!employee) return null;
                        const currentMonthNetSalary =
                            (empSummary.grossSalary || 0) + (empSummary.bonuses || 0) - (empSummary.deductions || 0);
                        const currentMonthRemaining = currentMonthNetSalary - (empSummary.paidAmount || 0);
                        return {
                            employee: employee.toObject(),
                            stats: {
                                carriedForward: empSummary.carriedForward || 0,
                                currentMonthSalary: empSummary.grossSalary || 0,
                                currentMonthBonuses: empSummary.bonuses || 0,
                                currentMonthAdvances: empSummary.advances || 0,
                                currentMonthDeductions: empSummary.deductions || 0,
                                currentMonthPaid: empSummary.paidAmount || 0,
                                remainingBalance: (empSummary.carriedForward || 0) + currentMonthRemaining,
                                attendanceDays: attendance.filter((a) => a.status === "present" || a.status === "late").length,
                            },
                            attendance,
                            advances,
                            bonuses,
                            deductions,
                            payments,
                        };
                    } catch (empError) {
                        console.error(`Error preparing detailed data for employee ${empSummary.employeeId}:`, empError);
                        return null;
                    }
                })
            );
            allEmployeesPDFData = detailedResults.filter(Boolean);
        }
    } catch (allEmpError) {
        console.error(`❌ Failed to prepare all employees PDF data for ${organizationName}:`, allEmpError);
    }
    return { payrollSummaryData, allEmployeesPDFData };
}

// Group-aware sender: one build per distinct scope, payroll only for groups
// that want employees, per-language PDF regen handled by sendDailyReport.
export async function sendGroupedDailyReports({ organization, groups, period, userLocale, currency, ownerLanguage }) {    const { sendDailyReport } = await import("./email.js");
    const { generateDailyReportPDF } = await import("./pdfGenerator.js");
    const { findReportEligibleOrders } = await import("./reportOrderFilter.js");

    const raw = await fetchDailyRaw(
        organization._id,
        period.startOfReport,
        period.endOfReport,
        findReportEligibleOrders
    );

    let sent = 0;
    for (const group of groups) {
        const reportData = buildDailyReportData({
            organization,
            raw,
            startOfReport: period.startOfReport,
            endOfReport: period.endOfReport,
            startTimeStr: period.startTimeStr,
            userLocale,
            scope: group.scope,
        });
        let payrollSummaryData = null;
        let allEmployeesPDFData = null;
        if (group.scope.includeEmployees) {
            ({ payrollSummaryData, allEmployeesPDFData } = await buildPayrollBlock(
                organization._id,
                organization.name
            ));
        }
        const pdfBuffer = await generateDailyReportPDF(reportData);
        const results = await sendDailyReport(
            reportData,
            group.recipients,
            pdfBuffer,
            ownerLanguage,
            currency,
            payrollSummaryData,
            allEmployeesPDFData
        );
        if (Array.isArray(results)) sent += results.filter((r) => r?.success).length;
    }
    return sent;
}

export function isSameCalendarMonth(a, b) {
    const da = a ? new Date(a) : null;
    const db = b ? new Date(b) : null;
    if (!da || !db || isNaN(da) || isNaN(db)) return false;
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

// Group-aware MONTHLY sender (same per-recipient mini-report semantics).
// month = { start, end } covering last month. Skips payroll entirely — the
// monthly email is an HTML summary (no payroll attachments by design).
export async function sendGroupedMonthlyReports({ organization, groups, month, startTimeStr, userLocale, currency, ownerLanguage, findReportEligibleOrders }) {
    const { sendMonthlyReport } = await import("./email.js");
    const raw = await fetchDailyRaw(organization._id, month.start, month.end, findReportEligibleOrders);
    const daysInPeriod = Math.max(1, Math.ceil((month.end - month.start) / (1000 * 60 * 60 * 24)));

    let sent = 0;
    for (const group of groups) {
        try {
            const data = buildDailyReportData({
                organization,
                raw,
                startOfReport: month.start,
                endOfReport: month.end,
                startTimeStr,
                userLocale,
                scope: group.scope,
            });
            const monthlyData = {
                ...data,
                month: month.start.toLocaleDateString(userLocale, { month: "long", year: "numeric" }),
                avgDailyRevenue: (data.totalRevenue || 0) / daysInPeriod,
                daysInPeriod,
            };
            const results = await sendMonthlyReport(monthlyData, group.recipients, ownerLanguage, currency);
            if (Array.isArray(results)) sent += results.filter((r) => r?.success).length;
        } catch (groupError) {
            console.error(`❌ Failed scoped monthly group:`, groupError);
        }
    }
    return sent;
}
