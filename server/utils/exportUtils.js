import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Logger from "../middleware/logger.js";

// Export to Excel
export const exportToExcel = async (data, reportType, dateRange) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("التقرير");

        // Set RTL direction
        worksheet.views = [
            {
                rightToLeft: true,
            },
        ];

        // Format date range for display
        const formatDateTime = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleString("ar-EG", {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Add title
        worksheet.addRow([]);
        const reportTypeAr = {
            sales: 'المبيعات',
            financial: 'المالي',
            inventory: 'المخزون',
            sessions: 'الجلسات',
            peakHours: 'ساعات الذروة',
            staffPerformance: 'أداء الموظفين',
            all: 'الشامل'
        }[reportType] || reportType;
        
        const titleRow = worksheet.addRow([`تقرير ${reportTypeAr}`]);
        titleRow.font = { bold: true, size: 16 };
        titleRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(`A${titleRow.number}:D${titleRow.number}`);

        // Add date range if available
        if (data.dateRange) {
            const dateRangeRow = worksheet.addRow([
                `الفترة: من ${formatDateTime(data.dateRange.startDate)} إلى ${formatDateTime(data.dateRange.endDate)}`
            ]);
            dateRangeRow.font = { size: 11 };
            dateRangeRow.alignment = { horizontal: "center" };
            worksheet.mergeCells(`A${dateRangeRow.number}:D${dateRangeRow.number}`);
        } else if (dateRange) {
            const dateRangeRow = worksheet.addRow([
                `الفترة: من ${formatDateTime(dateRange.startDate)} إلى ${formatDateTime(dateRange.endDate)}`
            ]);
            dateRangeRow.font = { size: 11 };
            dateRangeRow.alignment = { horizontal: "center" };
            worksheet.mergeCells(`A${dateRangeRow.number}:D${dateRangeRow.number}`);
        }

        // Add export date
        const dateRow = worksheet.addRow([
            `تاريخ التصدير: ${formatDateTime(new Date().toISOString())}`,
        ]);
        dateRow.font = { size: 10, italic: true };
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
    // Summary section with comparison
    worksheet.addRow(["ملخص المبيعات"]);
    const summaryHeaderRow = worksheet.addRow(["المؤشر", "القيمة الحالية", "الفترة السابقة", "التغيير %"]);
    summaryHeaderRow.font = { bold: true };
    
    if (data.comparison) {
        worksheet.addRow([
            "إجمالي الإيرادات",
            data.totalRevenue || 0,
            data.comparison.totalRevenue?.previous || 0,
            data.comparison.totalRevenue?.changePercent?.toFixed(2) + '%' || '0%'
        ]);
        worksheet.addRow([
            "عدد الطلبات",
            data.totalOrders || 0,
            data.comparison.totalOrders?.previous || 0,
            data.comparison.totalOrders?.changePercent?.toFixed(2) + '%' || '0%'
        ]);
        worksheet.addRow([
            "متوسط قيمة الطلب",
            data.avgOrderValue || 0,
            data.comparison.avgOrderValue?.previous || 0,
            data.comparison.avgOrderValue?.changePercent?.toFixed(2) + '%' || '0%'
        ]);
    } else {
        worksheet.addRow(["إجمالي الإيرادات", data.totalRevenue || 0, "-", "-"]);
        worksheet.addRow(["عدد الطلبات", data.totalOrders || 0, "-", "-"]);
        worksheet.addRow(["متوسط قيمة الطلب", data.avgOrderValue || 0, "-", "-"]);
    }
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

    // Top products by section
    if (data.topProductsBySection && data.topProductsBySection.length > 0) {
        worksheet.addRow(["أفضل المنتجات مبيعاً حسب الأقسام"]);
        
        data.topProductsBySection.forEach((section) => {
            worksheet.addRow([]);
            const sectionHeaderRow = worksheet.addRow([
                `قسم: ${section.sectionName}`,
                `إجمالي الإيراد: ${section.totalRevenue}`,
                `إجمالي الكمية: ${section.totalQuantity}`
            ]);
            sectionHeaderRow.font = { bold: true };
            
            const productHeaderRow = worksheet.addRow(["المنتج", "الكمية", "الإيرادات"]);
            productHeaderRow.font = { bold: true };
            
            section.products.forEach((product) => {
                worksheet.addRow([
                    product.name,
                    product.quantity,
                    product.revenue || 0,
                ]);
            });
        });
        worksheet.addRow([]);
    }

    // Peak hours
    if (data.peakHours && data.peakHours.hourlyData) {
        worksheet.addRow(["ساعات الذروة"]);
        const peakHeaderRow = worksheet.addRow(["الساعة", "المبيعات", "الجلسات", "الإيرادات"]);
        peakHeaderRow.font = { bold: true };
        
        data.peakHours.hourlyData
            .filter(h => h.revenue > 0 || h.sales > 0 || h.sessions > 0)
            .forEach((hour) => {
                const isPeak = data.peakHours.peakHours.includes(hour.hour);
                const row = worksheet.addRow([
                    `${hour.hour}:00`,
                    hour.sales,
                    hour.sessions,
                    hour.revenue
                ]);
                if (isPeak) {
                    row.font = { bold: true, color: { argb: 'FF0000FF' } };
                }
            });
        worksheet.addRow([]);
    }

    // Staff performance
    if (data.staffPerformance && data.staffPerformance.length > 0) {
        worksheet.addRow(["أداء الموظفين"]);
        const staffHeaderRow = worksheet.addRow([
            "الموظف",
            "عدد الطلبات",
            "عدد الجلسات",
            "الإيراد الإجمالي",
            "متوسط قيمة الطلب"
        ]);
        staffHeaderRow.font = { bold: true };
        
        data.staffPerformance.forEach((staff) => {
            worksheet.addRow([
                staff.staffName,
                staff.ordersCount,
                staff.sessionsCount,
                staff.totalRevenue,
                staff.avgOrderValue
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
    // PlayStation sessions
    if (data.playstation) {
        worksheet.addRow(["تحليل جلسات البلايستيشن"]);
        const psHeaderRow = worksheet.addRow(["المؤشر", "القيمة"]);
        psHeaderRow.font = { bold: true };
        
        worksheet.addRow(["إجمالي الجلسات", data.playstation.totalSessions || 0]);
        worksheet.addRow(["إجمالي الإيرادات", data.playstation.totalRevenue || 0]);
        worksheet.addRow(["متوسط المدة", `${data.playstation.avgDuration?.toFixed(2) || 0} ساعة`]);
        worksheet.addRow(["متوسط الإيراد", data.playstation.avgRevenue?.toFixed(2) || 0]);
        worksheet.addRow([]);

        // Controller distribution
        if (data.playstation.controllerDistribution) {
            worksheet.addRow(["توزيع الدراعات"]);
            worksheet.addRow(["1-2 دراعات", data.playstation.controllerDistribution.single || 0]);
            worksheet.addRow(["3 دراعات", data.playstation.controllerDistribution.triple || 0]);
            worksheet.addRow(["4 دراعات", data.playstation.controllerDistribution.quad || 0]);
            worksheet.addRow([]);
        }

        // Device usage
        if (data.playstation.deviceUsage && data.playstation.deviceUsage.length > 0) {
            worksheet.addRow(["أكثر الأجهزة استخداماً"]);
            const deviceHeaderRow = worksheet.addRow(["الجهاز", "عدد الجلسات", "الإيرادات", "معدل الاستخدام %"]);
            deviceHeaderRow.font = { bold: true };
            
            data.playstation.deviceUsage.forEach((device) => {
                worksheet.addRow([
                    device.deviceName,
                    device.sessionsCount,
                    device.revenue,
                    device.usageRate?.toFixed(2) + '%' || '0%'
                ]);
            });
            worksheet.addRow([]);
        }
    }

    // Computer sessions
    if (data.computer) {
        worksheet.addRow(["تحليل جلسات الكمبيوتر"]);
        const pcHeaderRow = worksheet.addRow(["المؤشر", "القيمة"]);
        pcHeaderRow.font = { bold: true };
        
        worksheet.addRow(["إجمالي الجلسات", data.computer.totalSessions || 0]);
        worksheet.addRow(["إجمالي الإيرادات", data.computer.totalRevenue || 0]);
        worksheet.addRow(["متوسط المدة", `${data.computer.avgDuration?.toFixed(2) || 0} ساعة`]);
        worksheet.addRow(["متوسط الإيراد", data.computer.avgRevenue?.toFixed(2) || 0]);
        worksheet.addRow([]);

        // Device usage
        if (data.computer.deviceUsage && data.computer.deviceUsage.length > 0) {
            worksheet.addRow(["أكثر الأجهزة استخداماً"]);
            const deviceHeaderRow = worksheet.addRow(["الجهاز", "عدد الجلسات", "الإيرادات", "معدل الاستخدام %"]);
            deviceHeaderRow.font = { bold: true };
            
            data.computer.deviceUsage.forEach((device) => {
                worksheet.addRow([
                    device.deviceName,
                    device.sessionsCount,
                    device.revenue,
                    device.usageRate?.toFixed(2) + '%' || '0%'
                ]);
            });
        }
    }

    // Legacy format support
    if (data.totalSessions && !data.playstation && !data.computer) {
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
export const exportToPDF = async (data, reportType, dateRange) => {
    try {
        const doc = new jsPDF("p", "mm", "a4");

        // Set RTL direction
        doc.setR2L(true);

        // Format date range for display
        const formatDateTime = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleString("ar-EG", {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Add title
        doc.setFontSize(20);
        const reportTypeAr = {
            sales: 'المبيعات',
            financial: 'المالي',
            inventory: 'المخزون',
            sessions: 'الجلسات',
            peakHours: 'ساعات الذروة',
            staffPerformance: 'أداء الموظفين',
            all: 'الشامل'
        }[reportType] || reportType;
        
        doc.text(`تقرير ${reportTypeAr}`, 105, 20, {
            align: "center",
        });

        // Add date range
        doc.setFontSize(10);
        let yPos = 30;
        if (data.dateRange) {
            doc.text(
                `الفترة: من ${formatDateTime(data.dateRange.startDate)}`,
                105,
                yPos,
                { align: "center" }
            );
            yPos += 5;
            doc.text(
                `إلى ${formatDateTime(data.dateRange.endDate)}`,
                105,
                yPos,
                { align: "center" }
            );
            yPos += 5;
        } else if (dateRange) {
            doc.text(
                `الفترة: من ${formatDateTime(dateRange.startDate)}`,
                105,
                yPos,
                { align: "center" }
            );
            yPos += 5;
            doc.text(
                `إلى ${formatDateTime(dateRange.endDate)}`,
                105,
                yPos,
                { align: "center" }
            );
            yPos += 5;
        }

        // Add export date
        doc.setFontSize(9);
        doc.text(
            `تاريخ التصدير: ${formatDateTime(new Date().toISOString())}`,
            105,
            yPos,
            { align: "center", fontStyle: "italic" }
        );

        let yPosition = yPos + 10;

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

        return doc.output("arraybuffer");
    } catch (error) {
        Logger.error("Failed to export to PDF", { error: error.message });
        throw error;
    }
};

// Add sales data to PDF
const addSalesDataToPDF = (doc, data, startY) => {
    let y = startY;

    // Summary section with comparison
    doc.setFontSize(16);
    doc.text("ملخص المبيعات", 20, y);
    y += 10;

    doc.setFontSize(12);
    if (data.comparison) {
        doc.text(`إجمالي الإيرادات: ${data.totalRevenue || 0} ج.م`, 20, y);
        doc.setFontSize(10);
        doc.text(
            `(${data.comparison.totalRevenue?.changePercent >= 0 ? '+' : ''}${data.comparison.totalRevenue?.changePercent?.toFixed(2) || 0}%)`,
            100,
            y
        );
        y += 7;
        
        doc.setFontSize(12);
        doc.text(`عدد الطلبات: ${data.totalOrders || 0}`, 20, y);
        doc.setFontSize(10);
        doc.text(
            `(${data.comparison.totalOrders?.changePercent >= 0 ? '+' : ''}${data.comparison.totalOrders?.changePercent?.toFixed(2) || 0}%)`,
            100,
            y
        );
        y += 7;
        
        doc.setFontSize(12);
        doc.text(`متوسط قيمة الطلب: ${data.avgOrderValue || 0} ج.م`, 20, y);
        doc.setFontSize(10);
        doc.text(
            `(${data.comparison.avgOrderValue?.changePercent >= 0 ? '+' : ''}${data.comparison.avgOrderValue?.changePercent?.toFixed(2) || 0}%)`,
            100,
            y
        );
        y += 15;
    } else {
        doc.text(`إجمالي الإيرادات: ${data.totalRevenue || 0} ج.م`, 20, y);
        y += 7;
        doc.text(`عدد الطلبات: ${data.totalOrders || 0}`, 20, y);
        y += 7;
        doc.text(`متوسط قيمة الطلب: ${data.avgOrderValue || 0} ج.م`, 20, y);
        y += 15;
    }

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

    // Top products by section (limited for PDF)
    if (data.topProductsBySection && data.topProductsBySection.length > 0) {
        doc.setFontSize(14);
        doc.text("أفضل المنتجات مبيعاً حسب الأقسام", 20, y);
        y += 8;

        doc.setFontSize(10);
        data.topProductsBySection.slice(0, 3).forEach((section) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            
            doc.setFontSize(12);
            doc.text(`${section.sectionName}: ${section.totalRevenue} ج.م`, 20, y);
            y += 6;
            
            doc.setFontSize(10);
            section.products.slice(0, 3).forEach((product) => {
                doc.text(`  • ${product.name}: ${product.quantity} × ${product.revenue} ج.م`, 25, y);
                y += 5;
            });
            y += 3;
        });
        y += 5;
    }

    // Peak hours summary
    if (data.peakHours && data.peakHours.peakHours) {
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFontSize(14);
        doc.text("ساعات الذروة", 20, y);
        y += 8;

        doc.setFontSize(12);
        doc.text(`أكثر الساعات ازدحاماً: ${data.peakHours.peakHours.map(h => `${h}:00`).join(', ')}`, 20, y);
        y += 15;
    }

    // Staff performance summary
    if (data.staffPerformance && data.staffPerformance.length > 0) {
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFontSize(14);
        doc.text("أداء الموظفين (أفضل 5)", 20, y);
        y += 8;

        doc.setFontSize(10);
        data.staffPerformance.slice(0, 5).forEach((staff, index) => {
            doc.text(
                `${index + 1}. ${staff.staffName}: ${staff.totalRevenue} ج.م (${staff.ordersCount} طلب، ${staff.sessionsCount} جلسة)`,
                20,
                y
            );
            y += 6;
        });
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

    // PlayStation sessions
    if (data.playstation) {
        doc.setFontSize(16);
        doc.text("تحليل جلسات البلايستيشن", 20, y);
        y += 10;

        doc.setFontSize(12);
        doc.text(`إجمالي الجلسات: ${data.playstation.totalSessions || 0}`, 20, y);
        y += 7;
        doc.text(`إجمالي الإيرادات: ${data.playstation.totalRevenue || 0} ج.م`, 20, y);
        y += 7;
        doc.text(`متوسط المدة: ${data.playstation.avgDuration?.toFixed(2) || 0} ساعة`, 20, y);
        y += 7;
        doc.text(`متوسط الإيراد: ${data.playstation.avgRevenue?.toFixed(2) || 0} ج.م`, 20, y);
        y += 10;

        // Controller distribution
        if (data.playstation.controllerDistribution) {
            doc.setFontSize(14);
            doc.text("توزيع الدراعات:", 20, y);
            y += 7;
            doc.setFontSize(12);
            doc.text(`1-2 دراعات: ${data.playstation.controllerDistribution.single || 0}`, 25, y);
            y += 6;
            doc.text(`3 دراعات: ${data.playstation.controllerDistribution.triple || 0}`, 25, y);
            y += 6;
            doc.text(`4 دراعات: ${data.playstation.controllerDistribution.quad || 0}`, 25, y);
            y += 10;
        }

        // Top devices
        if (data.playstation.deviceUsage && data.playstation.deviceUsage.length > 0) {
            doc.setFontSize(14);
            doc.text("أكثر الأجهزة استخداماً:", 20, y);
            y += 7;
            doc.setFontSize(10);
            data.playstation.deviceUsage.slice(0, 5).forEach((device) => {
                doc.text(
                    `${device.deviceName}: ${device.sessionsCount} جلسة، ${device.revenue} ج.م (${device.usageRate?.toFixed(2) || 0}%)`,
                    25,
                    y
                );
                y += 5;
            });
            y += 10;
        }
    }

    // Computer sessions
    if (data.computer) {
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFontSize(16);
        doc.text("تحليل جلسات الكمبيوتر", 20, y);
        y += 10;

        doc.setFontSize(12);
        doc.text(`إجمالي الجلسات: ${data.computer.totalSessions || 0}`, 20, y);
        y += 7;
        doc.text(`إجمالي الإيرادات: ${data.computer.totalRevenue || 0} ج.م`, 20, y);
        y += 7;
        doc.text(`متوسط المدة: ${data.computer.avgDuration?.toFixed(2) || 0} ساعة`, 20, y);
        y += 7;
        doc.text(`متوسط الإيراد: ${data.computer.avgRevenue?.toFixed(2) || 0} ج.م`, 20, y);
        y += 10;

        // Top devices
        if (data.computer.deviceUsage && data.computer.deviceUsage.length > 0) {
            doc.setFontSize(14);
            doc.text("أكثر الأجهزة استخداماً:", 20, y);
            y += 7;
            doc.setFontSize(10);
            data.computer.deviceUsage.slice(0, 5).forEach((device) => {
                doc.text(
                    `${device.deviceName}: ${device.sessionsCount} جلسة، ${device.revenue} ج.م (${device.usageRate?.toFixed(2) || 0}%)`,
                    25,
                    y
                );
                y += 5;
            });
        }
    }

    // Legacy format support
    if (data.totalSessions && !data.playstation && !data.computer) {
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
    }

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
export const generateFilename = (reportType, dateRange, format) => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const reportTypeEn =
        {
            sales: "sales",
            financial: "financial",
            inventory: "inventory",
            sessions: "sessions",
            peakHours: "peak-hours",
            staffPerformance: "staff-performance",
            all: "complete"
        }[reportType] || reportType;

    // If dateRange is an object with startDate and endDate
    if (dateRange && typeof dateRange === 'object' && dateRange.startDate) {
        const start = new Date(dateRange.startDate).toISOString().split("T")[0];
        const end = new Date(dateRange.endDate).toISOString().split("T")[0];
        return `report_${reportTypeEn}_${start}_to_${end}_exported_${dateStr}_${timeStr}.${format}`;
    }
    
    // Legacy support for period string
    const period = typeof dateRange === 'string' ? dateRange : 'custom';
    return `report_${reportTypeEn}_${period}_${dateStr}_${timeStr}.${format}`;
};
