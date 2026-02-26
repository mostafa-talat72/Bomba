import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

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
    flexDirection: 'row-reverse',
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
    textAlign: 'right',
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
    flexDirection: 'row-reverse',
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
}

const PayrollPDFDocument: React.FC<PayrollPDFProps> = ({ data, monthName }) => (
  <Document>
    {/* الصفحة الأولى - الإحصائيات */}
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>كشف المصروفات الشامل</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* جدول الإحصائيات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الإحصائيات العامة</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>البيان</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>القيمة</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>عدد الموظفين</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>{data.totalEmployees}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>إجمالي المستحقات</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalGrossSalary.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>إجمالي الخصومات</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalDeductions.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>صافي المستحق</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalNetSalary.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>المدفوع</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalPaid.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>المتبقي (الشهر الحالي)</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalUnpaidCurrentMonth.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>المرحل من أشهر سابقة</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalCarriedForward.toFixed(2)} جنيه
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>إجمالي المستحقات الكلي</Text>
            <Text style={[styles.tableCell, styles.tableCellValue]}>
              {data.statistics.totalUnpaid.toFixed(2)} جنيه
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `صفحة ${pageNumber} من ${totalPages}`
      )} fixed />
    </Page>

    {/* الصفحة الثانية - تفاصيل الموظفين */}
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* العنوان */}
      <View style={styles.header}>
        <Text style={styles.title}>تفاصيل الموظفين</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* جدول الموظفين */}
      <View style={styles.section}>
        <View style={styles.employeeTable}>
          <View style={[styles.employeeRow, styles.tableHeader]}>
            <Text style={[styles.employeeCell, styles.col1]}>الموظف</Text>
            <Text style={[styles.employeeCell, styles.col2]}>القسم</Text>
            <Text style={[styles.employeeCell, styles.col3]}>الإجمالي</Text>
            <Text style={[styles.employeeCell, styles.col3]}>الخصومات</Text>
            <Text style={[styles.employeeCell, styles.col3]}>الصافي</Text>
            <Text style={[styles.employeeCell, styles.col3]}>المدفوع</Text>
            <Text style={[styles.employeeCell, styles.col3]}>المتبقي</Text>
            <Text style={[styles.employeeCell, styles.col3]}>المرحل</Text>
            <Text style={[styles.employeeCell, styles.col3]}>الإجمالي</Text>
          </View>
          {data.employees.map((emp, index) => (
            <View key={index} style={styles.employeeRow}>
              <Text style={[styles.employeeCell, styles.col1]}>{emp.employeeName}</Text>
              <Text style={[styles.employeeCell, styles.col2]}>{emp.department}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.grossSalary.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.deductions.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.netSalary.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.paidAmount.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.unpaidBalance.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.carriedForward.toFixed(2)}</Text>
              <Text style={[styles.employeeCell, styles.col3]}>{emp.totalUnpaid.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `صفحة ${pageNumber} من ${totalPages}`
      )} fixed />
    </Page>
  </Document>
);

export default PayrollPDFDocument;
