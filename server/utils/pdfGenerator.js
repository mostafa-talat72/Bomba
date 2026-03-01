import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

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
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateDailyReportPDF = async (reportData) => {
    try {
        console.log('📄 Generating PDF with @react-pdf/renderer...');
        
        const { createElement: h } = React;
        
        // Helper to create table rows for products
        const createProductRows = (products) => {
            return products.slice(0, 10).map((product, index) =>
                h(View, {
                    key: index,
                    style: [styles.tableRow, index % 2 === 0 ? styles.tableRowEven : {}]
                }, [
                    h(Text, { style: [styles.tableCell, { width: '10%' }] }, index + 1),
                    h(Text, { style: [styles.tableCell, { width: '50%' }] }, product.name),
                    h(Text, { style: [styles.tableCellNumber, { width: '20%' }] }, product.quantity),
                    h(Text, { style: [styles.tableCellNumber, { width: '20%' }] }, (product.revenue || 0).toFixed(2))
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
                    h(Text, { style: styles.title }, 'التقرير اليومي'),
                    h(Text, { style: styles.organizationName }, reportData.organizationName),
                    h(Text, { style: styles.subtitle }, reportData.reportPeriod || reportData.date)
                ]),

                // Net Profit - Highlighted
                h(View, { style: styles.statCardFull }, [
                    h(Text, { style: styles.statLabel }, 'صافي الربح'),
                    h(Text, { style: styles.statValueLarge }, `${(reportData.netProfit || 0).toFixed(2)} ج.م`)
                ]),

                // Financial Summary
                h(View, { style: styles.section }, [
                    h(Text, { style: styles.sectionTitle }, 'الملخص المالي'),
                    h(View, { style: styles.statsGrid }, [
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, 'إجمالي الإيرادات'),
                            h(Text, { style: styles.statValue }, `${(reportData.totalRevenue || 0).toFixed(2)} ج.م`)
                        ]),
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, 'إجمالي التكاليف'),
                            h(Text, { style: styles.statValue }, `${(reportData.totalCosts || 0).toFixed(2)} ج.م`)
                        ])
                    ])
                ]),

                // Operations Summary
                h(View, { style: styles.section }, [
                    h(Text, { style: styles.sectionTitle }, 'ملخص العمليات'),
                    h(View, { style: styles.statsGrid }, [
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, 'عدد الطلبات'),
                            h(Text, { style: styles.statValue }, reportData.totalOrders || 0)
                        ]),
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, 'عدد الجلسات'),
                            h(Text, { style: styles.statValue }, reportData.totalSessions || 0)
                        ]),
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, 'إجمالي الفواتير'),
                            h(Text, { style: styles.statValue }, reportData.totalBills || 0)
                        ])
                    ])
                ]),

                // Revenue Breakdown
                reportData.revenueByType && h(View, { style: styles.section }, [
                    h(Text, { style: styles.sectionTitle }, 'تفصيل الإيرادات'),
                    h(View, { style: styles.statsGrid }, [
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, '🎮 بلايستيشن'),
                            h(Text, { style: styles.statValue }, `${(reportData.revenueByType.playstation || 0).toFixed(2)} ج.م`)
                        ]),
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, '💻 كمبيوتر'),
                            h(Text, { style: styles.statValue }, `${(reportData.revenueByType.computer || 0).toFixed(2)} ج.م`)
                        ]),
                        h(View, { style: styles.statCard }, [
                            h(Text, { style: styles.statLabel }, '☕ كافيه'),
                            h(Text, { style: styles.statValue }, `${(reportData.revenueByType.cafe || 0).toFixed(2)} ج.م`)
                        ])
                    ])
                ]),

                // Top Products
                reportData.topProducts && reportData.topProducts.length > 0 && h(View, { style: styles.section }, [
                    h(Text, { style: styles.sectionTitle }, 'المنتجات الأكثر مبيعاً'),
                    h(View, { style: styles.table }, [
                        h(View, { style: styles.tableHeader }, [
                            h(Text, { style: [styles.tableHeaderText, { width: '10%' }] }, '#'),
                            h(Text, { style: [styles.tableHeaderText, { width: '50%' }] }, 'المنتج'),
                            h(Text, { style: [styles.tableHeaderText, { width: '20%' }] }, 'الكمية'),
                            h(Text, { style: [styles.tableHeaderText, { width: '20%' }] }, 'الإيراد')
                        ]),
                        ...createProductRows(reportData.topProducts)
                    ])
                ]),

                // Footer
                h(View, { style: styles.footer }, [
                    h(Text, null, `تم إنشاء التقرير في: ${new Date().toLocaleString('ar-EG')}`),
                    h(Text, null, `© ${new Date().getFullYear()} نظام Bomba - جميع الحقوق محفوظة`)
                ])
            ])
        );

        // Page 2: Products by Section (if available)
        if (reportData.topProductsBySection && reportData.topProductsBySection.length > 0) {
            pages.push(
                h(Page, { size: 'A4', style: styles.page }, [
                    // Header
                    h(View, { style: styles.header }, [
                        h(Text, { style: styles.title }, 'المنتجات حسب الأقسام'),
                        h(Text, { style: styles.subtitle }, reportData.organizationName)
                    ]),

                    // Sections
                    ...reportData.topProductsBySection.map((section, sectionIndex) =>
                        h(View, { key: sectionIndex, style: styles.section }, [
                            h(View, { style: styles.sectionHeader }, [
                                h(Text, { style: styles.sectionHeaderTitle }, section.sectionName),
                                h(Text, { style: styles.sectionHeaderValue }, `${section.totalRevenue.toFixed(2)} ج.م`)
                            ]),
                            h(View, { style: styles.table }, [
                                h(View, { style: styles.tableHeader }, [
                                    h(Text, { style: [styles.tableHeaderText, { width: '10%' }] }, '#'),
                                    h(Text, { style: [styles.tableHeaderText, { width: '50%' }] }, 'المنتج'),
                                    h(Text, { style: [styles.tableHeaderText, { width: '20%' }] }, 'الكمية'),
                                    h(Text, { style: [styles.tableHeaderText, { width: '20%' }] }, 'الإيراد')
                                ]),
                                ...section.products.slice(0, 5).map((product, index) =>
                                    h(View, {
                                        key: index,
                                        style: [styles.tableRow, index % 2 === 0 ? styles.tableRowEven : {}]
                                    }, [
                                        h(Text, { style: [styles.tableCell, { width: '10%' }] }, index + 1),
                                        h(Text, { style: [styles.tableCell, { width: '50%' }] }, product.name),
                                        h(Text, { style: [styles.tableCellNumber, { width: '20%' }] }, product.quantity),
                                        h(Text, { style: [styles.tableCellNumber, { width: '20%' }] }, product.revenue.toFixed(2))
                                    ])
                                )
                            ])
                        ])
                    ),

                    // Footer
                    h(View, { style: styles.footer }, [
                        h(Text, null, `تم إنشاء التقرير في: ${new Date().toLocaleString('ar-EG')}`),
                        h(Text, null, `© ${new Date().getFullYear()} نظام Bomba - جميع الحقوق محفوظة`)
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
