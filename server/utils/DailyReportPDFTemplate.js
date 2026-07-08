import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// تسجيل خط Amiri - خط عربي من jsDelivr CDN (أسرع وأكثر استقراراً)
Font.register({
  family: 'Amiri',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@4.5.0/files/amiri-arabic-400-normal.woff',
      fontWeight: 'normal'
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@4.5.0/files/amiri-arabic-700-normal.woff',
      fontWeight: 'bold'
    }
  ]
});

// الأنماط - سيتم تحديثها ديناميكياً حسب اللغة
const createStyles = (isRTL) => StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Amiri',
    direction: isRTL ? 'rtl' : 'ltr',
  },
  header: {
    marginBottom: 15,
    textAlign: 'center',
    borderBottom: 2,
    borderBottomColor: '#3498db',
    paddingBottom: 10,
  },
  organizationHeader: {
    marginBottom: 8,
    textAlign: 'center',
  },
  organizationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  title: {
    fontSize: 20,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 8,
    color: '#7f8c8d',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#3498db',
    color: 'white',
    padding: 6,
    textAlign: 'center',
  },
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 22,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#428bca',
    color: 'white',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 4,
    fontSize: 10,
    textAlign: isRTL ? 'right' : 'left',
  },
  tableCellCenter: {
    padding: 4,
    fontSize: 10,
    textAlign: 'center',
  },
  tableCellLabel: {
    flex: 2,
    fontWeight: 'bold',
  },
  tableCellValue: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statCard: {
    width: '31%',
    padding: 8,
    marginHorizontal: '1%',
    marginBottom: 10,
  },
  statBox: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 3,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  profitBox: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 3,
    textAlign: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  profitLabel: {
    fontSize: 11,
    color: '#155724',
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#155724',
  },
  footer: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#7f8c8d',
  },
  col1: { flex: 1 },
  col2: { flex: 2 },
  col3: { flex: 1.5 },
  totalRow: {
    backgroundColor: '#e3f2fd',
    fontWeight: 'bold',
  },
});

// دالة لتنظيف النصوص - تضمن عدم وجود قيم undefined أو null
const cleanText = (text) => {
  if (!text || text === null || text === undefined) return '-';
  const str = typeof text === 'string' ? text : String(text);
  // إزالة المسافات الزائدة والأحرف الخاصة
  const cleaned = str.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return cleaned || '-';
};

// دالة لتنسيق الأرقام
const formatNumber = (num, currentLanguage) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const numStr = String(num);
  
  if (currentLanguage === 'ar') {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return numStr.split('').map(char => {
      if (char >= '0' && char <= '9') {
        return arabicNumerals[parseInt(char)];
      }
      return char;
    }).join('');
  }
  
  return numStr;
};

