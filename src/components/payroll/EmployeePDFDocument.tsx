import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import dayjs from 'dayjs';
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
    borderBottom: 2,
    borderBottomColor: '#3498db',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    marginBottom: 5,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
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
  infoGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  infoItem: {
    width: '50%',
    padding: 5,
  },
  infoLabel: {
    fontSize: 10,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2c3e50',
    wordBreak: 'break-word',
  },
  statsGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  statCard: {
    width: '33.33%',
    padding: 5,
  },
  statBox: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  table: {
    width: '100%',
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#34495e',
    color: 'white',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 4,
    fontSize: 9,
    textAlign: 'center',
  },
  col1: { flex: 1.5 },
  col2: { flex: 1 },
  col3: { flex: 1 },
  col4: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#7f8c8d',
  },
});

interface EmployeePDFProps {
  employee: any;
  monthName: string;
  stats: {
    currentMonthSalary: number;
    currentMonthAdvances: number;
    currentMonthDeductions: number;
    currentMonthPaid: number;
    carriedForward: number;
    remainingBalance: number;
    attendanceDays: number;
  };
  attendance: any[];
  advances: any[];
  deductions: any[];
  payments: any[];
  t: any; // Translation function
  currentLanguage: string;
  isRTL: boolean;
  currency: string; // Dynamic currency symbol
}

