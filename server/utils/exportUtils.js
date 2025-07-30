import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Logger from "../middleware/logger.js";

// Export to Excel
export const exportToExcel = async (data, reportType, period) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("التقرير");

        // Set RTL direction
        worksheet.views = [
            {
                rightToLeft: true,
            },
        ];

        // Add title
        worksheet.addRow([]);
        const titleRow = worksheet.addRow([`تقرير ${reportType} - ${period}`]);
        titleRow.font = { bold: true, size: 16 };
        titleRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(`A${titleRow.number}:D${titleRow.number}`);

        // Add date
        const dateRow = worksheet.addRow([
            `تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}`,
        ]);
        dateRow.font = { size: 12 };
        dateRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(`A${dateRow.number}:D${dateRow.number}`);

        worksheet.addRow([]);

        // Add data based on report type
        switch (reportType) {
            case "sales":
                await addSalesData(worksheet, data);
                break;
            case "financial":
                await addFinancialData(worksheet, data);
                break;
            case "inventory":
                await addInventoryData(worksheet, data);
                break;
            case "sessions":
                await addSessionsData(worksheet, data);
                break;
            default:
                await addGeneralData(worksheet, data);
        }

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
            column.width = Math.max(column.width || 0, 15);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    } catch (error) {
        Logger.error("Failed to export to Excel", { error: error.message });
        throw error;
    }
};

// Add sales data to Excel
const addSalesData = async (worksheet, data) => {
    // Summary section
    worksheet.addRow(["ملخص المبيعات"]);
    worksheet.addRow(["إجمالي الإيرادات", data.totalRevenue || 0]);
    worksheet.addRow(["عدد الطلبات", data.totalOrders || 0]);
    worksheet.addRow(["متوسط قيمة الطلب", data.avgOrderValue || 0]);
    worksheet.addRow([]);

    // Revenue breakdown
    if (data.revenueBreakdown) {
        worksheet.addRow(["توزيع الإيرادات"]);
        worksheet.addRow([
            "البلايستيشن",
            data.revenueBreakdown.playstation || 0,
        ]);
        worksheet.addRow(["الكمبيوتر", data.revenueBreakdown.computer || 0]);
        worksheet.addRow(["الطلبات", data.revenueBreakdown.cafe || 0]);
        worksheet.addRow([]);
    }

    // Top products
    if (data.topProducts && data.topProducts.length > 0) {
        worksheet.addRow(["أفضل المنتجات مبيعاً"]);
        worksheet.addRow(["المنتج", "الكمية", "الإيرادات"]);

        data.topProducts.forEach((product) => {
            worksheet.addRow([
                product.name,
                product.quantity,
                product.revenue || 0,
            ]);
        });
    }
};

// Add financial data to Excel
const addFinancialData = async (worksheet, data) => {
    // Summary section
    worksheet.addRow(["ملخص مالي"]);
    worksheet.addRow(["إجمالي الإيرادات", data.totalRevenue || 0]);
    worksheet.addRow(["إجمالي التكاليف", data.totalCosts || 0]);
    worksheet.addRow(["صافي الربح", data.netProfit || 0]);
    worksheet.addRow(["هامش الربح", `${data.profitMargin || 0}%`]);
    worksheet.addRow([]);

    // Costs breakdown
    if (data.costsByCategory) {
        worksheet.addRow(["توزيع التكاليف حسب الفئة"]);
        worksheet.addRow(["الفئة", "المبلغ", "النسبة"]);

        data.costsByCategory.forEach((cost) => {
            worksheet.addRow([
                cost.category,
                cost.amount,
                `${cost.percentage}%`,
            ]);
        });
    }
};

// Add inventory data to Excel
const addInventoryData = async (worksheet, data) => {
    // Summary section
    worksheet.addRow(["ملخص المخزون"]);
    worksheet.addRow(["إجمالي المنتجات", data.totalItems || 0]);
    worksheet.addRow(["قيمة المخزون", data.totalValue || 0]);
    worksheet.addRow(["منتجات منخفضة", data.lowStockItems || 0]);
    worksheet.addRow([]);

    // Inventory items
    if (data.items && data.items.length > 0) {
        worksheet.addRow(["تفاصيل المخزون"]);
        worksheet.addRow([
            "المنتج",
            "الفئة",
            "الكمية الحالية",
            "الحد الأدنى",
            "السعر",
            "القيمة",
        ]);

        data.items.forEach((item) => {
            worksheet.addRow([
                item.name,
                item.category,
                item.currentStock,
                item.minStock,
                item.price,
                item.currentStock * item.price,
            ]);
        });
    }
};

// Add sessions data to Excel
const addSessionsData = async (worksheet, data) => {
    // Summary section
    worksheet.addRow(["ملخص الجلسات"]);
    worksheet.addRow(["إجمالي الجلسات", data.totalSessions || 0]);
    worksheet.addRow([
        "متوسط مدة الجلسة",
        `${data.avgSessionDuration || 0} ساعة`,
    ]);
    worksheet.addRow(["إجمالي الإيرادات", data.totalRevenue || 0]);
    worksheet.addRow([]);

    // Device statistics
    if (data.deviceStats) {
        worksheet.addRow(["إحصائيات الأجهزة"]);
        worksheet.addRow(["النوع", "عدد الجلسات", "الإيرادات", "متوسط المدة"]);

        Object.entries(data.deviceStats).forEach(([device, stats]) => {
            worksheet.addRow([
                device === "playstation"
                    ? "البلايستيشن"
                    : device === "computer"
                    ? "الكمبيوتر"
                    : device,
                stats.sessions || 0,
                stats.revenue || 0,
                `${stats.avgDuration || 0} دقيقة`,
            ]);
        });
    }
};