export const DailyReportPDFDocument = ({ reportData, t, currentLanguage, isRTL, currencySymbol }) => {
  const styles = createStyles(isRTL);
  const { createElement: h } = React;

  // التأكد من وجود البيانات الأساسية
  const safeReportData = {
    organizationName: reportData?.organizationName || '',
    reportPeriod: reportData?.reportPeriod || reportData?.date || '',
    netProfit: reportData?.netProfit || 0,
    totalRevenue: reportData?.totalRevenue || 0,
    totalCosts: reportData?.totalCosts || 0,
    profitMargin: reportData?.profitMargin || 0,
    totalOrders: reportData?.totalOrders || 0,
    totalSessions: reportData?.totalSessions || 0,
    totalBills: reportData?.totalBills || 0,
    revenueByType: {
      cafe: reportData?.revenueByType?.cafe || 0,
      playstation: reportData?.revenueByType?.playstation || 0,
      computer: reportData?.revenueByType?.computer || 0,
    },
    topProducts: reportData?.topProducts || [],
    soldItemsBySection: reportData?.soldItemsBySection || [],
    allSoldItems: reportData?.allSoldItems || [],
  };

  const safeT = t || {};
  const safeCurrency = currencySymbol || 'EGP';

  const pages = [];

  // الصفحة الأولى - الملخص المالي وملخص العمليات والإيرادات حسب النوع
  pages.push(
    h(Page, { key: 'page-1', size: 'A4', style: styles.page }, [
      // اسم المنشأة
      h(View, { key: 'org-header', style: styles.organizationHeader }, [
        h(Text, { key: 'org-name', style: styles.organizationName }, cleanText(safeReportData.organizationName))
      ]),
      
      // العنوان
      h(View, { key: 'header', style: styles.header }, [
        h(Text, { key: 'title', style: styles.title }, cleanText(safeT.dailyReport?.title || 'التقرير اليومي')),
        h(Text, { key: 'period', style: styles.subtitle }, cleanText(safeReportData.reportPeriod))
      ]),
      
      // صافي الربح
      h(View, { key: 'profit', style: styles.profitBox }, [
        h(Text, { key: 'profit-label', style: styles.profitLabel }, cleanText(safeT.dailyReport?.netProfit || 'صافي الربح')),
        h(Text, { key: 'profit-value', style: styles.profitValue }, `${formatNumber(safeReportData.netProfit.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
      ]),
      
      // الملخص المالي - 3 كروت بجانب بعضهم
      h(View, { key: 'financial', style: styles.section }, [
        h(Text, { key: 'fin-title', style: styles.sectionTitle }, cleanText(safeT.dailyReport?.financialSummary || 'الملخص المالي')),
        h(View, { key: 'fin-grid', style: { ...styles.statsGrid, justifyContent: 'space-between' } }, [
          h(View, { key: 'revenue', style: styles.statCard }, [
            h(View, { key: 'revenue-box', style: styles.statBox }, [
              h(Text, { key: 'revenue-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.totalRevenue || 'إجمالي الإيرادات')),
              h(Text, { key: 'revenue-value', style: styles.statValue }, `${formatNumber(safeReportData.totalRevenue.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
            ])
          ]),
          h(View, { key: 'costs', style: styles.statCard }, [
            h(View, { key: 'costs-box', style: styles.statBox }, [
              h(Text, { key: 'costs-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.totalCosts || 'إجمالي المصروفات')),
              h(Text, { key: 'costs-value', style: styles.statValue }, `${formatNumber(safeReportData.totalCosts.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
            ])
          ]),
          h(View, { key: 'margin', style: styles.statCard }, [
            h(View, { key: 'margin-box', style: styles.statBox }, [
              h(Text, { key: 'margin-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.profitMargin || 'هامش الربح')),
              h(Text, { key: 'margin-value', style: styles.statValue }, `${formatNumber(safeReportData.profitMargin.toFixed(1), currentLanguage)}%`)
            ])
          ])
        ])
      ]),
      
      // ملخص العمليات - 3 كروت بجانب بعضهم
      h(View, { key: 'operations', style: styles.section }, [
        h(Text, { key: 'ops-title', style: styles.sectionTitle }, cleanText(safeT.dailyReport?.operationsSummary || 'ملخص العمليات')),
        h(View, { key: 'ops-grid', style: { ...styles.statsGrid, justifyContent: 'space-between' } }, [
          h(View, { key: 'orders', style: styles.statCard }, [
            h(View, { key: 'orders-box', style: styles.statBox }, [
              h(Text, { key: 'orders-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.totalOrders || 'عدد الطلبات')),
              h(Text, { key: 'orders-value', style: styles.statValue }, formatNumber(safeReportData.totalOrders, currentLanguage))
            ])
          ]),
          h(View, { key: 'sessions', style: styles.statCard }, [
            h(View, { key: 'sessions-box', style: styles.statBox }, [
              h(Text, { key: 'sessions-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.totalSessions || 'عدد الجلسات')),
              h(Text, { key: 'sessions-value', style: styles.statValue }, formatNumber(safeReportData.totalSessions, currentLanguage))
            ])
          ]),
          h(View, { key: 'bills', style: styles.statCard }, [
            h(View, { key: 'bills-box', style: styles.statBox }, [
              h(Text, { key: 'bills-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.totalBills || 'إجمالي الفواتير')),
              h(Text, { key: 'bills-value', style: styles.statValue }, formatNumber(safeReportData.totalBills, currentLanguage))
            ])
          ])
        ])
      ]),
      
      // الإيرادات حسب النوع - 3 كروت بجانب بعضهم
      h(View, { key: 'revenue-type', style: styles.section }, [
        h(Text, { key: 'rev-title', style: styles.sectionTitle }, cleanText(safeT.dailyReport?.revenueByType || 'الإيرادات حسب النوع')),
        h(View, { key: 'rev-grid', style: { ...styles.statsGrid, justifyContent: 'space-between' } }, [
          h(View, { key: 'cafe', style: styles.statCard }, [
            h(View, { key: 'cafe-box', style: styles.statBox }, [
              h(Text, { key: 'cafe-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.establishmentRevenue || 'إيرادات المنشأة')),
              h(Text, { key: 'cafe-value', style: styles.statValue }, `${formatNumber(safeReportData.revenueByType.cafe.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
            ])
          ]),
          h(View, { key: 'ps', style: styles.statCard }, [
            h(View, { key: 'ps-box', style: styles.statBox }, [
              h(Text, { key: 'ps-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.playstationRevenue || 'إيرادات البلايستيشن')),
              h(Text, { key: 'ps-value', style: styles.statValue }, `${formatNumber(safeReportData.revenueByType.playstation.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
            ])
          ]),
          h(View, { key: 'pc', style: styles.statCard }, [
            h(View, { key: 'pc-box', style: styles.statBox }, [
              h(Text, { key: 'pc-label', style: styles.statLabel }, cleanText(safeT.dailyReport?.computerRevenue || 'إيرادات الكمبيوتر')),
              h(Text, { key: 'pc-value', style: styles.statValue }, `${formatNumber(safeReportData.revenueByType.computer.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
            ])
          ])
        ])
      ]),
      
      // Footer
      h(Text, { key: 'footer', style: styles.footer, fixed: true }, cleanText(safeT.developedBy || 'تصميم وتطوير: المهندس مصطفى طلعت للحلول البرمجية'))
    ])
  );

  // الصفحة الثانية - المنتجات الأكثر مبيعاً
  if (safeReportData.topProducts.length > 0) {
    // حساب الطول الديناميكي - زيادة الارتفاع لاستيعاب كل المحتوى
    // Header: 150, Table header: 40, Each row: 35, Footer: 80, Padding: 100
    const topProductsPageHeight = 150 + 40 + (safeReportData.topProducts.length * 35) + 80 + 100;
    
    pages.push(
      h(Page, { key: 'page-2', size: [595, topProductsPageHeight], style: styles.page }, [
        h(View, { key: 'org-header2', style: styles.organizationHeader }, [
          h(Text, { key: 'org-name2', style: styles.organizationName }, cleanText(safeReportData.organizationName))
        ]),
        h(View, { key: 'header2', style: styles.header }, [
          h(Text, { key: 'title2', style: styles.title }, cleanText(safeT.dailyReport?.topProducts || 'المنتجات الأكثر مبيعاً'))
        ]),
        h(View, { key: 'products-section', style: styles.section }, [
          h(View, { key: 'products-table', style: styles.table }, [
            h(View, { key: 'prod-header', style: [styles.tableRow, styles.tableHeader] }, [
              h(Text, { key: 'h1', style: [styles.tableCellCenter, styles.col1] }, '#'),
              h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(safeT.dailyReport?.productName || 'اسم المنتج')),
              h(Text, { key: 'h3', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.quantity || 'الكمية')),
              h(Text, { key: 'h4', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.revenue || 'الإيراد'))
            ]),
            ...safeReportData.topProducts.map((product, index) =>
              h(View, { key: `prod-${index}`, style: styles.tableRow }, [
                h(Text, { key: 'num', style: [styles.tableCellCenter, styles.col1] }, formatNumber(index + 1, currentLanguage)),
                h(Text, { key: 'name', style: [styles.tableCell, styles.col2] }, cleanText(product?.name || '')),
                h(Text, { key: 'qty', style: [styles.tableCellCenter, styles.col3] }, formatNumber(product?.quantity || 0, currentLanguage)),
                h(Text, { key: 'rev', style: [styles.tableCellCenter, styles.col3] }, `${formatNumber((product?.revenue || 0).toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
              ])
            )
          ])
        ]),
        h(Text, { key: 'footer2', style: styles.footer, fixed: true }, cleanText(safeT.developedBy || 'تصميم وتطوير: المهندس مصطفى طلعت للحلول البرمجية'))
      ])
    );
  }

  // صفحات الأقسام - جدول لكل قسم من المنيو
  if (safeReportData.soldItemsBySection && safeReportData.soldItemsBySection.length > 0) {
    safeReportData.soldItemsBySection.forEach((section, sectionIndex) => {
      if (section.items && section.items.length > 0) {
        const sectionTotal = section.items.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        const totalQuantity = section.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        
        // حساب الطول الديناميكي للصفحة - زيادة الارتفاع لاستيعاب كل المحتوى
        // Header: 150, Summary box: 120, Table header: 40, Each row: 35, Total row: 40, Footer: 80
        const pageHeight = 150 + 120 + 40 + (section.items.length * 35) + 40 + 80;
        
        pages.push(
          h(Page, { key: `section-${sectionIndex}`, size: [595, pageHeight], style: styles.page }, [
            h(View, { key: `org-header-s${sectionIndex}`, style: styles.organizationHeader }, [
              h(Text, { key: `org-name-s${sectionIndex}`, style: styles.organizationName }, cleanText(safeReportData.organizationName))
            ]),
            h(View, { key: `header-s${sectionIndex}`, style: styles.header }, [
              h(Text, { key: `title-s${sectionIndex}`, style: styles.title }, cleanText(section.sectionName || 'قسم')),
              h(Text, { key: `subtitle-s${sectionIndex}`, style: styles.subtitle }, cleanText(safeReportData.reportPeriod))
            ]),
            
            // صندوق الإجماليات في البداية
            h(View, { key: `summary-s${sectionIndex}`, style: { ...styles.profitBox, backgroundColor: '#e3f2fd', borderColor: '#2196f3' } }, [
              h(View, { key: `summary-grid-s${sectionIndex}`, style: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-around' } }, [
                h(View, { key: `total-rev-s${sectionIndex}`, style: { textAlign: 'center' } }, [
                  h(Text, { key: `total-rev-label-s${sectionIndex}`, style: { ...styles.profitLabel, color: '#1565c0' } }, cleanText(safeT.dailyReport?.sectionTotal || 'إجمالي القسم')),
                  h(Text, { key: `total-rev-value-s${sectionIndex}`, style: { ...styles.profitValue, color: '#1565c0' } }, `${formatNumber(sectionTotal.toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
                ]),
                h(View, { key: `total-qty-s${sectionIndex}`, style: { textAlign: 'center' } }, [
                  h(Text, { key: `total-qty-label-s${sectionIndex}`, style: { ...styles.profitLabel, color: '#1565c0' } }, cleanText(safeT.dailyReport?.totalQuantity || 'إجمالي الكمية')),
                  h(Text, { key: `total-qty-value-s${sectionIndex}`, style: { ...styles.profitValue, color: '#1565c0' } }, formatNumber(totalQuantity, currentLanguage))
                ])
              ])
            ]),
            
            h(View, { key: `section-content-${sectionIndex}`, style: styles.section }, [
              h(View, { key: `section-table-${sectionIndex}`, style: styles.table }, [
                h(View, { key: `sec-header-${sectionIndex}`, style: [styles.tableRow, styles.tableHeader] }, [
                  h(Text, { key: 'h1', style: [styles.tableCellCenter, styles.col1] }, '#'),
                  h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(safeT.dailyReport?.productName || 'اسم المنتج')),
                  h(Text, { key: 'h3', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.quantity || 'الكمية')),
                  h(Text, { key: 'h4', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.revenue || 'الإيراد'))
                ]),
                ...section.items.map((item, itemIndex) =>
                  h(View, { key: `item-${itemIndex}`, style: styles.tableRow }, [
                    h(Text, { key: 'num', style: [styles.tableCellCenter, styles.col1] }, formatNumber(itemIndex + 1, currentLanguage)),
                    h(Text, { key: 'name', style: [styles.tableCell, styles.col2] }, cleanText(item?.name || '')),
                    h(Text, { key: 'qty', style: [styles.tableCellCenter, styles.col3] }, formatNumber(item?.quantity || 0, currentLanguage)),
                    h(Text, { key: 'rev', style: [styles.tableCellCenter, styles.col3] }, `${formatNumber((item?.totalRevenue || 0).toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
                  ])
                )
              ])
            ]),
            h(Text, { key: `footer-s${sectionIndex}`, style: styles.footer, fixed: true }, cleanText(safeT.developedBy || 'تصميم وتطوير: المهندس مصطفى طلعت للحلول البرمجية'))
          ])
        );
      }
    });
  }

  // الصفحة الأخيرة - جميع الأصناف المباعة
  if (safeReportData.allSoldItems && safeReportData.allSoldItems.length > 0) {
    // حساب الطول الديناميكي - زيادة الارتفاع لاستيعاب كل المحتوى
    const allItemsPageHeight = 150 + 40 + (safeReportData.allSoldItems.length * 35) + 80;
    
    pages.push(
      h(Page, { key: 'all-items-page', size: [595, allItemsPageHeight], style: styles.page }, [
        h(View, { key: 'org-header-all', style: styles.organizationHeader }, [
          h(Text, { key: 'org-name-all', style: styles.organizationName }, cleanText(safeReportData.organizationName))
        ]),
        h(View, { key: 'header-all', style: styles.header }, [
          h(Text, { key: 'title-all', style: styles.title }, cleanText(safeT.dailyReport?.allSoldItems || 'جميع الأصناف المباعة')),
          h(Text, { key: 'subtitle-all', style: styles.subtitle }, cleanText(safeReportData.reportPeriod))
        ]),
        h(View, { key: 'all-items-section', style: styles.section }, [
          h(View, { key: 'all-items-table', style: styles.table }, [
            h(View, { key: 'all-header', style: [styles.tableRow, styles.tableHeader] }, [
              h(Text, { key: 'h1', style: [styles.tableCellCenter, styles.col1] }, '#'),
              h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(safeT.dailyReport?.productName || 'اسم المنتج')),
              h(Text, { key: 'h3', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.quantity || 'الكمية')),
              h(Text, { key: 'h4', style: [styles.tableCellCenter, styles.col3] }, cleanText(safeT.dailyReport?.revenue || 'الإيراد'))
            ]),
            ...safeReportData.allSoldItems.map((item, index) =>
              h(View, { key: `all-item-${index}`, style: styles.tableRow }, [
                h(Text, { key: 'num', style: [styles.tableCellCenter, styles.col1] }, formatNumber(index + 1, currentLanguage)),
                h(Text, { key: 'name', style: [styles.tableCell, styles.col2] }, cleanText(item?.name || '')),
                h(Text, { key: 'qty', style: [styles.tableCellCenter, styles.col3] }, formatNumber(item?.quantity || 0, currentLanguage)),
                h(Text, { key: 'rev', style: [styles.tableCellCenter, styles.col3] }, `${formatNumber((item?.totalRevenue || 0).toFixed(2), currentLanguage)} ${cleanText(safeCurrency)}`)
              ])
            )
          ])
        ]),
        h(Text, { key: 'footer-all', style: styles.footer, fixed: true }, cleanText(safeT.developedBy || 'تصميم وتطوير: المهندس مصطفى طلعت للحلول البرمجية'))
      ])
    );
  }

  return h(Document, {}, pages);
};