const EmployeePDFDocument: React.FC<EmployeePDFProps> = ({
  employee,
  monthName,
  stats,
  attendance,
  advances,
  deductions,
  payments,
  t,
  currentLanguage,
  isRTL,
  currency,
}) => {
  const styles = createStyles(isRTL);

  // دالة لتنظيف النصوص وتجنب المشاكل - تضمن عرض البيانات من قاعدة البيانات بشكل صحيح
  const cleanText = (text: any) => {
    if (!text || text === null || text === undefined) return '-';
    // تأكد من أن النص هو string وليس object
    const str = typeof text === 'string' ? text : String(text);
    // إزالة المسافات الزائدة وإرجاع النص أو '-' إذا كان فارغاً
    const cleaned = str.trim();
    return cleaned || '-';
  };

  // دالة لتنسيق الأرقام حسب اللغة
  const formatNumber = (num: number | string) => {
    if (currentLanguage === 'ar') {
      const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
    }
    return String(num);
  };

  // دالة ترجمة الحالات - محدثة 2026
  const getStatusName = (status: string) => {
    if (!status) return '-';
    const cleanStatus = cleanText(status);
    if (cleanStatus === '-') return '-';
    
    // Map status values to translations manually to avoid t() issues in PDF context
    const statusTranslations: Record<string, Record<string, string>> = {
      'ar': {
        'present': 'حضور',
        'absent': 'غياب',
        'late': 'تأخير',
        'leave': 'إجازة',
        'half_day': 'نصف يوم',
        'weekly_off': 'إجازة أسبوعية',
        'pending': 'قيد الانتظار',
        'approved': 'موافق عليها',
        'rejected': 'مرفوضة',
        'paid': 'مدفوعة',
        'completed': 'مكتملة'
      },
      'en': {
        'present': 'Present',
        'absent': 'Absent',
        'late': 'Late',
        'leave': 'Leave',
        'half_day': 'Half Day',
        'weekly_off': 'Weekly Off',
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'paid': 'Paid',
        'completed': 'Completed'
      },
      'fr': {
        'present': 'Présent',
        'absent': 'Absent',
        'late': 'En retard',
        'leave': 'Congé',
        'half_day': 'Demi-journée',
        'weekly_off': 'Repos hebdomadaire',
        'pending': 'En Attente',
        'approved': 'Approuvé',
        'rejected': 'Rejeté',
        'paid': 'Payé',
        'completed': 'Terminé'
      }
    };
    
    return statusTranslations[currentLanguage]?.[cleanStatus] || cleanStatus;
  };

  const getDeductionTypeName = (type: string) => {
    if (!type) return '-';
    const cleanType = cleanText(type);
    if (cleanType === '-') return '-';
    
    // Map deduction types to translations manually
    const deductionTranslations: Record<string, Record<string, string>> = {
      'ar': {
        'absence': 'غياب',
        'late': 'تأخير',
        'damage': 'تلفيات',
        'loan': 'قرض',
        'advance': 'سلفة',
        'insurance': 'تأمين',
        'tax': 'ضريبة',
        'other': 'أخرى'
      },
      'en': {
        'absence': 'Absence',
        'late': 'Late',
        'damage': 'Damage',
        'loan': 'Loan',
        'advance': 'Advance',
        'insurance': 'Insurance',
        'tax': 'Tax',
        'other': 'Other'
      },
      'fr': {
        'absence': 'Absence',
        'late': 'Retard',
        'damage': 'Dommages',
        'loan': 'Prêt',
        'advance': 'Avance',
        'insurance': 'Assurance',
        'tax': 'Taxe',
        'other': 'Autre'
      }
    };
    
    return deductionTranslations[currentLanguage]?.[cleanType] || cleanType;
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
    {/* الصفحة الأولى - معلومات الموظف والإحصائيات */}
    <Page size="A4" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('payroll.employeeProfile.pdfReport.title')}</Text>
        <Text style={styles.subtitle}>{cleanText(employee.personalInfo?.name)}</Text>
        <Text style={styles.subtitle}>{cleanText(monthName)}</Text>
      </View>

      {/* معلومات الموظف */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('payroll.employeeList.personalInfo')}</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.name')}</Text>
            <Text style={styles.infoValue}>{cleanText(employee.personalInfo?.name)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.phone')}</Text>
            <Text style={styles.infoValue}>{cleanText(employee.personalInfo?.phone)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.nationalId')}</Text>
            <Text style={styles.infoValue}>{cleanText(employee.personalInfo?.nationalId)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.hireDate')}</Text>
            <Text style={styles.infoValue}>
              {employee.personalInfo?.hireDate
                ? dayjs(employee.personalInfo.hireDate).locale(currentLanguage).format('DD/MM/YYYY')
                : '-'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.department')}</Text>
            <Text style={styles.infoValue}>{getDepartmentName(employee.employment?.department)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('payroll.employeeProfile.position')}</Text>
            <Text style={styles.infoValue}>{cleanText(employee.employment?.position)}</Text>
          </View>
        </View>
      </View>

      {/* الإحصائيات المالية */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('payroll.employeeProfile.pdfReport.financialSummary')} - {cleanText(monthName)}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.carriedForward')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.carriedForward.toFixed(2))} {currency}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.currentMonthSalary')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.currentMonthSalary.toFixed(2))} {currency}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.pdfReport.attendanceDays')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.attendanceDays)} {t('payroll.employeeProfile.pdfReport.day')}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.monthAdvances')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.currentMonthAdvances.toFixed(2))} {currency}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.monthDeductions')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.currentMonthDeductions.toFixed(2))} {currency}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('payroll.employeeProfile.paidSalary')}</Text>
              <Text style={styles.statValue}>{formatNumber(stats.currentMonthPaid.toFixed(2))} {currency}</Text>
            </View>
          </View>
        </View>
        
        {/* الرصيد المتاح */}
        <View style={{ backgroundColor: '#3498db', padding: 15, borderRadius: 5, marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: 'white', textAlign: 'center', marginBottom: 5 }}>
            {t('payroll.employeeProfile.availableBalance')}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
            {formatNumber(stats.remainingBalance.toFixed(2))} {currency}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `${t('payroll.employeeProfile.pdfReport.page')} ${formatNumber(pageNumber)} ${t('common.from')} ${formatNumber(totalPages)}`}
        fixed
      />
    </Page>

    {/* الصفحة الثانية - الحضور والانصراف */}
    {attendance.length > 0 && (
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('payroll.employeeProfile.pdfReport.attendanceRecord')}</Text>
          <Text style={styles.subtitle}>{cleanText(employee.personalInfo?.name)} - {cleanText(monthName)}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1]}>{t('payroll.employeeProfile.table.date')}</Text>
              <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.status')}</Text>
              <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.checkIn')}</Text>
              <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.checkOut')}</Text>
              <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.hours')}</Text>
              <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.pdfReport.salary')}</Text>
            </View>
            {attendance.map((record, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>
                  {dayjs(record.date).locale(currentLanguage).format('DD/MM/YYYY')}
                </Text>
                <Text style={[styles.tableCell, styles.col2]}>{getStatusName(record.status)}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{cleanText(record.checkIn)}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{cleanText(record.checkOut)}</Text>
                <Text style={[styles.tableCell, styles.col3]}>
                  {record.hours ? formatNumber(record.hours.toFixed(1)) : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.col3]}>
                  {record.dailySalary ? formatNumber(record.dailySalary.toFixed(2)) : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${t('payroll.employeeProfile.pdfReport.page')} ${formatNumber(pageNumber)} ${t('common.from')} ${formatNumber(totalPages)}`}
          fixed
        />
      </Page>
    )}

    {/* الصفحة الثالثة - السلف والخصومات والدفعات */}
    {(advances.length > 0 || deductions.length > 0 || payments.length > 0) && (
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('payroll.employeeProfile.pdfReport.advancesDeductionsPayments')}</Text>
          <Text style={styles.subtitle}>{cleanText(employee.personalInfo?.name)} - {cleanText(monthName)}</Text>
        </View>

        {/* السلف */}
        {advances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('payroll.employeeProfile.tabs.advances')}</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.date')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.amount')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.reason')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.status')}</Text>
              </View>
              {advances.map((advance, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {dayjs(advance.requestDate).locale(currentLanguage).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>{formatNumber(advance.amount.toFixed(2))}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{cleanText(advance.reason)}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{getStatusName(advance.status)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الخصومات */}
        {deductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('payroll.employeeProfile.tabs.deductions')}</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.date')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.type')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.amount')}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{t('payroll.employeeProfile.table.reason')}</Text>
              </View>
              {deductions.map((deduction, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {dayjs(deduction.date).locale(currentLanguage).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {getDeductionTypeName(deduction.type)}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>{formatNumber(deduction.amount.toFixed(2))}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{cleanText(deduction.reason)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الدفعات */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('payroll.employeeProfile.pdfReport.paidPayments')}</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.date')}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.amount')}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{t('payroll.employeeProfile.table.method')}</Text>
              </View>
              {payments.map((payment, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col3]}>
                    {dayjs(payment.paymentDate).locale(currentLanguage).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col3]}>{formatNumber(payment.amount.toFixed(2))}</Text>
                  <Text style={[styles.tableCell, styles.col3]}>{t(`payroll.employeeProfile.paymentMethods.${payment.method}`)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${t('payroll.employeeProfile.pdfReport.page')} ${formatNumber(pageNumber)} ${t('common.from')} ${formatNumber(totalPages)}`}
          fixed
        />
      </Page>
    )}
  </Document>
  );
};

export default EmployeePDFDocument;
