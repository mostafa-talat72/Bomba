import React from 'react';
import { getLocaleFromLanguage } from '../utils/localeMapper';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

Font.register({
  family: 'NotoSansArabic',
  fonts: [{ src: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.ttf' }],
});

const styles = StyleSheet.create({
  pageRTL: { padding: 30, fontFamily: 'NotoSansArabic' },
  pageLTR: { padding: 30, fontFamily: 'NotoSansArabic' },
  header: { marginBottom: 20, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#e5e7eb', paddingBottom: 15 },
  title: { fontSize: 24, marginBottom: 10, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 12, color: '#666', marginBottom: 5 },
  section: { marginBottom: 15 },
  sectionTitleRTL: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, backgroundColor: '#f3f4f6', padding: 8, borderRadius: 4, textAlign: 'right' },
  sectionTitleLTR: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, backgroundColor: '#f3f4f6', padding: 8, borderRadius: 4, textAlign: 'left' },
  rowRTL: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  rowLTR: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  labelRTL: { fontSize: 11, color: '#374151', textAlign: 'right' },
  labelLTR: { fontSize: 11, color: '#374151', textAlign: 'left' },
  valueRTL: { fontSize: 11, fontWeight: 'bold', color: '#111827', textAlign: 'left' },
  valueLTR: { fontSize: 11, fontWeight: 'bold', color: '#111827', textAlign: 'right' },
  statsGridRTL: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  statsGridLTR: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  statCard: { width: '48%', padding: 10, backgroundColor: '#f9fafb', borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  statLabelRTL: { fontSize: 10, color: '#6b7280', marginBottom: 4, textAlign: 'right' },
  statLabelLTR: { fontSize: 10, color: '#6b7280', marginBottom: 4, textAlign: 'left' },
  statValueRTL: { fontSize: 14, fontWeight: 'bold', color: '#111827', textAlign: 'right' },
  statValueLTR: { fontSize: 14, fontWeight: 'bold', color: '#111827', textAlign: 'left' },
  table: { marginTop: 10 },
  tableHeaderRTL: { flexDirection: 'row-reverse', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 4, marginBottom: 5 },
  tableHeaderLTR: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 4, marginBottom: 5 },
  tableHeaderCell: { fontSize: 10, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  tableRowRTL: { flexDirection: 'row-reverse', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tableRowLTR: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tableCell: { fontSize: 9, flex: 1, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 9, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10 },
  subsectionTitleRTL: { fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginTop: 10, textAlign: 'right' },
  subsectionTitleLTR: { fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginTop: 10, textAlign: 'left' },
});

interface ReportPDFProps {
  reportType: 'sales' | 'financial' | 'sessions' | 'inventory';
  data: any;
  dateRange: { startDate: string; endDate: string };
  organizationName?: string;
  language?: string;
  translations?: any;
}

export const ReportPDF: React.FC<ReportPDFProps> = ({ reportType, data, dateRange, organizationName = 'Bomba', language = 'ar', translations = (key: string) => key }) => {
  const isRTL = language === 'ar';
  const t = translations;
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = getLocaleFromLanguage(language);
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  const formatCurrency = (amount: number) => {
    const currency = localStorage.getItem('organizationCurrency') || 'EGP';
    return formatCurrencyUtil(amount, language, currency);
  };
  const formatNumber = (num: number) => formatDecimal(num, language);
  
  const getReportTitle = () => {
    const titles: Record<string, string> = {
      sales: t('reports.pdf.titles.sales'),
      financial: t('reports.pdf.titles.financial'),
      sessions: t('reports.pdf.titles.sessions'),
      inventory: t('reports.pdf.titles.inventory')
    };
    return titles[reportType] || t('reports.pdf.titles.report');
  };

  const renderSalesReport = () => (
    <>
      <View style={styles.section}>
        <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.basicStats')}</Text>
        <View style={isRTL ? styles.statsGridRTL : styles.statsGridLTR}>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.totalRevenue')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.totalRevenue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.totalOrders')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.totalOrders || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.totalSessions')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.totalSessions || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.avgOrderValue')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.avgOrderValue || 0)}</Text>
          </View>
        </View>
      </View>
      {data.revenueByType && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.revenueDistribution')}</Text>
          <View style={isRTL ? styles.rowRTL : styles.rowLTR}>
            <Text style={isRTL ? styles.labelRTL : styles.labelLTR}>{t('reports.pdf.labels.playstation')}</Text>
            <Text style={isRTL ? styles.valueRTL : styles.valueLTR}>{formatCurrency(data.revenueByType.playstation || 0)}</Text>
          </View>
          <View style={isRTL ? styles.rowRTL : styles.rowLTR}>
            <Text style={isRTL ? styles.labelRTL : styles.labelLTR}>{t('reports.pdf.labels.computer')}</Text>
            <Text style={isRTL ? styles.valueRTL : styles.valueLTR}>{formatCurrency(data.revenueByType.computer || 0)}</Text>
          </View>
          <View style={isRTL ? styles.rowRTL : styles.rowLTR}>
            <Text style={isRTL ? styles.labelRTL : styles.labelLTR}>{t('reports.pdf.labels.orders')}</Text>
            <Text style={isRTL ? styles.valueRTL : styles.valueLTR}>{formatCurrency(data.revenueByType.cafe || 0)}</Text>
          </View>
        </View>
      )}
      {data.topProductsBySection && data.topProductsBySection.length > 0 && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.topProducts')}</Text>
          {data.topProductsBySection.map((section: any, idx: number) => (
            <View key={idx} style={{ marginBottom: 15 }}>
              <Text style={isRTL ? styles.subsectionTitleRTL : styles.subsectionTitleLTR}>{section.sectionName}</Text>
              <View style={styles.table}>
                <View style={isRTL ? styles.tableHeaderRTL : styles.tableHeaderLTR}>
                  <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.product')}</Text>
                  <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.quantity')}</Text>
                  <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.revenue')}</Text>
                </View>
                {section.products.slice(0, 5).map((product: any, pIdx: number) => (
                  <View key={pIdx} style={isRTL ? styles.tableRowRTL : styles.tableRowLTR}>
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
      {data.staffPerformance && data.staffPerformance.length > 0 && (
        <View style={styles.section} break>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.staffPerformance')}</Text>
          <View style={styles.table}>
            <View style={isRTL ? styles.tableHeaderRTL : styles.tableHeaderLTR}>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.staff')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.orders')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.sessions')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.revenue')}</Text>
            </View>
            {data.staffPerformance.slice(0, 10).map((staff: any, idx: number) => (
              <View key={idx} style={isRTL ? styles.tableRowRTL : styles.tableRowLTR}>
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
        <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.financialSummary')}</Text>
        <View style={isRTL ? styles.statsGridRTL : styles.statsGridLTR}>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.totalRevenue')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.summary?.totalRevenue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.totalCosts')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.summary?.totalCosts || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.netProfit')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.summary?.netProfit || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.stats.profitMargin')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{(data.summary?.profitMargin || 0).toFixed(2)}%</Text>
          </View>
        </View>
      </View>
      {data.costs && data.costs.length > 0 && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.costsByCategory')}</Text>
          <View style={styles.table}>
            <View style={isRTL ? styles.tableHeaderRTL : styles.tableHeaderLTR}>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.category')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.amount')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.count')}</Text>
            </View>
            {data.costs.map((cost: any, idx: number) => (
              <View key={idx} style={isRTL ? styles.tableRowRTL : styles.tableRowLTR}>
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
      {data.playstation && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.playstationSessions')}</Text>
          <View style={isRTL ? styles.statsGridRTL : styles.statsGridLTR}>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.sessionsCount')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.playstation.totalSessions || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.revenue')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.playstation.totalRevenue || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.avgDuration')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{data.playstation.avgDuration || 0} {t('reports.labels.hours')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.avgRevenue')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(Number(data.playstation.avgRevenue) || 0)}</Text>
            </View>
          </View>
        </View>
      )}
      {data.computer && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.computerSessions')}</Text>
          <View style={isRTL ? styles.statsGridRTL : styles.statsGridLTR}>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.sessionsCount')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.computer.totalSessions || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.revenue')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.computer.totalRevenue || 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.avgDuration')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{data.computer.avgDuration || 0} {t('reports.labels.hours')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.labels.avgRevenue')}</Text>
              <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(Number(data.computer.avgRevenue) || 0)}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );

  const renderInventoryReport = () => (
    <>
      <View style={styles.section}>
        <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.inventorySummary')}</Text>
        <View style={isRTL ? styles.statsGridRTL : styles.statsGridLTR}>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.inventorySummary.totalProducts')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.totalItems || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.inventorySummary.totalValue')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatCurrency(data.totalValue || 0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={isRTL ? styles.statLabelRTL : styles.statLabelLTR}>{t('reports.inventorySummary.lowStock')}</Text>
            <Text style={isRTL ? styles.statValueRTL : styles.statValueLTR}>{formatNumber(data.lowStockItems || 0)}</Text>
          </View>
        </View>
      </View>
      {data.categoryStats && data.categoryStats.length > 0 && (
        <View style={styles.section}>
          <Text style={isRTL ? styles.sectionTitleRTL : styles.sectionTitleLTR}>{t('reports.pdf.sections.inventoryByCategory')}</Text>
          <View style={styles.table}>
            <View style={isRTL ? styles.tableHeaderRTL : styles.tableHeaderLTR}>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.category')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.count')}</Text>
              <Text style={styles.tableHeaderCell}>{t('reports.pdf.tableHeaders.value')}</Text>
            </View>
            {data.categoryStats.map((cat: any, idx: number) => (
              <View key={idx} style={isRTL ? styles.tableRowRTL : styles.tableRowLTR}>
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
      <Page size="A4" style={isRTL ? styles.pageRTL : styles.pageLTR}>
        <View style={styles.header}>
          <Text style={styles.title}>{organizationName}</Text>
          <Text style={styles.subtitle}>{getReportTitle()}</Text>
          <Text style={styles.subtitle}>{t('reports.pdf.dateRange', { start: formatDate(dateRange.startDate), end: formatDate(dateRange.endDate) })}</Text>
          <Text style={styles.subtitle}>{t('reports.pdf.printDate')}: {formatDate(new Date().toISOString())}</Text>
        </View>
        {reportType === 'sales' && renderSalesReport()}
        {reportType === 'financial' && renderFinancialReport()}
        {reportType === 'sessions' && renderSessionsReport()}
        {reportType === 'inventory' && renderInventoryReport()}
        <Text style={styles.footer}>{t('reports.pdf.footer', { year: new Date().getFullYear() })}</Text>
      </Page>
    </Document>
  );
};
