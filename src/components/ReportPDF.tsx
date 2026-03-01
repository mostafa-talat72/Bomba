import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// تسجيل خط عربي - استخدام Noto Sans Arabic لأنه أكثر استقراراً
Font.register({
  family: 'NotoSansArabic',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.ttf',
    },
  ],
});

// الأنماط
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'NotoSansArabic',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  label: {
    fontSize: 11,
    color: '#374151',
    textAlign: 'right',
  },
  value: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'left',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'right',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    fontSize: 9,
    flex: 1,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
    textAlign: 'right',
  },
});

interface ReportPDFProps {
  reportType: 'sales' | 'financial' | 'sessions' | 'inventory';
  data: any;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  organizationName?: string;
}

export const ReportPDF: React.FC<ReportPDFProps> = ({ reportType, data, dateRange, organizationName = 'Bomba' }) => {
  // تحويل الأرقام إلى عربية
  const toArabicNumbers = (num: number | string): string => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    return formatted;
  };

  const formatCurrency = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    return `${toArabicNumbers(rounded.toFixed(2))} ج.م`;
  };
  
  const formatNumber = (num: number) => {
    return toArabicNumbers(num.toLocaleString('en-US'));
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'sales': return 'تقرير المبيعات';
      case 'financial': return 'التقرير المالي';
      case 'sessions': return 'تقرير الجلسات';
      case 'inventory': return 'تقرير المخزون';
      default: return 'تقرير';
    }
  };

  const renderSalesReport = () => (
    <>
      {/* الإحصائيات الأساسية */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الإحصائيات الأساسية</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي الإيرادات</Text>
            <Text style={styles.statValue}>{formatCurrency(data.totalRevenue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>عدد الطلبات</Text>
            <Text style={styles.statValue}>{formatNumber(data.totalOrders || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>عدد الجلسات</Text>
            <Text style={styles.statValue}>{formatNumber(data.totalSessions || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>متوسط قيمة الطلب</Text>
            <Text style={styles.statValue}>{formatCurrency(data.avgOrderValue || 0)}</Text>
          </View>
        </View>
      </View>

      {/* توزيع الإيرادات */}
      {data.revenueByType && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>توزيع الإيرادات</Text>
          <View style={styles.row}>
            <Text style={styles.label}>البلايستيشن</Text>
            <Text style={styles.value}>{formatCurrency(data.revenueByType.playstation || 0)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>الكمبيوتر</Text>
            <Text style={styles.value}>{formatCurrency(data.revenueByType.computer || 0)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>الطلبات</Text>
            <Text style={styles.value}>{formatCurrency(data.revenueByType.cafe || 0)}</Text>
          </View>
        </View>
      )}

      {/* أكثر المنتجات مبيعاً */}
      {data.topProductsBySection && data.topProductsBySection.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أكثر المنتجات مبيعاً حسب الأقسام</Text>
          {data.topProductsBySection.map((section: any, idx: number) => (
            <View key={idx} style={{ marginBottom: 15 }}>
              <Text style={styles.subsectionTitle}>{section.sectionName}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>المنتج</Text>
                  <Text style={styles.tableHeaderCell}>الكمية</Text>
                  <Text style={styles.tableHeaderCell}>الإيراد</Text>
                </View>
                {section.products.slice(0, 5).map((product: any, pIdx: number) => (
                  <View key={pIdx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{product.name}</Text>
                    <Text style={styles.tableCell}>{formatNumber(product.quantity)}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(product.revenue)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* أداء الموظفين */}
      {data.staffPerformance && data.staffPerformance.length > 0 && (
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>أداء الموظفين</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>الموظف</Text>
              <Text style={styles.tableHeaderCell}>الطلبات</Text>
              <Text style={styles.tableHeaderCell}>الجلسات</Text>
              <Text style={styles.tableHeaderCell}>الإيراد</Text>
            </View>
            {data.staffPerformance.slice(0, 10).map((staff: any, idx: number) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{staff.staffName}</Text>
                <Text style={styles.tableCell}>{formatNumber(staff.ordersCount)}</Text>
                <Text style={styles.tableCell}>{formatNumber(staff.sessionsCount)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(staff.totalRevenue)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderFinancialReport = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الملخص المالي</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي الإيرادات</Text>
            <Text style={styles.statValue}>{formatCurrency(data.summary?.totalRevenue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي التكاليف</Text>
            <Text style={styles.statValue}>{formatCurrency(data.summary?.totalCosts || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>صافي الربح</Text>
            <Text style={styles.statValue}>{formatCurrency(data.summary?.netProfit || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>هامش الربح</Text>
            <Text style={styles.statValue}>{(data.summary?.profitMargin || 0).toFixed(2)}%</Text>
          </View>
        </View>
      </View>

      {data.costs && data.costs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>التكاليف حسب الفئة</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>الفئة</Text>
              <Text style={styles.tableHeaderCell}>المبلغ</Text>
              <Text style={styles.tableHeaderCell}>العدد</Text>
            </View>
            {data.costs.map((cost: any, idx: number) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{cost._id}</Text>
                <Text style={styles.tableCell}>{formatCurrency(cost.paidAmount)}</Text>
                <Text style={styles.tableCell}>{formatNumber(cost.count)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderSessionsReport = () => (
    <>
      {/* البلايستيشن */}
      {data.playstation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جلسات البلايستيشن</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>عدد الجلسات</Text>
              <Text style={styles.statValue}>{formatNumber(data.playstation.totalSessions || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>الإيراد</Text>
              <Text style={styles.statValue}>{formatCurrency(data.playstation.totalRevenue || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>متوسط المدة</Text>
              <Text style={styles.statValue}>{data.playstation.avgDuration || 0} ساعة</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>متوسط الإيراد</Text>
              <Text style={styles.statValue}>{formatCurrency(Number(data.playstation.avgRevenue) || 0)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* الكمبيوتر */}
      {data.computer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جلسات الكمبيوتر</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>عدد الجلسات</Text>
              <Text style={styles.statValue}>{formatNumber(data.computer.totalSessions || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>الإيراد</Text>
              <Text style={styles.statValue}>{formatCurrency(data.computer.totalRevenue || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>متوسط المدة</Text>
              <Text style={styles.statValue}>{data.computer.avgDuration || 0} ساعة</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>متوسط الإيراد</Text>
              <Text style={styles.statValue}>{formatCurrency(Number(data.computer.avgRevenue) || 0)}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );

  const renderInventoryReport = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ملخص المخزون</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي المنتجات</Text>
            <Text style={styles.statValue}>{formatNumber(data.totalItems || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي القيمة</Text>
            <Text style={styles.statValue}>{formatCurrency(data.totalValue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>مخزون منخفض</Text>
            <Text style={styles.statValue}>{formatNumber(data.lowStockItems || 0)}</Text>
          </View>
        </View>
      </View>

      {data.categoryStats && data.categoryStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المخزون حسب الفئة</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>الفئة</Text>
              <Text style={styles.tableHeaderCell}>العدد</Text>
              <Text style={styles.tableHeaderCell}>القيمة</Text>
            </View>
            {data.categoryStats.map((cat: any, idx: number) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{cat._id}</Text>
                <Text style={styles.tableCell}>{formatNumber(cat.itemCount)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(cat.totalValue)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* الرأس */}
        <View style={styles.header}>
          <Text style={styles.title}>{organizationName}</Text>
          <Text style={styles.subtitle}>{getReportTitle()}</Text>
          <Text style={styles.subtitle}>
            من {formatDate(dateRange.startDate)} إلى {formatDate(dateRange.endDate)}
          </Text>
          <Text style={styles.subtitle}>
            تاريخ الطباعة: {formatDate(new Date().toISOString())}
          </Text>
        </View>

        {/* المحتوى */}
        {reportType === 'sales' && renderSalesReport()}
        {reportType === 'financial' && renderFinancialReport()}
        {reportType === 'sessions' && renderSessionsReport()}
        {reportType === 'inventory' && renderInventoryReport()}

        {/* التذييل */}
        <Text style={styles.footer}>
          تم إنشاء هذا التقرير بواسطة نظام Bomba - جميع الحقوق محفوظة © {new Date().getFullYear()}
        </Text>
      </Page>
    </Document>
  );
};
