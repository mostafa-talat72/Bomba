import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

/**
 * KNOWN ISSUE: This template triggers a bug in @react-pdf/textkit when processing
 * Arabic text with mixed content (names, numbers, symbols). The error occurs in
 * the bidirectional text reordering algorithm at textkit.js:882.
 * 
 * Error: "Cannot read properties of undefined (reading 'id')"
 * Location: @react-pdf/textkit/lib/textkit.js:882 in reorderLine function
 * 
 * This is a library-level bug that cannot be fixed without updating @react-pdf.
 * Multiple attempts have been made:
 * - Using different fonts (Vazir, NotoSansArabic)
 * - Pre-formatting all text values
 * - Simplifying layouts
 * - Removing RTL direction
 * 
 * All attempts still trigger the same textkit bug.
 * 
 * WORKAROUND: The payroll summary PDF already provides comprehensive employee
 * financial data. This all-employees detailed PDF is currently disabled due to
 * the library bug.
 */

// تسجيل خط Noto Sans Arabic - يدعم العربية بشكل أفضل مع @react-pdf
Font.register({
  family: 'NotoSansArabic',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.ttf',
      fontWeight: 400,
    }
  ]
});

// الأنماط - تصميم بسيط جداً لتجنب مشاكل textkit
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSansArabic',
    fontSize: 11,
  },
  header: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#3498db',
    color: '#ffffff',
    textAlign: 'center',
  },
  row: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
  },
});

// دالة لتنسيق الأرقام
const formatNum = (num, lang) => {
  if (lang === 'ar') {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/\d/g, (d) => arabicNums[parseInt(d)]);
  }
  return String(num);
};

// دالة لتنظيف النصوص
const clean = (text) => {
  if (!text) return '-';
  return String(text).trim() || '-';
};

// دالة لتنسيق التاريخ
const formatDt = (date, lang) => {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return formatNum(`${day}/${month}/${year}`, lang);
};

