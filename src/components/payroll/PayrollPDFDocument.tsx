import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

// تسجيل خط Vazir - يدعم العربية والفارسية واللاتينية بشكل ممتاز
Font.register({
  family: 'Vazir',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir-Bold.ttf',
      fontWeight: 700,
    }
  ]
});

// الأنماط - سيتم تحديثها ديناميكياً حسب اللغة
const createStyles = (isRTL: boolean) => StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Vazir',
    direction: isRTL ? 'rtl' : 'ltr',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#3498db',
    color: 'white',
    padding: 8,
    textAlign: 'center',
  },
  table: {
    width: '100%',
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 30,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#428bca',
    color: 'white',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 5,
    fontSize: 10,
    textAlign: isRTL ? 'right' : 'left',
  },
  tableCellLabel: {
    flex: 2,
    fontWeight: 'bold',
  },
  tableCellValue: {
    flex: 1,
  },
  employeeTable: {
    marginTop: 10,
  },
  employeeRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 25,
    alignItems: 'center',
  },
  employeeCell: {
    padding: 4,
    fontSize: 9,
    textAlign: 'center',
  },
  col1: { flex: 2 },
  col2: { flex: 1.5 },
  col3: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
  },
});

interface PayrollPDFProps {
  data: {
    month: string;
    year: number;
    totalEmployees: number;
    statistics: {
      totalGrossSalary: number;
      totalDeductions: number;
      totalNetSalary: number;
      totalPaid: number;
      totalUnpaid: number;
      totalUnpaidCurrentMonth: number;
      totalCarriedForward: number;
    };
    employees: Array<{
      employeeName: string;
      department: string;
      grossSalary: number;
      deductions: number;
      netSalary: number;
      paidAmount: number;
      unpaidBalance: number;
      carriedForward: number;
      totalUnpaid: number;
    }>;
  };
  monthName: string;
  t: any; // Translation function
  currentLanguage: string;
  isRTL: boolean;
}

const PayrollPDFDocument: React.FC<PayrollPDFProps> = ({ data, monthName, t, currentLanguage, isRTL }) => {
  const styles = createStyles(isRTL);

  // دالة لتنسيق الأرقام حسب اللغة
  const formatNumber = (num: number | string) => {
    if (currentLanguage === 'ar') {
      const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
    }
    return String(num);
  };

  // دالة لتنظيف النصوص - تضمن عرض البيانات من قاعدة البيانات بشكل صحيح
  const cleanText = (text: any) => {
    if (!text || text === null || text === undefined) return '-';
    // تأكد من أن النص هو string وليس object
    const str = typeof text === 'string' ? text : String(text);
    // إزالة المسافات الزائدة وإرجاع النص أو '-' إذا كان فارغاً
    const cleaned = str.trim();
    return cleaned || '-';
  };

  const getDepartmentName = (dept: string) => {
    if (!dept) return '-';
    const cleanDept = cleanText(dept);
    if (cleanDept === '-') return '-';
    
    // Map department names to translations manually
    const departmentTranslations: Record<string, Record<string, string>> = {
      'ar': {
        'management': 'الإدارة',
        'sales': 'المبيعات',
        'kitchen': 'المطبخ',
        'service': 'الخدمة',
        'maintenance': 'الصيانة',
        'accounting': 'المحاسبة',
        'hr': 'الموارد البشرية',
        'it': 'تكنولوجيا المعلومات',
        'security': 'الأمن',
        'cleaning': 'النظافة',
        'other': 'أخرى'
      },
      'en': {
        'management': 'Management',
        'sales': 'Sales',
        'kitchen': 'Kitchen',
        'service': 'Service',
        'maintenance': 'Maintenance',
        'accounting': 'Accounting',
        'hr': 'Human Resources',
        'it': 'IT',
        'security': 'Security',
        'cleaning': 'Cleaning',
        'other': 'Other'
      },
      'fr': {
        'management': 'Gestion',
        'sales': 'Ventes',
        'kitchen': 'Cuisine',
        'service': 'Service',
        'maintenance': 'Maintenance',
        'accounting': 'Comptabilité',
        'hr': 'Ressources Humaines',
        'it': 'Informatique',
        'security': 'Sécurité',
        'cleaning': 'Nettoyage',
        'other': 'Autre'
      }
    };
    
    return departmentTranslations[currentLanguage]?.[cleanDept] || cleanDept;
  };

  return (
  <Document>
    {/* الصفحة الأولى - الإحصائيات */}
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('payroll.payrollPDF.comprehensivePayroll')}</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* جدول الإحصائيات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('payroll.payrollPDF.generalStatistics')}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.item')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>{t('payroll.payrollPDF.value')}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.employeeCount')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>{formatNumber(data.totalEmployees)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.totalGross')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalGrossSalary.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.totalDeductions')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalDeductions.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.netDue')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalNetSalary.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.paid')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalPaid.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.remainingCurrentMonth')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalUnpaidCurrentMonth.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.carriedForward')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalCarriedForward.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{t('payroll.payrollPDF.totalDue')}</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {formatNumber(data.statistics.totalUnpaid.toFixed(2))} {t('common.currency')}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `${t('payroll.employeeProfile.pdfReport.page')} ${formatNumber(pageNumber)} ${t('common.from')} ${formatNumber(totalPages)}`
      )} fixed />
    </Page>

    {/* الصفحة الثانية - تفاصيل الموظفين */}
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('payroll.payrollPDF.employeeDetails')}</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* جدول الموظفين */}
      <View style={styles.section}>
        <View style={styles.employeeTable}>
          <View style={[styles.employeeRow, styles.tableHeader]}>
            <Text style={[styles.employeeCell, styles.col1]}>{t('payroll.payrollPDF.employee')}</Text>
            <Text style={[styles.employeeCell, styles.col2]}>{t('payroll.payrollPDF.department')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.gross')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.deductions')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.net')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.paid')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.remaining')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.carried')}</Text>
            <Text style={[styles.employeeCell, styles.col3]}>{t('payroll.payrollPDF.total')}</Text>
          </View>
          {data.employees.map((emp, index) => (
            <View key={index} style={styles.employeeRow}>
              <Text style={[styles.employeeCell, styles.col1]}>{cleanText(emp.employeeName)}</Text>
              <Text style={[styles.employeeCell, styles.col2]}>{getDepartmentName(emp.department)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.grossSalary.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.deductions.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.netSalary.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.paidAmount.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.unpaidBalance.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.carriedForward.toFixed(2))}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{formatNumber(emp.totalUnpaid.toFixed(2))}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `${t('payroll.employeeProfile.pdfReport.page')} ${formatNumber(pageNumber)} ${t('common.from')} ${formatNumber(totalPages)}`
      )} fixed />
    </Page>
  </Document>
  );
};

export default PayrollPDFDocument;
