import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import dayjs from 'dayjs';

// تسجيل خط عربي من Google Fonts
Font.register({
  family: 'Cairo',
  src: 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hGA-W1ToLQ-HmkA.ttf',
});

// الأنماط
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Cairo',
    direction: 'rtl',
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
    flexDirection: 'row-reverse',
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
  },
  statsGrid: {
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
}

const getStatusName = (status: string) => {
  const names: any = {
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    leave: 'إجازة',
    half_day: 'نصف يوم',
    weekly_off: 'إجازة أسبوعية',
    pending: 'قيد الانتظار',
    approved: 'معتمد',
    paid: 'مدفوع',
    completed: 'مكتمل',
    rejected: 'مرفوض',
  };
  return names[status] || status;
};

const getDeductionTypeName = (type: string) => {
  const types: any = {
    absence: 'غياب',
    late: 'تأخير',
    penalty: 'جزاء',
    loan: 'قرض',
    insurance: 'تأمينات',
    tax: 'ضرائب',
    other: 'أخرى',
  };
  return types[type] || type;
};

const getDepartmentName = (dept: string) => {
  const names: any = {
    kitchen: 'المطبخ',
    cashier: 'الكاشير',
    waiter: 'الخدمة',
    admin: 'الإدارة',
    gaming: 'الألعاب',
    other: 'أخرى',
  };
  return names[dept] || dept;
};

const EmployeePDFDocument: React.FC<EmployeePDFProps> = ({
  employee,
  monthName,
  stats,
  attendance,
  advances,
  deductions,
  payments,
}) => (
  <Document>
    {/* الصفحة الأولى - معلومات الموظف والإحصائيات */}
    <Page size="A4" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>تقرير الموظف الشامل</Text>
        <Text style={styles.subtitle}>{employee.personalInfo?.name}</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* معلومات الموظف */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>البيانات الشخصية</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>الاسم</Text>
            <Text style={styles.infoValue}>{employee.personalInfo?.name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>رقم الهاتف</Text>
            <Text style={styles.infoValue}>{employee.personalInfo?.phone || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>الرقم القومي</Text>
            <Text style={styles.infoValue}>{employee.personalInfo?.nationalId || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>تاريخ التعيين</Text>
            <Text style={styles.infoValue}>
              {employee.personalInfo?.hireDate
                ? dayjs(employee.personalInfo.hireDate).format('DD/MM/YYYY')
                : '-'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>القسم</Text>
            <Text style={styles.infoValue}>{getDepartmentName(employee.employment?.department)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>المنصب</Text>
            <Text style={styles.infoValue}>{employee.employment?.position}</Text>
          </View>
        </View>
      </View>

      {/* الإحصائيات المالية */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الملخص المالي - {monthName}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>مرحل من أشهر سابقة</Text>
              <Text style={styles.statValue}>{stats.carriedForward.toFixed(2)} جنيه</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>مرتب الشهر الحالي</Text>
              <Text style={styles.statValue}>{stats.currentMonthSalary.toFixed(2)} جنيه</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>أيام الحضور</Text>
              <Text style={styles.statValue}>{stats.attendanceDays} يوم</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>سلف الشهر</Text>
              <Text style={styles.statValue}>{stats.currentMonthAdvances.toFixed(2)} جنيه</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>خصومات الشهر</Text>
              <Text style={styles.statValue}>{stats.currentMonthDeductions.toFixed(2)} جنيه</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>المرتب المصروف</Text>
              <Text style={styles.statValue}>{stats.currentMonthPaid.toFixed(2)} جنيه</Text>
            </View>
          </View>
        </View>
        
        {/* الرصيد المتاح */}
        <View style={{ backgroundColor: '#3498db', padding: 15, borderRadius: 5, marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: 'white', textAlign: 'center', marginBottom: 5 }}>
            الرصيد المتاح للصرف
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
            {stats.remainingBalance.toFixed(2)} جنيه
          </Text>
        </View>
      </View>

      {/* Footer */}
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `صفحة ${pageNumber} من ${totalPages}`}
        fixed
      />
    </Page>

    {/* الصفحة الثانية - الحضور والانصراف */}
    {attendance.length > 0 && (
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>سجل الحضور والانصراف</Text>
          <Text style={styles.subtitle}>{employee.personalInfo?.name} - {monthName}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1]}>التاريخ</Text>
              <Text style={[styles.tableCell, styles.col2]}>الحالة</Text>
              <Text style={[styles.tableCell, styles.col3]}>الحضور</Text>
              <Text style={[styles.tableCell, styles.col3]}>الانصراف</Text>
              <Text style={[styles.tableCell, styles.col3]}>الساعات</Text>
              <Text style={[styles.tableCell, styles.col3]}>المرتب</Text>
            </View>
            {attendance.map((record, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>
                  {dayjs(record.date).format('DD/MM/YYYY')}
                </Text>
                <Text style={[styles.tableCell, styles.col2]}>{getStatusName(record.status)}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{record.checkIn || '-'}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{record.checkOut || '-'}</Text>
                <Text style={[styles.tableCell, styles.col3]}>
                  {record.hours ? record.hours.toFixed(1) : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.col3]}>
                  {record.dailySalary ? record.dailySalary.toFixed(2) : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `صفحة ${pageNumber} من ${totalPages}`}
          fixed
        />
      </Page>
    )}

    {/* الصفحة الثالثة - السلف والخصومات والدفعات */}
    {(advances.length > 0 || deductions.length > 0 || payments.length > 0) && (
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>السلف والخصومات والدفعات</Text>
          <Text style={styles.subtitle}>{employee.personalInfo?.name} - {monthName}</Text>
        </View>

        {/* السلف */}
        {advances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>السلف</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col2]}>التاريخ</Text>
                <Text style={[styles.tableCell, styles.col2]}>المبلغ</Text>
                <Text style={[styles.tableCell, styles.col2]}>السبب</Text>
                <Text style={[styles.tableCell, styles.col2]}>الحالة</Text>
              </View>
              {advances.map((advance, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {dayjs(advance.requestDate).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>{advance.amount.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{advance.reason}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{getStatusName(advance.status)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الخصومات */}
        {deductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الخصومات</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col2]}>التاريخ</Text>
                <Text style={[styles.tableCell, styles.col2]}>النوع</Text>
                <Text style={[styles.tableCell, styles.col2]}>المبلغ</Text>
                <Text style={[styles.tableCell, styles.col2]}>السبب</Text>
              </View>
              {deductions.map((deduction, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {dayjs(deduction.date).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {getDeductionTypeName(deduction.type)}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>{deduction.amount.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{deduction.reason}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الدفعات */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الدفعات المصروفة</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.col3]}>التاريخ</Text>
                <Text style={[styles.tableCell, styles.col3]}>المبلغ</Text>
                <Text style={[styles.tableCell, styles.col3]}>الطريقة</Text>
              </View>
              {payments.map((payment, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col3]}>
                    {dayjs(payment.paymentDate).format('DD/MM/YYYY')}
                  </Text>
                  <Text style={[styles.tableCell, styles.col3]}>{payment.amount.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, styles.col3]}>{payment.method}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `صفحة ${pageNumber} من ${totalPages}`}
          fixed
        />
      </Page>
    )}
  </Document>
);

export default EmployeePDFDocument;