// Add general data to Excel
const addGeneralData = async (worksheet, data) => {
    worksheet.addRow(["البيانات العامة"]);

    if (typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value !== "object") {
                worksheet.addRow([key, value]);
            }
        });
    }
};

// Export to PDF
export const exportToPDF = async (data, reportType, period) => {
    try {
        const doc = new jsPDF("p", "mm", "a4");

        // Set RTL direction
        doc.setR2L(true);

        // Add title
        doc.setFontSize(20);
        doc.text(`تقرير ${reportType} - ${period}`, 105, 20, {
            align: "center",
        });

        // Add date
        doc.setFontSize(12);
        doc.text(
            `تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}`,
            105,
            30,
            { align: "center" }
        );

        let yPosition = 50;

        // Add data based on report type
        switch (reportType) {
            case "sales":
                yPosition = addSalesDataToPDF(doc, data, yPosition);
                break;
            case "financial":
                yPosition = addFinancialDataToPDF(doc, data, yPosition);
                break;
            case "inventory":
                yPosition = addInventoryDataToPDF(doc, data, yPosition);
                break;
            case "sessions":
                yPosition = addSessionsDataToPDF(doc, data, yPosition);
                break;
            default:
                yPosition = addGeneralDataToPDF(doc, data, yPosition);
        }

        return doc.output("blob");
    } catch (error) {
        Logger.error("Failed to export to PDF", { error: error.message });
        throw error;
    }
};

// Add sales data to PDF
const addSalesDataToPDF = (doc, data, startY) => {
    let y = startY;

    // Summary section
    doc.setFontSize(16);
    doc.text("ملخص المبيعات", 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`إجمالي الإيرادات: ${data.totalRevenue || 0} ج.م`, 20, y);
    y += 7;
    doc.text(`عدد الطلبات: ${data.totalOrders || 0}`, 20, y);
    y += 7;
    doc.text(`متوسط قيمة الطلب: ${data.avgOrderValue || 0} ج.م`, 20, y);
    y += 15;

    // Revenue breakdown
    if (data.revenueBreakdown) {
        doc.setFontSize(14);
        doc.text("توزيع الإيرادات", 20, y);
        y += 8;

        doc.setFontSize(12);
        doc.text(
            `البلايستيشن: ${data.revenueBreakdown.playstation || 0} ج.م`,
            20,
            y
        );
        y += 7;
        doc.text(
            `الكمبيوتر: ${data.revenueBreakdown.computer || 0} ج.م`,
            20,
            y
        );
        y += 7;
        doc.text(`الطلبات: ${data.revenueBreakdown.cafe || 0} ج.م`, 20, y);
        y += 15;
    }

    return y;
};

// Add financial data to PDF
const addFinancialDataToPDF = (doc, data, startY) => {
    let y = startY;

    // Summary section
    doc.setFontSize(16);
    doc.text("ملخص مالي", 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`إجمالي الإيرادات: ${data.totalRevenue || 0} ج.م`, 20, y);
    y += 7;
    doc.text(`إجمالي التكاليف: ${data.totalCosts || 0} ج.م`, 20, y);
    y += 7;
    doc.text(`صافي الربح: ${data.netProfit || 0} ج.م`, 20, y);
    y += 7;
    doc.text(`هامش الربح: ${data.profitMargin || 0}%`, 20, y);
    y += 15;

    return y;
};

// Add inventory data to PDF
const addInventoryDataToPDF = (doc, data, startY) => {
    let y = startY;

    // Summary section
    doc.setFontSize(16);
    doc.text("ملخص المخزون", 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`إجمالي المنتجات: ${data.totalItems || 0}`, 20, y);
    y += 7;
    doc.text(`قيمة المخزون: ${data.totalValue || 0} ج.م`, 20, y);
    y += 7;
    doc.text(`منتجات منخفضة: ${data.lowStockItems || 0}`, 20, y);
    y += 15;

    return y;
};

// Add sessions data to PDF
const addSessionsDataToPDF = (doc, data, startY) => {
    let y = startY;

    // Summary section
    doc.setFontSize(16);
    doc.text("ملخص الجلسات", 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`إجمالي الجلسات: ${data.totalSessions || 0}`, 20, y);
    y += 7;
    doc.text(`متوسط مدة الجلسة: ${data.avgSessionDuration || 0} ساعة`, 20, y);
    y += 7;
    doc.text(`إجمالي الإيرادات: ${data.totalRevenue || 0} ج.م`, 20, y);
    y += 15;

    return y;
};

// Add general data to PDF
const addGeneralDataToPDF = (doc, data, startY) => {
    let y = startY;

    doc.setFontSize(16);
    doc.text("البيانات العامة", 20, y);
    y += 10;

    doc.setFontSize(12);
    if (typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value !== "object") {
                doc.text(`${key}: ${value}`, 20, y);
                y += 7;
            }
        });
    }

    return y;
};

// Generate filename
export const generateFilename = (reportType, period, format) => {
    const date = new Date().toISOString().split("T")[0];
    const reportTypeAr =
        {
            sales: "المبيعات",
            financial: "المالي",
            inventory: "المخزون",
            sessions: "الجلسات",
        }[reportType] || reportType;

    return `تقرير_${reportTypeAr}_${period}_${date}.${format}`;
};
