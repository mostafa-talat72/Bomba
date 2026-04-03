import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { pdfTranslations } from './pdfTranslations.js';
import { getCurrencySymbol, getLocaleFromLanguage } from './localeHelper.js';

// تسجيل خط عربي - Noto Sans Arabic
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
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#667eea',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#667eea',
  },
  organizationName: {
    fontSize: 18,
    marginBottom: 8,
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 4,
    textAlign: 'right',
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statCardFull: {
    width: '100%',
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4caf50',
    marginBottom: 15,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 5,
    textAlign: 'right',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  statValueLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'right',
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#667eea',
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'right',
  },
  tableCellNumber: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'left',
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    textAlign: 'right',
  },
  sectionHeaderValue: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'left',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
});

/**
 * Generate PDF buffer for daily report
 * @param {Object} reportData - Report data
 * @param {string} language - Language code (ar, en, fr)
 * @param {string} currency - Currency code (EGP, USD, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateDailyReportPDF = async (reportData, language = 'ar', currency = 'EGP') => {
    try {
        console.log('📄 Generating PDF with @react-pdf/renderer...', { language, currency });
        
        const { createElement: h } = React;
        
        // Get translations and currency symbol
        const t = pdfTranslations[language] || pdfTranslations.ar;
        const currencySymbol = getCurrencySymbol(currency, language);
        const locale = getLocaleFromLanguage(language);
        const isRTL = language === 'ar';
        
        // Helper to format numbers based on locale
        const formatNumber = (num) => {
            return Number(num || 0).toLocaleString(locale, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        };
        
        // Helper to create table rows for products
        const createProductRows = (products) => {
            return products.slice(0, 10).map((product, index) =>
                h(View, {
                    key: `product-${index}`,
                    style: [styles.tableRow, index % 2 === 0 ? styles.tableRowEven : {}]
                }, [
                    h(Text, { key: `num-${index}`, style: [styles.tableCell, { width: '10%' }] }, index + 1),
                    h(Text, { key: `name-${index}`, style: [styles.tableCell, { width: '50%' }] }, product.name),
                    h(Text, { key: `qty-${index}`, style: [styles.tableCellNumber, { width: '20%' }] }, product.quantity),
                    h(Text, { key: `rev-${index}`, style: [styles.tableCellNumber, { width: '20%' }] }, formatNumber(product.revenue || 0))
                ])
            );
        };

        // Create pages array
        const pages = [];

        // Page 1: Main Report
        pages.push(
            h(Page, { size: 'A4', style: styles.page }, [
                // Header
                h(View, { style: styles.header }, [
                    h(Text, { key: 'title', style: styles.title }, t.dailyReport.title),
                    h(Text, { key: 'org', style: styles.organizationName }, reportData.organizationName),
                    h(Text, { key: 'period', style: styles.subtitle }, reportData.reportPeriod || reportData.date)
                ]),

                // Net Profit - Highlighted
                h(View, { style: styles.statCardFull }, [
                    h(Text, { key: 'profit-label', style: styles.statLabel }, t.dailyReport.netProfit),
                    h(Text, { key: 'profit-value', style: styles.statValueLarge }, `${formatNumber(reportData.netProfit || 0)} ${currencySymbol}`)
                ]),

                // Financial Summary
                h(View, { style: styles.section }, [
                    h(Text, { key: 'fin-title', style: styles.sectionTitle }, t.dailyReport.financialSummary),
                    h(View, { key: 'fin-grid', style: styles.statsGrid }, [
                        h(View, { key: 'revenue-card', style: styles.statCard }, [
                            h(Text, { key: 'revenue-label', style: styles.statLabel }, t.dailyReport.totalRevenue),
                            h(Text, { key: 'revenue-value', style: styles.statValue }, `${formatNumber(reportData.totalRevenue || 0)} ${currencySymbol}`)
                        ]),
                        h(View, { key: 'costs-card', style: styles.statCard }, [
                            h(Text, { key: 'costs-label', style: styles.statLabel }, t.dailyReport.totalCosts),
                            h(Text, { key: 'costs-value', style: styles.statValue }, `${formatNumber(reportData.totalCosts || 0)} ${currencySymbol}`)
                        ])
                    ])
                ]),

                // Operations Summary
                h(View, { style: styles.section }, [
                    h(Text, { key: 'ops-title', style: styles.sectionTitle }, t.dailyReport.operationsSummary),
                    h(View, { key: 'ops-grid', style: styles.statsGrid }, [
                        h(View, { key: 'orders-card', style: styles.statCard }, [
                            h(Text, { key: 'orders-label', style: styles.statLabel }, t.dailyReport.totalOrders),
                            h(Text, { key: 'orders-value', style: styles.statValue }, reportData.totalOrders || 0)
                        ]),
                        h(View, { key: 'sessions-card', style: styles.statCard }, [
                            h(Text, { key: 'sessions-label', style: styles.statLabel }, t.dailyReport.totalSessions),
                            h(Text, { key: 'sessions-value', style: styles.statValue }, reportData.totalSessions || 0)
                        ]),
                        h(View, { key: 'bills-card', style: styles.statCard }, [
                            h(Text, { key: 'bills-label', style: styles.statLabel }, t.dailyReport.totalBills),
                            h(Text, { key: 'bills-value', style: styles.statValue }, reportData.totalBills || 0)
                        ])
                    ])
                ]),

                // Revenue Breakdown
                reportData.revenueByType && h(View, { style: styles.section }, [
                    h(Text, { key: 'rev-title', style: styles.sectionTitle }, t.dailyReport.revenueBreakdown),
                    h(View, { key: 'rev-grid', style: styles.statsGrid }, [
                        h(View, { key: 'ps-card', style: styles.statCard }, [
                            h(Text, { key: 'ps-label', style: styles.statLabel }, t.dailyReport.playstation),
                            h(Text, { key: 'ps-value', style: styles.statValue }, `${formatNumber(reportData.revenueByType.playstation || 0)} ${currencySymbol}`)
                        ]),
                        h(View, { key: 'pc-card', style: styles.statCard }, [
                            h(Text, { key: 'pc-label', style: styles.statLabel }, t.dailyReport.computer),
                            h(Text, { key: 'pc-value', style: styles.statValue }, `${formatNumber(reportData.revenueByType.computer || 0)} ${currencySymbol}`)
                        ]),
                        h(View, { key: 'cafe-card', style: styles.statCard }, [
                            h(Text, { key: 'cafe-label', style: styles.statLabel }, t.dailyReport.cafe),
                            h(Text, { key: 'cafe-value', style: styles.statValue }, `${formatNumber(reportData.revenueByType.cafe || 0)} ${currencySymbol}`)
                        ])
                    ])
                ]),

                // Top Products
                reportData.topProducts && reportData.topProducts.length > 0 && h(View, { style: styles.section }, [
                    h(Text, { key: 'top-title', style: styles.sectionTitle }, t.dailyReport.topProducts),
                    h(View, { key: 'top-table', style: styles.table }, [
                        h(View, { key: 'top-header', style: styles.tableHeader }, [
                            h(Text, { key: 'h-num', style: [styles.tableHeaderText, { width: '10%' }] }, t.dailyReport.number),
                            h(Text, { key: 'h-prod', style: [styles.tableHeaderText, { width: '50%' }] }, t.dailyReport.product),
                            h(Text, { key: 'h-qty', style: [styles.tableHeaderText, { width: '20%' }] }, t.dailyReport.quantity),
                            h(Text, { key: 'h-rev', style: [styles.tableHeaderText, { width: '20%' }] }, t.dailyReport.revenue)
                        ]),
                        ...createProductRows(reportData.topProducts)
                    ])
                ]),

                // Footer
                h(View, { style: styles.footer }, [
                    h(Text, { key: 'footer-date' }, `${t.dailyReport.createdAt}: ${new Date().toLocaleString(locale)}`),
                    h(Text, { key: 'footer-copy' }, `© ${new Date().getFullYear()} ${t.dailyReport.copyright}`)
                ])
            ])
        );

        // Page 2: Products by Section (if available)
        if (reportData.topProductsBySection && reportData.topProductsBySection.length > 0) {
            pages.push(
                h(Page, { key: 'page-2', size: 'A4', style: styles.page }, [
                    // Header
                    h(View, { key: 'p2-header', style: styles.header }, [
                        h(Text, { key: 'p2-title', style: styles.title }, t.dailyReport.productsBySections),
                        h(Text, { key: 'p2-org', style: styles.subtitle }, reportData.organizationName)
                    ]),

                    // Sections
                    ...reportData.topProductsBySection.map((section, sectionIndex) =>
                        h(View, { key: `section-${sectionIndex}`, style: styles.section }, [
                            h(View, { key: `sec-header-${sectionIndex}`, style: styles.sectionHeader }, [
                                h(Text, { key: `sec-name-${sectionIndex}`, style: styles.sectionHeaderTitle }, section.sectionName),
                                h(Text, { key: `sec-rev-${sectionIndex}`, style: styles.sectionHeaderValue }, `${formatNumber(section.totalRevenue)} ${currencySymbol}`)
                            ]),
                            h(View, { key: `sec-table-${sectionIndex}`, style: styles.table }, [
                                h(View, { key: `sec-thead-${sectionIndex}`, style: styles.tableHeader }, [
                                    h(Text, { key: `sh-num-${sectionIndex}`, style: [styles.tableHeaderText, { width: '10%' }] }, t.dailyReport.number),
                                    h(Text, { key: `sh-prod-${sectionIndex}`, style: [styles.tableHeaderText, { width: '50%' }] }, t.dailyReport.product),
                                    h(Text, { key: `sh-qty-${sectionIndex}`, style: [styles.tableHeaderText, { width: '20%' }] }, t.dailyReport.quantity),
                                    h(Text, { key: `sh-rev-${sectionIndex}`, style: [styles.tableHeaderText, { width: '20%' }] }, t.dailyReport.revenue)
                                ]),
                                ...section.products.slice(0, 5).map((product, index) =>
                                    h(View, {
                                        key: `sec-${sectionIndex}-prod-${index}`,
                                        style: [styles.tableRow, index % 2 === 0 ? styles.tableRowEven : {}]
                                    }, [
                                        h(Text, { key: `sp-num-${sectionIndex}-${index}`, style: [styles.tableCell, { width: '10%' }] }, index + 1),
                                        h(Text, { key: `sp-name-${sectionIndex}-${index}`, style: [styles.tableCell, { width: '50%' }] }, product.name),
                                        h(Text, { key: `sp-qty-${sectionIndex}-${index}`, style: [styles.tableCellNumber, { width: '20%' }] }, product.quantity),
                                        h(Text, { key: `sp-rev-${sectionIndex}-${index}`, style: [styles.tableCellNumber, { width: '20%' }] }, formatNumber(product.revenue))
                                    ])
                                )
                            ])
                        ])
                    ),

                    // Footer
                    h(View, { key: 'p2-footer', style: styles.footer }, [
                        h(Text, { key: 'p2-footer-date' }, `${t.dailyReport.createdAt}: ${new Date().toLocaleString(locale)}`),
                        h(Text, { key: 'p2-footer-copy' }, `© ${new Date().getFullYear()} ${t.dailyReport.copyright}`)
                    ])
                ])
            );
        }

        // Create document with all pages
        const doc = h(Document, null, pages);
        
        // Render to buffer
        const pdfBuffer = await renderToBuffer(doc);
        
        console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        
        return pdfBuffer;
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        throw new Error(`Failed to generate PDF: ${error.message}`);
    }
};
