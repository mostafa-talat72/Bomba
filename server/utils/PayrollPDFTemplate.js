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
  },
  title: {
    fontSize: 22,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
    color: '#666',
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
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#428bca',
    color: 'white',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 5,
    fontSize: 11,
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
    minHeight: 22,
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
  col4: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#666',
  },
  developerCredit: {
    position: 'absolute',
    bottom: 3,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#7f8c8d',
  },
  // أنماط صفحات تفاصيل الموظفين
  detailHeader: {
    marginBottom: 12,
    textAlign: 'center',
    borderBottom: 2,
    borderBottomColor: '#3498db',
    paddingBottom: 10,
  },
  detailTitle: {
    fontSize: 20,
    marginBottom: 5,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  detailSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  infoGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  infoItem: {
    width: '50%',
    padding: 4,
  },
  infoLabel: {
    fontSize: 9,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statsGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  statCard: {
    width: '33.33%',
    padding: 3,
  },
  statBox: {
    backgroundColor: '#ecf0f1',
    padding: 8,
    borderRadius: 5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 8,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  balanceBox: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 5,
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 11,
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
});

// دالة لتنسيق الأرقام حسب اللغة
const formatNumber = (num, currentLanguage) => {
  if (currentLanguage === 'ar') {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
  }
  return String(num);
};

// ✅ دالة لتنسيق الأرقام السالبة بشكل صحيح (علامة السالب قبل الرقم)
const formatNumberWithSign = (num, currentLanguage, isRTL = false) => {
  const absNum = Math.abs(num);
  const formattedNum = formatNumber(absNum.toFixed(2), currentLanguage);
  
  if (num < 0) {
    // علامة السالب قبل الرقم
    if (isRTL) {
      return `${formattedNum}-`; // في RTL: الرقم ثم السالب
    } else {
      return `-${formattedNum}`; // في LTR: السالب ثم الرقم
    }
  }
  
  return formattedNum;
};

// ✅ دالة للحصول على نص توضيحي للأرقام السالبة (ديون)
const getDebtLabel = (amount, currentLanguage) => {
  if (amount >= 0) return null;
  
  const labels = {
    'ar': '(ديون على الموظف)',
    'en': '(Employee Debt)',
    'fr': '(Dette de l\'employé)'
  };
  
  return labels[currentLanguage] || labels['ar'];
};

// دالة لتنظيف النصوص - تضمن عرض البيانات من قاعدة البيانات بشكل صحيح
const cleanText = (text) => {
  if (!text || text === null || text === undefined) return '-';
  const str = typeof text === 'string' ? text : String(text);
  // إزالة المسافات الزائدة والأحرف الخاصة التي قد تسبب مشاكل
  const cleaned = str.trim().replace(/\s+/g, ' ');
  return cleaned || '-';
};

// دالة لتنسيق التاريخ
const formatDate = (date, currentLanguage) => {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return formatNumber(`${day}/${month}/${year}`, currentLanguage);
};

// دالة لتنسيق الوقت فقط (12-hour format with AM/PM)
const formatTime = (dateTime, currentLanguage) => {
  if (!dateTime) return '-';
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return '-';
    
    let hours = d.getHours();
    const minutes = d.getMinutes();
    
    // تحويل إلى نظام 12 ساعة
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // الساعة 0 تصبح 12
    
    // تنسيق الأرقام
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    
    // تحويل الأرقام حسب اللغة
    const timeStr = `${hoursStr}:${minutesStr}`;
    const formattedTime = currentLanguage === 'ar' ? formatNumber(timeStr, 'ar') : timeStr;
    
    // ترجمة AM/PM حسب اللغة
    let periodText = period;
    if (currentLanguage === 'ar') {
      periodText = period === 'AM' ? 'ص' : 'م';
    } else if (currentLanguage === 'fr') {
      periodText = period === 'AM' ? 'AM' : 'PM';
    }
    
    return `${formattedTime} ${periodText}`;
  } catch (e) {
    return '-';
  }
};

const getDepartmentName = (dept, currentLanguage) => {
  if (!dept) return '-';
  const cleanDept = cleanText(dept);
  if (cleanDept === '-') return '-';
  
  const departmentTranslations = {
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
      'cashier': 'الكاشير',
      'admin': 'الإدارة',
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
      'cashier': 'Cashier',
      'admin': 'Admin',
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
      'cashier': 'Caissier',
      'admin': 'Administration',
      'other': 'Autre'
    }
  };
  
  return departmentTranslations[currentLanguage]?.[cleanDept] || cleanDept;
};

const getEmploymentType = (type, currentLanguage) => {
  if (!type) return '-';
  const typeTranslations = {
    'ar': { 'monthly': 'شهري', 'daily': 'يومي', 'hourly': 'بالساعة' },
    'en': { 'monthly': 'Monthly', 'daily': 'Daily', 'hourly': 'Hourly' },
    'fr': { 'monthly': 'Mensuel', 'daily': 'Quotidien', 'hourly': 'Horaire' }
  };
  return typeTranslations[currentLanguage]?.[type] || type;
};

