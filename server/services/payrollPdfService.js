import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// تحميل الخط العربي
const arabicFontPath = path.join(process.cwd(), 'server', 'fonts', 'Cairo-Regular.ttf');
const arabicFontBoldPath = path.join(process.cwd(), 'server', 'fonts', 'Cairo-Bold.ttf');

export const generatePayslipPDF = async (payroll, options = {}) => {
  const {
    template = 'detailed',
    includeAttendanceDetails = true,
    includeReasons = true,
    includeSignatures = true,
    language = 'ar'
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve({
          buffer: pdfBuffer,
          base64: pdfBuffer.toString('base64')
        });
      });
      
      // تسجيل الخط العربي
      if (fs.existsSync(arabicFontPath)) {
        doc.registerFont('Arabic', arabicFontPath);
        doc.registerFont('ArabicBold', arabicFontBoldPath);
      }
      
      // رأس الصفحة
      doc.font('ArabicBold').fontSize(20).text('كافيه بومبا', { align: 'center' });
      doc.fontSize(16).text('كشف راتب تفصيلي', { align: 'center' });
      doc.moveDown();
      
      // معلومات الموظف
      doc.font('Arabic').fontSize(12);
      doc.text(`الموظف: ${payroll.employeeName}`, { align: 'right' });
      doc.text(`الرقم الوظيفي: ${payroll.employeeId}`, { align: 'right' });
      doc.text(`القسم: ${getArabicDepartment(payroll.employeeSnapshot.department)}`, { align: 'right' });
      doc.text(`الوظيفة: ${payroll.employeeSnapshot.position}`, { align: 'right' });
      doc.text(`الشهر: ${payroll.month}`, { align: 'right' });
      doc.text(`تاريخ الطباعة: ${format(new Date(), 'dd/MM/yyyy', { locale: ar })}`, { align: 'right' });
      doc.moveDown();
      
      // خط فاصل
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();
      
      // ملخص الحضور
      doc.font('ArabicBold').fontSize(14).text('ملخص الحضور والانصراف', { align: 'right' });
      doc.moveDown(0.5);
      
      doc.font('Arabic').fontSize(11);
      doc.text(`إجمالي أيام الشهر: ${payroll.attendance.totalDays} يوم`, { align: 'right' });
      doc.text(`أيام العمل المفترضة: ${payroll.attendance.workingDays} يوم`, { align: 'right' });
      doc.text(`أيام الحضور: ${payroll.attendance.present} يوم (${((payroll.attendance.present / payroll.attendance.workingDays) * 100).toFixed(1)}%)`, { align: 'right' });
      doc.text(`أيام الغياب: ${payroll.attendance.absent} يوم (${payroll.attendance.absenceExcused} بعذر، ${payroll.attendance.absenceUnexcused} بدون عذر)`, { align: 'right' });
      doc.text(`مرات التأخير: ${payroll.attendance.late} مرة`, { align: 'right' });
      doc.text(`إجمالي الساعات: ${payroll.attendance.totalHours} ساعة`, { align: 'right' });
      doc.text(`ساعات إضافية: ${payroll.attendance.overtimeHours} ساعة`, { align: 'right' });
      doc.moveDown();
      
      // جدول الحضور التفصيلي (إذا كان مطلوباً)
      if (includeAttendanceDetails && payroll.attendance.dailyRecords.length > 0) {
        doc.addPage();
        doc.font('ArabicBold').fontSize(14).text('تفاصيل الحضور اليومية', { align: 'right' });
        doc.moveDown(0.5);
        
        // رأس الجدول
        const tableTop = doc.y;
        const colWidths = [60, 80, 80, 60, 60, 60, 140];
        const headers = ['التاريخ', 'اليوم', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'السبب'];
        
        let x = 545;
        doc.font('ArabicBold').fontSize(10);
        headers.forEach((header, i) => {
          x -= colWidths[i];
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
        });
        
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
        
        // البيانات
        let y = tableTop + 20;
        doc.font('Arabic').fontSize(9);
        
        payroll.attendance.dailyRecords.forEach((record, index) => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          
          x = 545;
          const rowData = [
            format(new Date(record.date), 'dd/MM'),
            record.day,
            getArabicStatus(record.status),
            record.checkIn || '-',
            record.checkOut || '-',
            record.hours ? record.hours.toFixed(1) : '-',
            includeReasons ? (record.reason || '-') : '-'
          ];
          
          rowData.forEach((data, i) => {
            x -= colWidths[i];
            doc.text(data, x, y, { width: colWidths[i], align: 'center' });
          });
          
          y += 20;
          
          if (index < payroll.attendance.dailyRecords.length - 1) {
            doc.moveTo(50, y - 5).lineTo(545, y - 5).stroke();
          }
        });
        
        doc.addPage();
      }
      
      // المستحقات
      doc.font('ArabicBold').fontSize(14).text('المستحقات', { align: 'right' });
      doc.moveDown(0.5);
      
      doc.font('Arabic').fontSize(11);
      doc.text(`الراتب الأساسي: ${payroll.earnings.basic.amount.toFixed(2)} جنيه`, { align: 'right' });
      doc.fontSize(9).text(`   (${payroll.earnings.basic.calculation})`, { align: 'right' });
      doc.moveDown(0.3);
      
      // البدلات
      if (payroll.earnings.allowances.length > 0) {
        doc.fontSize(11).text('البدلات:', { align: 'right' });
        payroll.earnings.allowances.forEach(allowance => {
          doc.fontSize(10).text(`   • ${allowance.name}: ${allowance.amount.toFixed(2)} جنيه`, { align: 'right' });
          if (includeReasons && allowance.reason) {
            doc.fontSize(9).text(`      السبب: ${allowance.reason}`, { align: 'right' });
          }
        });
        doc.fontSize(11).text(`   إجمالي البدلات: ${payroll.earnings.allowancesTotal.toFixed(2)} جنيه`, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      // الساعات الإضافية
      if (payroll.earnings.overtime.amount > 0) {
        doc.fontSize(11).text(`الساعات الإضافية: ${payroll.earnings.overtime.amount.toFixed(2)} جنيه`, { align: 'right' });
        doc.fontSize(9).text(`   (${payroll.earnings.overtime.calculation})`, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      // العمولة
      if (payroll.earnings.commission.amount > 0) {
        doc.fontSize(11).text(`العمولة: ${payroll.earnings.commission.amount.toFixed(2)} جنيه`, { align: 'right' });
        doc.fontSize(9).text(`   (${payroll.earnings.commission.calculation})`, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      // المكافآت
      if (payroll.earnings.bonuses.length > 0) {
        doc.fontSize(11).text('المكافآت:', { align: 'right' });
        payroll.earnings.bonuses.forEach(bonus => {
          doc.fontSize(10).text(`   • ${bonus.name}: ${bonus.amount.toFixed(2)} جنيه`, { align: 'right' });
          if (includeReasons && bonus.reason) {
            doc.fontSize(9).text(`      السبب: ${bonus.reason}`, { align: 'right' });
          }
        });
        doc.fontSize(11).text(`   إجمالي المكافآت: ${payroll.earnings.bonusesTotal.toFixed(2)} جنيه`, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      // البقشيش
      if (payroll.earnings.tips.amount > 0) {
        doc.fontSize(11).text(`البقشيش: ${payroll.earnings.tips.amount.toFixed(2)} جنيه`, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('ArabicBold').fontSize(12).text(`إجمالي المستحقات: ${payroll.earnings.total.toFixed(2)} جنيه`, { align: 'right' });
      doc.moveDown();
      
      // الخصومات
      doc.font('ArabicBold').fontSize(14).text('الخصومات', { align: 'right' });
      doc.moveDown(0.5);
      
      doc.font('Arabic').fontSize(11);
      doc.text(`تأمينات اجتماعية (${payroll.deductions.insurance.rate}%): ${payroll.deductions.insurance.amount.toFixed(2)} جنيه`, { align: 'right' });
      doc.text(`ضرائب (${payroll.deductions.tax.rate}%): ${payroll.deductions.tax.amount.toFixed(2)} جنيه`, { align: 'right' });
      
      // خصم الغياب
      if (payroll.deductions.absenceTotal > 0) {
        doc.text(`خصم الغياب (${payroll.deductions.absence.length} يوم): ${payroll.deductions.absenceTotal.toFixed(2)} جنيه`, { align: 'right' });
      }
      
      // خصم التأخير
      if (payroll.deductions.lateTotal > 0) {
        doc.text(`خصم التأخير: ${payroll.deductions.lateTotal.toFixed(2)} جنيه`, { align: 'right' });
      }
      
      // السلف
      if (payroll.deductions.advancesTotal > 0) {
        doc.text('السلف:', { align: 'right' });
        payroll.deductions.advances.forEach(adv => {
          doc.fontSize(10).text(`   • قسط ${adv.installmentNumber} من ${adv.totalInstallments}: ${adv.amount.toFixed(2)} جنيه`, { align: 'right' });
          if (includeReasons && adv.reason) {
            doc.fontSize(9).text(`      السبب: ${adv.reason}`, { align: 'right' });
          }
          doc.fontSize(9).text(`      المتبقي: ${adv.remainingAfter.toFixed(2)} جنيه`, { align: 'right' });
        });
        doc.fontSize(11).text(`   إجمالي السلف: ${payroll.deductions.advancesTotal.toFixed(2)} جنيه`, { align: 'right' });
      }
      
      // الجزاءات
      if (payroll.deductions.penaltiesTotal > 0) {
        doc.text('الجزاءات:', { align: 'right' });
        payroll.deductions.penalties.forEach(penalty => {
          doc.fontSize(10).text(`   • ${penalty.type}: ${penalty.amount.toFixed(2)} جنيه`, { align: 'right' });
          if (includeReasons && penalty.reason) {
            doc.fontSize(9).text(`      السبب: ${penalty.reason}`, { align: 'right' });
          }
        });
        doc.fontSize(11).text(`   إجمالي الجزاءات: ${payroll.deductions.penaltiesTotal.toFixed(2)} جنيه`, { align: 'right' });
      }
      
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('ArabicBold').fontSize(12).text(`إجمالي الخصومات: ${payroll.deductions.total.toFixed(2)} جنيه`, { align: 'right' });
      doc.moveDown();
      
      // الملخص النهائي
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(13).text(`إجمالي المستحقات: ${payroll.summary.grossSalary.toFixed(2)} جنيه`, { align: 'right' });
      doc.text(`إجمالي الخصومات: ${payroll.summary.totalDeductions.toFixed(2)} جنيه`, { align: 'right' });
      doc.fontSize(16).fillColor('green').text(`صافي المستحق: ${payroll.summary.netSalary.toFixed(2)} جنيه`, { align: 'right' });
      doc.fillColor('black');
      doc.moveDown();
      
      // معلومات الدفع
      if (payroll.workflow.paidAt) {
        doc.fontSize(11).text(`الحالة: مدفوع ✓`, { align: 'right' });
        doc.text(`تاريخ الدفع: ${format(new Date(payroll.workflow.paidAt), 'dd/MM/yyyy')}`, { align: 'right' });
        doc.text(`طريقة الدفع: ${getArabicPaymentMethod(payroll.workflow.paymentMethod)}`, { align: 'right' });
        if (payroll.workflow.paymentReference) {
          doc.text(`رقم المرجع: ${payroll.workflow.paymentReference}`, { align: 'right' });
        }
      }
      
      doc.moveDown(2);
      
      // التوقيعات
      if (includeSignatures) {
        doc.fontSize(11);
        const sigY = doc.y;
        doc.text('توقيع الموظف: _______________', 50, sigY);
        doc.text('توقيع المدير: _______________', 350, sigY);
        doc.moveDown(2);
        doc.text('التاريخ: _______________', 50, doc.y);
      }
      
      // تذييل الصفحة
      doc.fontSize(9).fillColor('gray');
      doc.text('هذا المستند تم إنشاؤه إلكترونياً من نظام بومبا', 50, 750, { align: 'center' });
      doc.text(`رقم المستند: ${payroll.payrollId}`, { align: 'center' });
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
};

// Helper functions
function getArabicDepartment(dept) {
  const departments = {
    kitchen: 'المطبخ',
    cashier: 'الكاشير',
    waiter: 'الخدمة',
    admin: 'الإدارة',
    gaming: 'الألعاب',
    other: 'أخرى'
  };
  return departments[dept] || dept;
}

function getArabicStatus(status) {
  const statuses = {
    present: 'حضور',
    absent: 'غياب',
    late: 'تأخير',
    leave: 'إجازة',
    half_day: 'نصف يوم',
    weekly_off: 'إجازة أسبوعية'
  };
  return statuses[status] || status;
}

function getArabicPaymentMethod(method) {
  const methods = {
    cash: 'نقدي',
    bank_transfer: 'تحويل بنكي',
    check: 'شيك'
  };
  return methods[method] || method;
}
