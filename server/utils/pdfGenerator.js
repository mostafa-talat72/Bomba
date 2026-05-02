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
        console.log('📄 Generating Daily Report PDF...', { language, currency });
        
        // Import the DailyReportPDFDocument template
        const { DailyReportPDFDocument } = await import('./DailyReportPDFTemplate.js');
        
        // Get locale
        const locale = getLocaleFromLanguage(language);
        const isRTL = language === 'ar';
        const currencySymbol = getCurrencySymbol(currency, language);
        
        // Get translations
        const t = pdfTranslations[language] || pdfTranslations.ar;
        
        // Create the PDF document using the template
        const doc = React.createElement(DailyReportPDFDocument, {
            reportData: reportData,
            t: t,
            currentLanguage: language,
            isRTL: isRTL,
            currencySymbol: currencySymbol
        });
        
      
        
        // Render to buffer
        const pdfBuffer = await renderToBuffer(doc);
        console.log('✅ Daily Report PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        return pdfBuffer;
        
    } catch (error) {
        console.error('❌ Failed to generate daily report PDF:', error);
        console.error('Daily report error stack:', error.stack);
        throw error;
    }
};

/**
 * Generate PDF buffer for payroll summary
 * @param {Object} payrollData - Payroll summary data
 * @param {string} language - Language code (ar, en, fr)
 * @param {string} currency - Currency code (EGP, USD, etc.)
 * @param {Array} detailedEmployeesData - Optional detailed employee data to include in PDF
 * @param {string} organizationName - Organization name to display in PDF
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generatePayrollSummaryPDF = async (payrollData, language = 'ar', currency = 'EGP', detailedEmployeesData = null, organizationName = null) => {
    try {
        
        // Import the PayrollPDFDocument template
        const { PayrollPDFDocument } = await import('./PayrollPDFTemplate.js');
        
        // Get locale
        const locale = getLocaleFromLanguage(language);
        const isRTL = language === 'ar';
        
        // Get month name
        const monthDate = new Date(payrollData.year, payrollData.month - 1);
        const monthName = monthDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        
        // Translations
        const translations = {
            ar: {
                comprehensivePayroll: 'كشف المصروفات الشامل',
                generalStatistics: 'الإحصائيات العامة',
                item: 'البند',
                value: 'القيمة',
                employeeCount: 'عدد الموظفين',
                totalGross: 'إجمالي المستحقات',
                totalBonuses: 'إجمالي المكافآت',
                totalDeductions: 'إجمالي الخصومات',
                netDue: 'صافي المستحق',
                paid: 'المدفوع',
                remainingCurrentMonth: 'المتبقي للشهر الحالي',
                carriedForward: 'المرحل من شهور سابقة',
                totalDue: 'إجمالي المستحقات',
                employeeDetails: 'تفاصيل الموظفين',
                employee: 'الموظف',
                department: 'القسم',
                gross: 'الإجمالي',
                bonuses: 'المكافآت',
                deductions: 'الخصومات',
                net: 'الصافي',
                remaining: 'المتبقي',
                carried: 'المرحل',
                total: 'الإجمالي',
                financialStatus: 'الحالة المالية',
                page: 'صفحة',
                from: 'من',
                currency: 'ج.م',
                employeeDetailedReport: 'تقرير تفصيلي للموظف',
                personalInfo: 'المعلومات الشخصية',
                name: 'الاسم',
                phone: 'الهاتف',
                nationalId: 'الرقم القومي',
                hireDate: 'تاريخ التعيين',
                position: 'المنصب',
                employmentType: 'نوع التوظيف',
                financialSummary: 'الملخص المالي',
                currentMonthSalary: 'راتب الشهر الحالي',
                attendanceDays: 'أيام الحضور',
                advances: 'السلف',
                availableBalance: 'الرصيد المتاح',
                day: 'يوم',
                attendanceRecord: 'سجل الحضور',
                date: 'التاريخ',
                status: 'الحالة',
                checkIn: 'الحضور',
                checkOut: 'الانصراف',
                hours: 'الساعات',
                salary: 'الراتب',
                advancesDeductionsPayments: 'السلف والخصومات والدفعات',
                advancesTab: 'السلف',
                bonusesTab: 'المكافآت',
                deductionsTab: 'الخصومات',
                paidPayments: 'الدفعات المدفوعة',
                amount: 'المبلغ',
                reason: 'السبب',
                type: 'النوع',
                method: 'الطريقة',
                developedBy: 'تصميم وتطوير: مصطفى طلعت للحلول البرمجية - ٠١١١٦٦٢٦١٦٤'
            },
            en: {
                comprehensivePayroll: 'Comprehensive Payroll Summary',
                generalStatistics: 'General Statistics',
                item: 'Item',
                value: 'Value',
                employeeCount: 'Employee Count',
                totalGross: 'Total Gross Salary',
                totalBonuses: 'Total Bonuses',
                totalDeductions: 'Total Deductions',
                netDue: 'Net Due',
                paid: 'Paid',
                remainingCurrentMonth: 'Remaining Current Month',
                carriedForward: 'Carried Forward',
                totalDue: 'Total Due',
                employeeDetails: 'Employee Details',
                employee: 'Employee',
                department: 'Department',
                gross: 'Gross',
                bonuses: 'Bonuses',
                deductions: 'Deductions',
                net: 'Net',
                remaining: 'Remaining',
                carried: 'Carried',
                total: 'Total',
                financialStatus: 'Financial Status',
                page: 'Page',
                from: 'of',
                currency: 'EGP',
                employeeDetailedReport: 'Detailed Employee Report',
                personalInfo: 'Personal Information',
                name: 'Name',
                phone: 'Phone',
                nationalId: 'National ID',
                hireDate: 'Hire Date',
                position: 'Position',
                employmentType: 'Employment Type',
                financialSummary: 'Financial Summary',
                currentMonthSalary: 'Current Month Salary',
                attendanceDays: 'Attendance Days',
                advances: 'Advances',
                availableBalance: 'Available Balance',
                day: 'Day',
                attendanceRecord: 'Attendance Record',
                date: 'Date',
                status: 'Status',
                checkIn: 'Check In',
                checkOut: 'Check Out',
                hours: 'Hours',
                salary: 'Salary',
                advancesDeductionsPayments: 'Advances, Deductions & Payments',
                advancesTab: 'Advances',
                bonusesTab: 'Bonuses',
                deductionsTab: 'Deductions',
                paidPayments: 'Paid Payments',
                amount: 'Amount',
                reason: 'Reason',
                type: 'Type',
                method: 'Method',
                developedBy: 'Designed & Developed by: Mostafa Talaat Software Solutions - 01116626164'
            },
            fr: {
                comprehensivePayroll: 'Résumé Complet de la Paie',
                generalStatistics: 'Statistiques Générales',
                item: 'Article',
                value: 'Valeur',
                employeeCount: 'Nombre d\'Employés',
                totalGross: 'Salaire Brut Total',
                totalBonuses: 'Total des Primes',
                totalDeductions: 'Total des Déductions',
                netDue: 'Net Dû',
                paid: 'Payé',
                remainingCurrentMonth: 'Restant Mois Actuel',
                carriedForward: 'Report',
                totalDue: 'Total Dû',
                employeeDetails: 'Détails des Employés',
                employee: 'Employé',
                department: 'Département',
                gross: 'Brut',
                bonuses: 'Primes',
                deductions: 'Déductions',
                net: 'Net',
                remaining: 'Restant',
                carried: 'Reporté',
                total: 'Total',
                page: 'Page',
                from: 'de',
                currency: 'EGP',
                employeeDetailedReport: 'Rapport Détaillé de l\'Employé',
                personalInfo: 'Informations Personnelles',
                name: 'Nom',
                phone: 'Téléphone',
                nationalId: 'ID National',
                hireDate: 'Date d\'Embauche',
                position: 'Poste',
                employmentType: 'Type d\'Emploi',
                financialSummary: 'Résumé Financier',
                currentMonthSalary: 'Salaire du Mois Actuel',
                attendanceDays: 'Jours de Présence',
                advances: 'Avances',
                availableBalance: 'Solde Disponible',
                day: 'Jour',
                attendanceRecord: 'Registre de Présence',
                date: 'Date',
                status: 'Statut',
                checkIn: 'Arrivée',
                checkOut: 'Départ',
                hours: 'Heures',
                salary: 'Salaire',
                advancesDeductionsPayments: 'Avances, Déductions et Paiements',
                advancesTab: 'Avances',
                bonusesTab: 'Primes',
                deductionsTab: 'Déductions',
                paidPayments: 'Paiements Effectués',
                amount: 'Montant',
                reason: 'Raison',
                type: 'Type',
                method: 'Méthode',
                financialStatus: 'Statut Financier',
                developedBy: 'Conçu et Développé par: Mostafa Talaat Solutions Logicielles - 01116626164'
            }
        };
        
        const t = translations[language] || translations.ar;
        
        // Create the PDF document using the template
        const doc = React.createElement(PayrollPDFDocument, {
            data: payrollData,
            monthName: monthName,
            t: t,
            currentLanguage: language,
            isRTL: isRTL,
            detailedEmployeesData: detailedEmployeesData,
            organizationName: organizationName
        });
                
        // Render to buffer
        const pdfBuffer = await renderToBuffer(doc);
        console.log('✅ Payroll Summary PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        return pdfBuffer;
        
    } catch (error) {
        console.error('❌ Failed to generate payroll summary PDF:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
};

/**
 * Generate PDF buffer for all employees data
 * @param {Array} employeesData - Array of employee data with stats, attendance, etc.
 * @param {string} monthName - Month name
 * @param {string} language - Language code (ar, en, fr)
 * @param {string} currency - Currency code (EGP, USD, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateAllEmployeesPDF = async (employeesData, monthName, language = 'ar', currency = 'EGP') => {
    try {
        console.log('📄 Generating All Employees PDF...', { 
            employeeCount: employeesData.length, 
            language, 
            currency 
        });
        
        // Import the AllEmployeesPDFTemplate
        const AllEmployeesPDFTemplate = (await import('./AllEmployeesPDFTemplate.js')).default;
        
        // Get locale
        const locale = getLocaleFromLanguage(language);
        const isRTL = language === 'ar';
        
        // Translations
        const translations = {
            ar: {
                title: 'تقرير شامل لجميع الموظفين',
                personalInfo: 'المعلومات الشخصية',
                name: 'الاسم',
                phone: 'الهاتف',
                nationalId: 'الرقم القومي',
                hireDate: 'تاريخ التعيين',
                department: 'القسم',
                position: 'المنصب',
                employmentType: 'نوع التوظيف',
                financialSummary: 'الملخص المالي',
                carriedForward: 'المرحل من شهور سابقة',
                currentMonthSalary: 'راتب الشهر الحالي',
                attendanceDays: 'أيام الحضور',
                monthAdvances: 'السلف',
                monthBonuses: 'المكافآت',
                monthDeductions: 'الخصومات',
                paidSalary: 'المدفوع',
                availableBalance: 'الرصيد المتاح',
                attendanceRecord: 'سجل الحضور',
                date: 'التاريخ',
                status: 'الحالة',
                hours: 'الساعات',
                salary: 'الراتب',
                page: 'صفحة',
                of: 'من'
            },
            en: {
                title: 'Comprehensive Report for All Employees',
                personalInfo: 'Personal Information',
                name: 'Name',
                phone: 'Phone',
                nationalId: 'National ID',
                hireDate: 'Hire Date',
                department: 'Department',
                position: 'Position',
                employmentType: 'Employment Type',
                financialSummary: 'Financial Summary',
                carriedForward: 'Carried Forward',
                currentMonthSalary: 'Current Month Salary',
                attendanceDays: 'Attendance Days',
                monthAdvances: 'Advances',
                monthBonuses: 'Bonuses',
                monthDeductions: 'Deductions',
                paidSalary: 'Paid',
                availableBalance: 'Available Balance',
                attendanceRecord: 'Attendance Record',
                date: 'Date',
                status: 'Status',
                hours: 'Hours',
                salary: 'Salary',
                page: 'Page',
                of: 'of'
            },
            fr: {
                title: 'Rapport Complet pour Tous les Employés',
                personalInfo: 'Informations Personnelles',
                name: 'Nom',
                phone: 'Téléphone',
                nationalId: 'ID National',
                hireDate: 'Date d\'Embauche',
                department: 'Département',
                position: 'Poste',
                employmentType: 'Type d\'Emploi',
                financialSummary: 'Résumé Financier',
                carriedForward: 'Report',
                currentMonthSalary: 'Salaire du Mois Actuel',
                attendanceDays: 'Jours de Présence',
                monthAdvances: 'Avances',
                monthBonuses: 'Primes',
                monthDeductions: 'Déductions',
                paidSalary: 'Payé',
                availableBalance: 'Solde Disponible',
                attendanceRecord: 'Registre de Présence',
                date: 'Date',
                status: 'Statut',
                hours: 'Heures',
                salary: 'Salaire',
                page: 'Page',
                of: 'de'
            }
        };
        
        const t = translations[language] || translations.ar;
        
        // Create the PDF document using the template
        const doc = React.createElement(AllEmployeesPDFTemplate, {
            employeesData: employeesData,
            monthName: monthName,
            translations: t,
            language: language,
            currency: getCurrencySymbol(currency, language)
        });
        
        console.log('📊 All employees data being sent to PDF:', {
            totalEmployees: employeesData.length,
            firstEmployee: employeesData[0]?.employee?.personalInfo?.name || 'none'
        });
        
        // Render to buffer
        const pdfBuffer = await renderToBuffer(doc);
        console.log('✅ All Employees PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        return pdfBuffer;
        
    } catch (error) {
        console.error('❌ Failed to generate all employees PDF:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
};