const getStatusName = (status, currentLanguage) => {
  if (!status) return '-';
  const cleanStatus = cleanText(status);
  if (cleanStatus === '-') return '-';
  
  const statusTranslations = {
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

const getDeductionTypeName = (type, currentLanguage) => {
  if (!type) return '-';
  const cleanType = cleanText(type);
  if (cleanType === '-') return '-';
  
  const deductionTranslations = {
    'ar': {
      'absence': 'غياب',
      'late': 'تأخير',
      'damage': 'تلفيات',
      'loan': 'قرض',
      'advance': 'سلفة',
      'insurance': 'تأمين',
      'tax': 'ضريبة',
      'penalty': 'غرامة',
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
      'penalty': 'Penalty',
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
      'penalty': 'Pénalité',
      'other': 'Autre'
    }
  };
  
  return deductionTranslations[currentLanguage]?.[cleanType] || cleanType;
};

const getBonusTypeName = (type, currentLanguage) => {
  if (!type) return '-';
  const cleanType = cleanText(type);
  if (cleanType === '-') return '-';
  
  const bonusTranslations = {
    'ar': {
      'performance': 'أداء متميز',
      'holiday': 'مكافأة عيد',
      'achievement': 'إنجاز',
      'sales': 'مبيعات',
      'attendance': 'حضور منتظم',
      'overtime': 'ساعات زيادة',
      'other': 'أخرى'
    },
    'en': {
      'performance': 'Performance',
      'holiday': 'Holiday',
      'achievement': 'Achievement',
      'sales': 'Sales',
      'attendance': 'Attendance',
      'overtime': 'Overtime Hours',
      'other': 'Other'
    },
    'fr': {
      'performance': 'Performance',
      'holiday': 'Vacances',
      'achievement': 'Réalisation',
      'sales': 'Ventes',
      'attendance': 'Présence',
      'overtime': 'Heures Supplémentaires',
      'other': 'Autre'
    }
  };
  
  return bonusTranslations[currentLanguage]?.[cleanType] || cleanType;
};

export const PayrollPDFDocument = ({ data, monthName, t, currentLanguage, isRTL, detailedEmployeesData, organizationName }) => {
  const styles = createStyles(isRTL);
  const { createElement: h } = React;

  // ✅ دالة للحصول على الحالة المالية للموظف
  const getFinancialStatus = (totalUnpaid, currentLanguage) => {
    if (totalUnpaid > 0) {
      // الموظف له مستحقات
      return {
        text: currentLanguage === 'ar' ? 'له مستحقات' : currentLanguage === 'fr' ? 'A des droits' : 'Has Dues',
        color: '#16a34a' // أخضر
      };
    } else if (totalUnpaid < 0) {
      // الموظف مديون (عليه ديون)
      return {
        text: currentLanguage === 'ar' ? 'عليه ديون' : currentLanguage === 'fr' ? 'A des dettes' : 'Has Debts',
        color: '#dc2626' // أحمر
      };
    } else {
      // متساوي
      return {
        text: currentLanguage === 'ar' ? 'متساوي' : currentLanguage === 'fr' ? 'Équilibré' : 'Balanced',
        color: '#6b7280' // رمادي
      };
    }
  };

  // Create employee rows for summary table
  const employeeRows = data.employees.map((emp, index) => {
    const financialStatus = getFinancialStatus(emp.totalUnpaid || 0, currentLanguage);
    
    return h(View, { key: index, style: styles.employeeRow }, [
      h(Text, { key: 'name', style: [styles.employeeCell, styles.col1] }, cleanText(emp.employeeName)),
      h(Text, { key: 'dept', style: [styles.employeeCell, styles.col2] }, getDepartmentName(emp.department, currentLanguage)),
      h(Text, { key: 'gross', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.grossSalary || 0).toFixed(2), currentLanguage)),
      h(Text, { key: 'bonus', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.bonuses || 0).toFixed(2), currentLanguage)),
      h(Text, { key: 'ded', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.deductions || 0).toFixed(2), currentLanguage)),
      h(Text, { key: 'net', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.netSalary || 0).toFixed(2), currentLanguage)),
      h(Text, { key: 'paid', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.paidAmount || 0).toFixed(2), currentLanguage)),
      h(Text, { key: 'unpaid', style: [styles.employeeCell, styles.col3] }, formatNumber((emp.unpaidBalance || 0).toFixed(2), currentLanguage)),
      // ✅ المرحل - مع علامة السالب الصحيحة
      h(Text, { 
        key: 'carried', 
        style: [styles.employeeCell, styles.col3, { color: emp.carriedForward < 0 ? '#dc2626' : '#2c3e50' }] 
      }, 
        formatNumberWithSign(emp.carriedForward || 0, currentLanguage, isRTL)
      ),
      // ✅ الإجمالي - مع علامة السالب الصحيحة
      h(Text, { 
        key: 'total', 
        style: [styles.employeeCell, styles.col3, { color: emp.totalUnpaid < 0 ? '#dc2626' : emp.totalUnpaid > 0 ? '#16a34a' : '#2c3e50', fontWeight: 'bold' }] 
      }, 
        formatNumberWithSign(emp.totalUnpaid || 0, currentLanguage, isRTL)
      ),
      // ✅ الحالة المالية - عمود جديد
      h(Text, { 
        key: 'status', 
        style: [styles.employeeCell, styles.col3, { color: financialStatus.color, fontWeight: 'bold', fontSize: 8 }] 
      }, 
        financialStatus.text
      )
    ]);
  });

  // Create detailed pages for each employee if data is available
  const detailedPages = [];
  if (detailedEmployeesData && Array.isArray(detailedEmployeesData) && detailedEmployeesData.length > 0) {
    detailedEmployeesData.forEach((empData, idx) => {
      if (!empData || !empData.employee) return;

      const emp = empData.employee;
      const stats = empData.stats || {};
      const info = emp.personalInfo || {};
      const job = emp.employment || {};
      const attendance = empData.attendance || [];
      const advances = empData.advances || [];
      const bonuses = empData.bonuses || [];
      const deductions = empData.deductions || [];
      const payments = empData.payments || [];

      // الصفحة الأولى - معلومات الموظف والإحصائيات
      const page1Elements = [
        // اسم المنشأة
        ...(organizationName ? [
          h(View, { key: 'org-h', style: { marginBottom: 8, textAlign: 'center' } }, [
            h(Text, { key: 'org-n', style: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' } }, cleanText(organizationName))
          ])
        ] : []),
        // العنوان
        h(View, { key: 'h', style: styles.detailHeader }, [
          h(Text, { key: 't', style: styles.detailTitle }, cleanText(t.employeeDetailedReport || 'تقرير تفصيلي للموظف')),
          h(Text, { key: 'n', style: styles.detailSubtitle }, cleanText(info.name)),
          h(Text, { key: 'm', style: styles.detailSubtitle }, cleanText(monthName))
        ]),
        
        // معلومات الموظف
        h(View, { key: 's1', style: { ...styles.section, marginBottom: 8 } }, [
          h(Text, { key: 'st1', style: styles.sectionTitle }, cleanText(t.personalInfo || 'المعلومات الشخصية')),
          h(View, { key: 'grid', style: styles.infoGrid }, [
            h(View, { key: 'i1', style: styles.infoItem }, [
              h(Text, { key: 'l1', style: styles.infoLabel }, cleanText(t.name || 'الاسم')),
              h(Text, { key: 'v1', style: styles.infoValue }, cleanText(info.name))
            ]),
            h(View, { key: 'i2', style: styles.infoItem }, [
              h(Text, { key: 'l2', style: styles.infoLabel }, cleanText(t.phone || 'الهاتف')),
              h(Text, { key: 'v2', style: styles.infoValue }, cleanText(info.phone))
            ]),
            h(View, { key: 'i3', style: styles.infoItem }, [
              h(Text, { key: 'l3', style: styles.infoLabel }, cleanText(t.nationalId || 'الرقم القومي')),
              h(Text, { key: 'v3', style: styles.infoValue }, cleanText(info.nationalId))
            ]),
            h(View, { key: 'i4', style: styles.infoItem }, [
              h(Text, { key: 'l4', style: styles.infoLabel }, cleanText(t.hireDate || 'تاريخ التعيين')),
              h(Text, { key: 'v4', style: styles.infoValue }, formatDate(info.hireDate, currentLanguage))
            ]),
            h(View, { key: 'i5', style: styles.infoItem }, [
              h(Text, { key: 'l5', style: styles.infoLabel }, cleanText(t.department || 'القسم')),
              h(Text, { key: 'v5', style: styles.infoValue }, getDepartmentName(job.department, currentLanguage))
            ]),
            h(View, { key: 'i6', style: styles.infoItem }, [
              h(Text, { key: 'l6', style: styles.infoLabel }, cleanText(t.position || 'المنصب')),
              h(Text, { key: 'v6', style: styles.infoValue }, cleanText(job.position))
            ])
          ])
        ]),
        
        // الإحصائيات المالية
        h(View, { key: 's2', style: { ...styles.section, marginBottom: 8 } }, [
          h(Text, { key: 'st2', style: styles.sectionTitle }, `${cleanText(t.financialSummary || 'الملخص المالي')} - ${cleanText(monthName)}`),
          h(View, { key: 'grid2', style: styles.statsGrid }, [
            // ✅ المرحل - مع توضيح إذا كان ديون
            h(View, { key: 'c1', style: styles.statCard }, [
              h(View, { key: 'b1', style: { ...styles.statBox, backgroundColor: stats.carriedForward < 0 ? '#fee2e2' : '#ecf0f1' } }, [
                h(Text, { key: 'l1', style: styles.statLabel }, cleanText(t.carriedForward || 'المرحل')),
                h(Text, { key: 'v1', style: { ...styles.statValue, color: stats.carriedForward < 0 ? '#dc2626' : '#2c3e50' } }, 
                  `${formatNumberWithSign(stats.carriedForward || 0, currentLanguage, isRTL)} ${cleanText(t.currency)}`
                ),
                ...(stats.carriedForward < 0 ? [
                  h(Text, { key: 'debt1', style: { fontSize: 7, color: '#dc2626', marginTop: 2 } }, 
                    getDebtLabel(stats.carriedForward, currentLanguage)
                  )
                ] : [])
              ])
            ]),
            h(View, { key: 'c2', style: styles.statCard }, [
              h(View, { key: 'b2', style: styles.statBox }, [
                h(Text, { key: 'l2', style: styles.statLabel }, cleanText(t.currentMonthSalary || 'راتب الشهر')),
                h(Text, { key: 'v2', style: styles.statValue }, `${formatNumber((stats.currentMonthSalary || 0).toFixed(2), currentLanguage)} ${cleanText(t.currency)}`)
              ])
            ]),
            h(View, { key: 'c3', style: styles.statCard }, [
              h(View, { key: 'b3', style: styles.statBox }, [
                h(Text, { key: 'l3', style: styles.statLabel }, cleanText(t.attendanceDays || 'أيام الحضور')),
                h(Text, { key: 'v3', style: styles.statValue }, `${formatNumber(stats.attendanceDays || 0, currentLanguage)} ${cleanText(t.day || 'يوم')}`)
              ])
            ]),
            h(View, { key: 'c4', style: styles.statCard }, [
              h(View, { key: 'b4', style: styles.statBox }, [
                h(Text, { key: 'l4', style: styles.statLabel }, cleanText(t.advances || 'السلف')),
                h(Text, { key: 'v4', style: styles.statValue }, `${formatNumber((stats.currentMonthAdvances || 0).toFixed(2), currentLanguage)} ${cleanText(t.currency)}`)
              ])
            ]),
            h(View, { key: 'c5', style: styles.statCard }, [
              h(View, { key: 'b5', style: styles.statBox }, [
                h(Text, { key: 'l5', style: styles.statLabel }, cleanText(t.bonuses || 'المكافآت')),
                h(Text, { key: 'v5', style: styles.statValue }, `+${formatNumber((stats.currentMonthBonuses || 0).toFixed(2), currentLanguage)} ${cleanText(t.currency)}`)
              ])
            ]),
            h(View, { key: 'c6', style: styles.statCard }, [
              h(View, { key: 'b6', style: styles.statBox }, [
                h(Text, { key: 'l6', style: styles.statLabel }, cleanText(t.deductions || 'الخصومات')),
                h(Text, { key: 'v6', style: styles.statValue }, `${formatNumber((stats.currentMonthDeductions || 0).toFixed(2), currentLanguage)} ${cleanText(t.currency)}`)
              ])
            ]),
            h(View, { key: 'c7', style: styles.statCard }, [
              h(View, { key: 'b7', style: styles.statBox }, [
                h(Text, { key: 'l7', style: styles.statLabel }, cleanText(t.paid || 'المدفوع')),
                h(Text, { key: 'v7', style: styles.statValue }, `${formatNumber((stats.currentMonthPaid || 0).toFixed(2), currentLanguage)} ${cleanText(t.currency)}`)
              ])
            ])
          ]),
          // ✅ الرصيد المتاح أو مديون برصيد - مع توضيح الديون
          h(View, { key: 'balance', style: { ...styles.balanceBox, backgroundColor: stats.remainingBalance < 0 ? '#dc2626' : '#3498db' } }, [
            h(Text, { key: 'bl', style: styles.balanceLabel }, cleanText(
              stats.remainingBalance >= 0 
                ? (t.availableBalance || 'الرصيد المتاح')
                : (currentLanguage === 'ar' ? 'مديون برصيد' : currentLanguage === 'fr' ? 'Solde débiteur' : 'Debt balance')
            )),
            h(Text, { key: 'bv', style: styles.balanceValue }, 
              `${formatNumberWithSign(stats.remainingBalance || 0, currentLanguage, isRTL)} ${cleanText(t.currency)}`
            ),
            ...(stats.remainingBalance < 0 ? [
              h(Text, { key: 'debt-note', style: { fontSize: 9, color: 'white', textAlign: 'center', marginTop: 4 } }, 
                getDebtLabel(stats.remainingBalance, currentLanguage)
              )
            ] : [])
          ])
        ]),
        
        h(Text, {
          key: 'f',
          style: styles.footer,
          fixed: true
        }, `${cleanText(t.page || 'صفحة')} ... ${cleanText(t.from || 'من')} ...`),
        // Developer Credit
        h(Text, {
          key: 'dc',
          style: styles.developerCredit,
          fixed: true
        }, cleanText(t.developedBy || 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية'))
      ];

      // حساب الطول المناسب للصفحة الأولى (معلومات الموظف) - زيادة الارتفاع
      // Header: 120, Personal Info: 200, Financial Stats: 350, Balance: 100, Footer: 80 = ~850
      const page1Height = 900;

      detailedPages.push(h(Page, { key: `detail-${idx}-p1`, size: [595, page1Height], style: styles.page }, page1Elements));

      // الصفحة الثانية - الحضور والانصراف (إذا كان هناك حضور)
      if (attendance.length > 0) {
        const attendanceHeader = h(View, { key: 'att-thead', style: [styles.tableRow, styles.tableHeader] }, [
          h(Text, { key: 'h1', style: [styles.tableCell, styles.col1] }, cleanText(t.date || 'التاريخ')),
          h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(t.status || 'الحالة')),
          h(Text, { key: 'h3', style: [styles.tableCell, styles.col3] }, cleanText(t.checkIn || 'الحضور')),
          h(Text, { key: 'h4', style: [styles.tableCell, styles.col3] }, cleanText(t.checkOut || 'الانصراف'))
        ]);

        const attendanceRows = attendance.map((record, aIdx) =>
          h(View, { key: aIdx, style: styles.tableRow }, [
            h(Text, { key: 'date', style: [styles.tableCell, styles.col1] }, formatDate(record.date, currentLanguage)),
            h(Text, { key: 'status', style: [styles.tableCell, styles.col2] }, getStatusName(record.status, currentLanguage)),
            h(Text, { key: 'in', style: [styles.tableCell, styles.col3] }, formatTime(record.checkIn, currentLanguage)),
            h(Text, { key: 'out', style: [styles.tableCell, styles.col3] }, formatTime(record.checkOut, currentLanguage))
          ])
        );

        // حساب الطول المناسب للصفحة الثانية (الحضور) - زيادة الارتفاع
        // Header: 120, Table Header: 35, Each Row: ~30, Footer: 80
        // Base: 235 + (attendance.length * 30)
        const page2Height = 235 + (attendance.length * 30);

        const page2Elements = [
          // اسم المنشأة
          ...(organizationName ? [
            h(View, { key: 'org-h2', style: { marginBottom: 8, textAlign: 'center' } }, [
              h(Text, { key: 'org-n2', style: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' } }, cleanText(organizationName))
            ])
          ] : []),
          h(View, { key: 'h2', style: styles.detailHeader }, [
            h(Text, { key: 't2', style: styles.detailTitle }, cleanText(t.attendanceRecord || 'سجل الحضور')),
            h(Text, { key: 'n2', style: styles.detailSubtitle }, `${cleanText(info.name)} - ${cleanText(monthName)}`)
          ]),
          h(View, { key: 's3', style: { ...styles.section, marginBottom: 8 } }, [
            h(View, { key: 'table', style: styles.table }, [
              attendanceHeader,
              ...attendanceRows
            ])
          ]),
          h(Text, {
            key: 'f2',
            style: styles.footer,
            fixed: true
          }, `${cleanText(t.page || 'صفحة')} ... ${cleanText(t.from || 'من')} ...`),
          h(Text, {
            key: 'dc2',
            style: styles.developerCredit,
            fixed: true
          }, cleanText(t.developedBy || 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية'))
        ];

        detailedPages.push(h(Page, { key: `detail-${idx}-p2`, size: [595, page2Height], style: styles.page }, page2Elements));
      }

      // الصفحة الثالثة - السلف والخصومات والمكافآت والدفعات (إذا كان هناك أي منها)
      if (advances.length > 0 || deductions.length > 0 || bonuses.length > 0 || payments.length > 0) {
        const page3Elements = [
          // اسم المنشأة
          ...(organizationName ? [
            h(View, { key: 'org-h3', style: { marginBottom: 8, textAlign: 'center' } }, [
              h(Text, { key: 'org-n3', style: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' } }, cleanText(organizationName))
            ])
          ] : []),
          h(View, { key: 'h3', style: styles.detailHeader }, [
            h(Text, { key: 't3', style: styles.detailTitle }, cleanText(t.advancesDeductionsPayments || 'السلف والخصومات والدفعات')),
            h(Text, { key: 'n3', style: styles.detailSubtitle }, `${cleanText(info.name)} - ${cleanText(monthName)}`)
          ])
        ];

        // حساب الطول المناسب للصفحة الثالثة - زيادة الارتفاع
        // Base Header: 150
        let page3ContentHeight = 150;

        // السلف
        if (advances.length > 0) {
          const advanceRows = advances.map((adv, advIdx) =>
            h(View, { key: advIdx, style: styles.tableRow }, [
              h(Text, { key: 'date', style: [styles.tableCell, styles.col2] }, formatDate(adv.requestDate, currentLanguage)),
              h(Text, { key: 'amount', style: [styles.tableCell, styles.col2] }, formatNumber(adv.amount.toFixed(2), currentLanguage)),
              h(Text, { key: 'reason', style: [styles.tableCell, styles.col2] }, cleanText(adv.reason)),
              h(Text, { key: 'status', style: [styles.tableCell, styles.col2] }, getStatusName(adv.status, currentLanguage))
            ])
          );

          page3Elements.push(
            h(View, { key: 'adv-section', style: { ...styles.section, marginBottom: 8 } }, [
              h(Text, { key: 'adv-title', style: styles.sectionTitle }, cleanText(t.advancesTab || 'السلف')),
              h(View, { key: 'adv-table', style: styles.table }, [
                h(View, { key: 'adv-thead', style: [styles.tableRow, styles.tableHeader] }, [
                  h(Text, { key: 'h1', style: [styles.tableCell, styles.col2] }, cleanText(t.date || 'التاريخ')),
                  h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(t.amount || 'المبلغ')),
                  h(Text, { key: 'h3', style: [styles.tableCell, styles.col2] }, cleanText(t.reason || 'السبب')),
                  h(Text, { key: 'h4', style: [styles.tableCell, styles.col2] }, cleanText(t.status || 'الحالة'))
                ]),
                ...advanceRows
              ])
            ])
          );
          // Section title: 40, Table header: 35, Each row: 30, Section margin: 10
          page3ContentHeight += 40 + 35 + (advances.length * 30) + 10;
        }

        // المكافآت
        if (bonuses.length > 0) {
          const bonusRows = bonuses.map((bonus, bonIdx) =>
            h(View, { key: bonIdx, style: styles.tableRow }, [
              h(Text, { key: 'date', style: [styles.tableCell, styles.col2] }, formatDate(bonus.date, currentLanguage)),
              h(Text, { key: 'type', style: [styles.tableCell, styles.col2] }, getBonusTypeName(bonus.type, currentLanguage)),
              h(Text, { key: 'amount', style: [styles.tableCell, styles.col2] }, `+${formatNumber(bonus.amount.toFixed(2), currentLanguage)}`),
              h(Text, { key: 'reason', style: [styles.tableCell, styles.col2] }, cleanText(bonus.reason))
            ])
          );

          page3Elements.push(
            h(View, { key: 'bon-section', style: { ...styles.section, marginBottom: 8 } }, [
              h(Text, { key: 'bon-title', style: styles.sectionTitle }, cleanText(t.bonusesTab || 'المكافآت')),
              h(View, { key: 'bon-table', style: styles.table }, [
                h(View, { key: 'bon-thead', style: [styles.tableRow, styles.tableHeader] }, [
                  h(Text, { key: 'h1', style: [styles.tableCell, styles.col2] }, cleanText(t.date || 'التاريخ')),
                  h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(t.type || 'النوع')),
                  h(Text, { key: 'h3', style: [styles.tableCell, styles.col2] }, cleanText(t.amount || 'المبلغ')),
                  h(Text, { key: 'h4', style: [styles.tableCell, styles.col2] }, cleanText(t.reason || 'السبب'))
                ]),
                ...bonusRows
              ])
            ])
          );
          page3ContentHeight += 40 + 35 + (bonuses.length * 30) + 10;
        }

        // الخصومات
        if (deductions.length > 0) {
          const deductionRows = deductions.map((ded, dedIdx) =>
            h(View, { key: dedIdx, style: styles.tableRow }, [
              h(Text, { key: 'date', style: [styles.tableCell, styles.col2] }, formatDate(ded.date, currentLanguage)),
              h(Text, { key: 'type', style: [styles.tableCell, styles.col2] }, getDeductionTypeName(ded.type, currentLanguage)),
              h(Text, { key: 'amount', style: [styles.tableCell, styles.col2] }, formatNumber(ded.amount.toFixed(2), currentLanguage)),
              h(Text, { key: 'reason', style: [styles.tableCell, styles.col2] }, cleanText(ded.reason))
            ])
          );

          page3Elements.push(
            h(View, { key: 'ded-section', style: { ...styles.section, marginBottom: 8 } }, [
              h(Text, { key: 'ded-title', style: styles.sectionTitle }, cleanText(t.deductionsTab || 'الخصومات')),
              h(View, { key: 'ded-table', style: styles.table }, [
                h(View, { key: 'ded-thead', style: [styles.tableRow, styles.tableHeader] }, [
                  h(Text, { key: 'h1', style: [styles.tableCell, styles.col2] }, cleanText(t.date || 'التاريخ')),
                  h(Text, { key: 'h2', style: [styles.tableCell, styles.col2] }, cleanText(t.type || 'النوع')),
                  h(Text, { key: 'h3', style: [styles.tableCell, styles.col2] }, cleanText(t.amount || 'المبلغ')),
                  h(Text, { key: 'h4', style: [styles.tableCell, styles.col2] }, cleanText(t.reason || 'السبب'))
                ]),
                ...deductionRows
              ])
            ])
          );
          page3ContentHeight += 40 + 35 + (deductions.length * 30) + 10;
        }

        // الدفعات
        if (payments.length > 0) {
          const paymentRows = payments.map((pay, payIdx) =>
            h(View, { key: payIdx, style: styles.tableRow }, [
              h(Text, { key: 'date', style: [styles.tableCell, styles.col4] }, formatDate(pay.paymentDate, currentLanguage)),
              h(Text, { key: 'amount', style: [styles.tableCell, styles.col4] }, formatNumber(pay.amount.toFixed(2), currentLanguage)),
              h(Text, { key: 'method', style: [styles.tableCell, styles.col4] }, cleanText(pay.method)),
              h(Text, { key: 'notes', style: [styles.tableCell, styles.col4] }, cleanText(pay.notes || '-'))
            ])
          );

          page3Elements.push(
            h(View, { key: 'pay-section', style: { ...styles.section, marginBottom: 8 } }, [
              h(Text, { key: 'pay-title', style: styles.sectionTitle }, cleanText(t.paidPayments || 'الدفعات المدفوعة')),
              h(View, { key: 'pay-table', style: styles.table }, [
                h(View, { key: 'pay-thead', style: [styles.tableRow, styles.tableHeader] }, [
                  h(Text, { key: 'h1', style: [styles.tableCell, styles.col4] }, cleanText(t.date || 'التاريخ')),
                  h(Text, { key: 'h2', style: [styles.tableCell, styles.col4] }, cleanText(t.amount || 'المبلغ')),
                  h(Text, { key: 'h3', style: [styles.tableCell, styles.col4] }, cleanText(t.method || 'الطريقة')),
                  h(Text, { key: 'h4', style: [styles.tableCell, styles.col4] }, cleanText(t.notes || 'الملاحظات'))
                ]),
                ...paymentRows
              ])
            ])
          );
          page3ContentHeight += 40 + 35 + (payments.length * 30) + 10;
        }

        page3Elements.push(
          h(Text, {
            key: 'f3',
            style: styles.footer,
            fixed: true
          }, `${cleanText(t.page || 'صفحة')} ... ${cleanText(t.from || 'من')} ...`),
          h(Text, {
            key: 'dc3',
            style: styles.developerCredit,
            fixed: true
          }, cleanText(t.developedBy || 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية'))
        );

        // Add footer space: 80
        const page3Height = page3ContentHeight + 80;

        detailedPages.push(h(Page, { key: `detail-${idx}-p3`, size: [595, page3Height], style: styles.page }, page3Elements));
      }
    });
  }

  return h(Document, {}, [
    // الصفحة الأولى - الإحصائيات العامة فقط
    h(Page, { key: 'stats-page', size: 'A4', orientation: 'portrait', style: styles.page }, [
      // اسم المنشأة
      ...(organizationName ? [
        h(View, { key: 'org-header', style: { marginBottom: 8, textAlign: 'center' } }, [
          h(Text, { key: 'org-name', style: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' } }, cleanText(organizationName))
        ])
      ] : []),
      // العنوان
      h(View, { key: 'header', style: styles.header }, [
        h(Text, { key: 'title', style: styles.title }, t.comprehensivePayroll),
        h(Text, { key: 'subtitle', style: styles.subtitle }, monthName)
      ]),
      
      // جدول الإحصائيات
      h(View, { key: 'stats-section', style: styles.section }, [
        h(Text, { key: 'stats-title', style: styles.sectionTitle }, t.generalStatistics),
        h(View, { key: 'stats-table', style: styles.table }, [
          h(View, { key: 'header-row', style: [styles.tableRow, styles.tableHeader] }, [
            h(Text, { key: 'h-item', style: [styles.tableCell, styles.tableCellLabel] }, t.item),
            h(Text, { key: 'h-value', style: [styles.tableCell, styles.tableCellValue] }, t.value)
          ]),
          h(View, { key: 'row1', style: styles.tableRow }, [
            h(Text, { key: 'l1', style: [styles.tableCell, styles.tableCellLabel] }, t.employeeCount),
            h(Text, { key: 'v1', style: [styles.tableCell, styles.tableCellValue] }, formatNumber(data.totalEmployees || 0, currentLanguage))
          ]),
          h(View, { key: 'row2', style: styles.tableRow }, [
            h(Text, { key: 'l2', style: [styles.tableCell, styles.tableCellLabel] }, t.totalGross),
            h(Text, { key: 'v2', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalGrossSalary || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          h(View, { key: 'row3', style: styles.tableRow }, [
            h(Text, { key: 'l3', style: [styles.tableCell, styles.tableCellLabel] }, t.totalBonuses),
            h(Text, { key: 'v3', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalBonuses || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          h(View, { key: 'row4', style: styles.tableRow }, [
            h(Text, { key: 'l4', style: [styles.tableCell, styles.tableCellLabel] }, t.totalDeductions),
            h(Text, { key: 'v4', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalDeductions || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          h(View, { key: 'row5', style: styles.tableRow }, [
            h(Text, { key: 'l5', style: [styles.tableCell, styles.tableCellLabel] }, t.netDue),
            h(Text, { key: 'v5', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalNetSalary || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          h(View, { key: 'row6', style: styles.tableRow }, [
            h(Text, { key: 'l6', style: [styles.tableCell, styles.tableCellLabel] }, t.paid),
            h(Text, { key: 'v6', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalPaid || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          h(View, { key: 'row7', style: styles.tableRow }, [
            h(Text, { key: 'l7', style: [styles.tableCell, styles.tableCellLabel] }, t.remainingCurrentMonth),
            h(Text, { key: 'v7', style: [styles.tableCell, styles.tableCellValue] }, `${formatNumber((data.statistics.totalUnpaidCurrentMonth || 0).toFixed(2), currentLanguage)} ${t.currency}`)
          ]),
          // ✅ المرحل - مع علامة السالب الصحيحة وتوضيح الديون
          h(View, { key: 'row8', style: styles.tableRow }, [
            h(Text, { key: 'l8', style: [styles.tableCell, styles.tableCellLabel] }, t.carriedForward),
            h(View, { key: 'v8-container', style: [styles.tableCell, styles.tableCellValue] }, [
              h(Text, { key: 'v8', style: { fontSize: 11 } }, 
                `${formatNumberWithSign(data.statistics.totalCarriedForward || 0, currentLanguage, isRTL)} ${t.currency}`
              ),
              ...(data.statistics.totalCarriedForward < 0 ? [
                h(Text, { key: 'debt8', style: { fontSize: 8, color: '#dc2626', marginTop: 2 } }, 
                  getDebtLabel(data.statistics.totalCarriedForward, currentLanguage)
                )
              ] : [])
            ])
          ]),
          // ✅ إجمالي المستحقات - مع علامة السالب الصحيحة وتوضيح الديون
          h(View, { key: 'row9', style: styles.tableRow }, [
            h(Text, { key: 'l9', style: [styles.tableCell, styles.tableCellLabel] }, t.totalDue),
            h(View, { key: 'v9-container', style: [styles.tableCell, styles.tableCellValue] }, [
              h(Text, { key: 'v9', style: { fontSize: 11 } }, 
                `${formatNumberWithSign(data.statistics.totalUnpaid || 0, currentLanguage, isRTL)} ${t.currency}`
              ),
              ...(data.statistics.totalUnpaid < 0 ? [
                h(Text, { key: 'debt9', style: { fontSize: 8, color: '#dc2626', marginTop: 2 } }, 
                  getDebtLabel(data.statistics.totalUnpaid, currentLanguage)
                )
              ] : [])
            ])
          ])
        ])
      ]),
      
      // Footer - Page number
      h(Text, { 
        key: 'footer1', 
        style: styles.footer,
        fixed: true 
      }, `${t.page || 'صفحة'} ... ${t.from || 'من'} ...`),
      
      // Developer Credit
      h(Text, { 
        key: 'dev-credit1', 
        style: styles.developerCredit,
        fixed: true 
      }, cleanText(t.developedBy || 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية'))
    ]),
    
    // الصفحة الثانية - تفاصيل الموظفين
    h(Page, { key: 'employees-page', size: 'A4', orientation: 'landscape', style: styles.page }, [
      // اسم المنشأة
      ...(organizationName ? [
        h(View, { key: 'org-header2', style: { marginBottom: 8, textAlign: 'center' } }, [
          h(Text, { key: 'org-name2', style: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' } }, cleanText(organizationName))
        ])
      ] : []),
      // العنوان
      h(View, { key: 'header2', style: styles.header }, [
        h(Text, { key: 'title2', style: styles.title }, t.employeeDetails),
        h(Text, { key: 'subtitle2', style: styles.subtitle }, monthName)
      ]),
      
      // جدول الموظفين
      h(View, { key: 'emp-section', style: styles.section }, [
        h(View, { key: 'emp-table', style: styles.employeeTable }, [
          h(View, { key: 'emp-header', style: [styles.employeeRow, styles.tableHeader] }, [
            h(Text, { key: 'h1', style: [styles.employeeCell, styles.col1] }, t.employee),
            h(Text, { key: 'h2', style: [styles.employeeCell, styles.col2] }, t.department),
            h(Text, { key: 'h3', style: [styles.employeeCell, styles.col3] }, t.gross),
            h(Text, { key: 'h4', style: [styles.employeeCell, styles.col3] }, t.bonuses),
            h(Text, { key: 'h5', style: [styles.employeeCell, styles.col3] }, t.deductions),
            h(Text, { key: 'h6', style: [styles.employeeCell, styles.col3] }, t.net),
            h(Text, { key: 'h7', style: [styles.employeeCell, styles.col3] }, t.paid),
            h(Text, { key: 'h8', style: [styles.employeeCell, styles.col3] }, t.remaining),
            h(Text, { key: 'h9', style: [styles.employeeCell, styles.col3] }, t.carried),
            h(Text, { key: 'h10', style: [styles.employeeCell, styles.col3] }, t.total),
            // ✅ عمود جديد للحالة المالية
            h(Text, { key: 'h11', style: [styles.employeeCell, styles.col3] }, t.financialStatus || 'الحالة')
          ]),
          ...employeeRows
        ])
      ]),
      
      // Footer - Page number
      h(Text, { 
        key: 'footer2', 
        style: styles.footer,
        fixed: true 
      }, `${t.page || 'صفحة'} ... ${t.from || 'من'} ...`),
      
      // Developer Credit
      h(Text, { 
        key: 'dev-credit2', 
        style: styles.developerCredit,
        fixed: true 
      }, cleanText(t.developedBy || 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية'))
    ]),
    
    // صفحات تفصيلية لكل موظف
    ...detailedPages
  ]);
};