const AllEmployeesPDFDocument = ({ employeesData, monthName, translations, language, currency }) => {
  const { createElement: h } = React;

  if (!employeesData || !Array.isArray(employeesData) || employeesData.length === 0) {
    return h(Document, {}, [
      h(Page, { key: 'empty', size: 'A4', style: styles.page }, [
        h(Text, { key: 'no-data' }, 'No data')
      ])
    ]);
  }

  const pages = employeesData.map((empData, idx) => {
    if (!empData || !empData.employee) return null;

    const emp = empData.employee;
    const stats = empData.stats || {};
    const info = emp.personalInfo || {};
    const job = emp.employment || {};

    // تنسيق جميع القيم مسبقاً
    const v = {
      name: clean(info.name),
      phone: clean(info.phone),
      nid: clean(info.nationalId),
      hire: formatDt(info.hireDate, language),
      dept: clean(job.department),
      pos: clean(job.position),
      type: clean(job.type),
      carried: formatNum((stats.carriedForward || 0).toFixed(2), language),
      salary: formatNum((stats.currentMonthSalary || 0).toFixed(2), language),
      days: formatNum(stats.attendanceDays || 0, language),
      advances: formatNum((stats.currentMonthAdvances || 0).toFixed(2), language),
      bonuses: formatNum((stats.currentMonthBonuses || 0).toFixed(2), language),
      deductions: formatNum((stats.currentMonthDeductions || 0).toFixed(2), language),
      paid: formatNum((stats.currentMonthPaid || 0).toFixed(2), language),
      balance: formatNum((stats.remainingBalance || 0).toFixed(2), language),
    };

    return h(Page, { key: `p${idx}`, size: 'A4', style: styles.page }, [
      h(View, { key: 'h', style: styles.header }, [
        h(Text, { key: 't' }, clean(translations.title)),
        h(Text, { key: 'n', style: styles.subtitle }, v.name),
        h(Text, { key: 'm', style: styles.subtitle }, clean(monthName))
      ]),
      
      h(View, { key: 's1', style: styles.section }, [
        h(Text, { key: 'st1', style: styles.sectionTitle }, clean(translations.personalInfo)),
        h(View, { key: 'r1', style: styles.row }, [
          h(Text, { key: 'l1', style: styles.label }, clean(translations.name)),
          h(Text, { key: 'v1', style: styles.value }, v.name)
        ]),
        h(View, { key: 'r2', style: styles.row }, [
          h(Text, { key: 'l2', style: styles.label }, clean(translations.phone)),
          h(Text, { key: 'v2', style: styles.value }, v.phone)
        ]),
        h(View, { key: 'r3', style: styles.row }, [
          h(Text, { key: 'l3', style: styles.label }, clean(translations.nationalId)),
          h(Text, { key: 'v3', style: styles.value }, v.nid)
        ]),
        h(View, { key: 'r4', style: styles.row }, [
          h(Text, { key: 'l4', style: styles.label }, clean(translations.hireDate)),
          h(Text, { key: 'v4', style: styles.value }, v.hire)
        ]),
        h(View, { key: 'r5', style: styles.row }, [
          h(Text, { key: 'l5', style: styles.label }, clean(translations.department)),
          h(Text, { key: 'v5', style: styles.value }, v.dept)
        ]),
        h(View, { key: 'r6', style: styles.row }, [
          h(Text, { key: 'l6', style: styles.label }, clean(translations.position)),
          h(Text, { key: 'v6', style: styles.value }, v.pos)
        ])
      ]),
      
      h(View, { key: 's2', style: styles.section }, [
        h(Text, { key: 'st2', style: styles.sectionTitle }, clean(translations.financialSummary)),
        h(View, { key: 'r7', style: styles.row }, [
          h(Text, { key: 'l7', style: styles.label }, clean(translations.carriedForward)),
          h(Text, { key: 'v7', style: styles.value }, `${v.carried} ${clean(currency)}`)
        ]),
        h(View, { key: 'r8', style: styles.row }, [
          h(Text, { key: 'l8', style: styles.label }, clean(translations.currentMonthSalary)),
          h(Text, { key: 'v8', style: styles.value }, `${v.salary} ${clean(currency)}`)
        ]),
        h(View, { key: 'r9', style: styles.row }, [
          h(Text, { key: 'l9', style: styles.label }, clean(translations.attendanceDays)),
          h(Text, { key: 'v9', style: styles.value }, v.days)
        ]),
        h(View, { key: 'r10', style: styles.row }, [
          h(Text, { key: 'l10', style: styles.label }, clean(translations.monthAdvances)),
          h(Text, { key: 'v10', style: styles.value }, `${v.advances} ${clean(currency)}`)
        ]),
        h(View, { key: 'r11', style: styles.row }, [
          h(Text, { key: 'l11', style: styles.label }, clean(translations.monthBonuses)),
          h(Text, { key: 'v11', style: styles.value }, `${v.bonuses} ${clean(currency)}`)
        ]),
        h(View, { key: 'r12', style: styles.row }, [
          h(Text, { key: 'l12', style: styles.label }, clean(translations.monthDeductions)),
          h(Text, { key: 'v12', style: styles.value }, `${v.deductions} ${clean(currency)}`)
        ]),
        h(View, { key: 'r13', style: styles.row }, [
          h(Text, { key: 'l13', style: styles.label }, clean(translations.paidSalary)),
          h(Text, { key: 'v13', style: styles.value }, `${v.paid} ${clean(currency)}`)
        ]),
        h(View, { key: 'r14', style: styles.row }, [
          h(Text, { key: 'l14', style: styles.label }, clean(translations.availableBalance)),
          h(Text, { key: 'v14', style: styles.value }, `${v.balance} ${clean(currency)}`)
        ])
      ]),
      
      h(Text, {
        key: 'f',
        style: styles.footer,
        render: ({ pageNumber, totalPages }) => 
          `${clean(translations.page)} ${formatNum(pageNumber, language)} ${clean(translations.of)} ${formatNum(totalPages, language)}`,
        fixed: true
      })
    ]);
  }).filter(p => p !== null);

  return h(Document, {}, pages);
};

export default AllEmployeesPDFDocument;
