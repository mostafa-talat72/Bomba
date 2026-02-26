import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Payment from '../models/Payment.js';
import Deduction from '../models/Deduction.js';
import mongoose from 'mongoose';
import { startOfMonth, endOfMonth, format, getDaysInMonth } from 'date-fns';

// Helper: Calculate payroll
const calculatePayroll = async (employee, month, year, organizationId) => {
  const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
  const startDate = new Date(year, month - 1, 1);
  const endDate = endOfMonth(startDate);
  
  // جلب الحضور
  const attendance = await Attendance.find({
    employeeId: employee._id,
    organizationId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });
  
  // حساب ملخص الحضور
  const attendanceSummary = {
    totalDays: attendance.length,
    workingDays: attendance.filter(a => a.status !== 'weekly_off').length,
    present: attendance.filter(a => a.status === 'present' || a.status === 'late').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    absenceExcused: attendance.filter(a => a.status === 'absent' && a.excused).length,
    absenceUnexcused: attendance.filter(a => a.status === 'absent' && !a.excused).length,
    late: attendance.filter(a => a.status === 'late').length,
    lateExcused: attendance.filter(a => a.status === 'late' && a.excused).length,
    lateUnexcused: attendance.filter(a => a.status === 'late' && !a.excused).length,
    leaves: attendance.filter(a => a.status === 'leave').length,
    halfDays: attendance.filter(a => a.status === 'half_day').length,
    totalHours: attendance.reduce((sum, a) => sum + (a.details?.totalHours || 0), 0),
    regularHours: attendance.reduce((sum, a) => sum + (a.details?.regularHours || 0), 0),
    overtimeHours: attendance.reduce((sum, a) => sum + (a.details?.overtimeHours || 0), 0)
  };
  
  // حساب الراتب الأساسي
  let basicAmount = 0;
  let basicCalculation = '';
  let daysWorked = attendanceSummary.present;
  
  if (employee.employment.type === 'monthly') {
    basicAmount = employee.compensation.monthly || 0;
    basicCalculation = `${basicAmount} جنيه شهري`;
  } else if (employee.employment.type === 'daily') {
    const dailyRate = employee.compensation.daily || 0;
    basicAmount = dailyRate * daysWorked;
    basicCalculation = `${daysWorked} يوم × ${dailyRate} جنيه`;
  } else if (employee.employment.type === 'hourly') {
    const hourlyRate = employee.compensation.hourly || 0;
    basicAmount = hourlyRate * attendanceSummary.regularHours;
    basicCalculation = `${attendanceSummary.regularHours} ساعة × ${hourlyRate} جنيه`;
  }
  
  // البدلات
  const allowances = [];
  let allowancesTotal = 0;
  
  if (employee.compensation.allowances) {
    if (employee.compensation.allowances.transport) {
      allowances.push({
        type: 'transport',
        name: 'بدل مواصلات',
        amount: employee.compensation.allowances.transport,
        reason: 'بدل ثابت شهري',
        isFixed: true
      });
      allowancesTotal += employee.compensation.allowances.transport;
    }
    
    if (employee.compensation.allowances.food) {
      allowances.push({
        type: 'food',
        name: 'بدل طعام',
        amount: employee.compensation.allowances.food,
        reason: 'بدل ثابت شهري',
        isFixed: true
      });
      allowancesTotal += employee.compensation.allowances.food;
    }
    
    if (employee.compensation.allowances.housing) {
      allowances.push({
        type: 'housing',
        name: 'بدل سكن',
        amount: employee.compensation.allowances.housing,
        reason: 'بدل ثابت شهري',
        isFixed: true
      });
      allowancesTotal += employee.compensation.allowances.housing;
    }
  }
  
  // الساعات الإضافية
  let overtimeAmount = 0;
  let overtimeRate = 0;
  const overtimeDetails = [];
  
  if (attendanceSummary.overtimeHours > 0) {
    if (employee.employment.type === 'hourly') {
      overtimeRate = (employee.compensation.hourly || 0) * (employee.compensation.overtimeRate || 1.5);
    } else if (employee.employment.type === 'daily') {
      overtimeRate = ((employee.compensation.daily || 0) / 8) * (employee.compensation.overtimeRate || 1.5);
    } else {
      overtimeRate = ((employee.compensation.monthly || 0) / 26 / 8) * (employee.compensation.overtimeRate || 1.5);
    }
    
    overtimeAmount = overtimeRate * attendanceSummary.overtimeHours;
    
    // تفاصيل الساعات الإضافية
    attendance.forEach(a => {
      if (a.details?.overtimeHours > 0) {
        overtimeDetails.push({
          date: a.date,
          hours: a.details.overtimeHours,
          amount: overtimeRate * a.details.overtimeHours,
          reason: a.reason || 'ساعات إضافية'
        });
      }
    });
  }
  
  // العمولة (سيتم حسابها من المبيعات لاحقاً)
  const commission = {
    enabled: employee.compensation.commission?.enabled || false,
    salesAmount: 0,
    rate: employee.compensation.commission?.rate || 0,
    amount: 0,
    calculation: '',
    reason: 'عمولة مبيعات شهرية',
    target: employee.compensation.commission?.target || 0,
    exceeded: false,
    exceedanceBonus: 0
  };
  
  // المكافآت (فارغة - سيتم إضافتها يدوياً)
  const bonuses = [];
  const bonusesTotal = 0;
  
  // البقشيش (فارغ - سيتم إضافته يدوياً)
  const tips = {
    amount: 0,
    reason: '',
    distributionMethod: 'individual'
  };
  
  // إجمالي المستحقات
  const earningsTotal = basicAmount + allowancesTotal + overtimeAmount + 
                        commission.amount + bonusesTotal + tips.amount;
  
  // الخصومات
  
  // التأمينات (11% من الأساسي)
  const insuranceRate = 11;
  const insuranceAmount = (basicAmount * insuranceRate) / 100;
  
  // الضرائب (2.5% من الإجمالي)
  const taxRate = 2.5;
  const taxAmount = (earningsTotal * taxRate) / 100;
  
  // خصم الغياب
  const absenceDeductions = [];
  let absenceTotal = 0;
  
  attendance.forEach(a => {
    if (a.status === 'absent' && !a.excused) {
      const dailyRate = employee.employment.type === 'daily' 
        ? employee.compensation.daily 
        : (employee.compensation.monthly || 0) / 26;
      
      absenceDeductions.push({
        date: a.date,
        day: a.day,
        amount: dailyRate,
        reason: a.reason || 'غياب بدون عذر',
        excused: false
      });
      absenceTotal += dailyRate;
    }
  });
  
  // خصم التأخير
  const lateDeductions = [];
  let lateTotal = 0;
  
  attendance.forEach(a => {
    if (a.status === 'late' && !a.excused && a.details?.lateMinutes > 0) {
      const dailyRate = employee.employment.type === 'daily' 
        ? employee.compensation.daily 
        : (employee.compensation.monthly || 0) / 26;
      
      // خصم حسب الدقائق (كل 60 دقيقة = يوم)
      const deductionAmount = (dailyRate / 480) * a.details.lateMinutes; // 480 دقيقة = 8 ساعات
      
      lateDeductions.push({
        date: a.date,
        minutes: a.details.lateMinutes,
        amount: deductionAmount,
        reason: `تأخير ${a.details.lateMinutes} دقيقة`,
        excused: false
      });
      lateTotal += deductionAmount;
    }
  });
  
  // السلف - مع منطق الترحيل
  const activeAdvances = await Advance.find({
    employeeId: employee._id,
    organizationId,
    status: { $in: ['approved', 'paid'] },
    'repayment.remainingAmount': { $gt: 0 }
  });
  
  // جلب المبلغ المرحل من الشهر السابق
  const previousMonth = new Date(year, month - 2, 1); // الشهر السابق
  const previousMonthStr = format(previousMonth, 'yyyy-MM');
  const previousPayroll = await Payroll.findOne({
    employeeId: employee._id,
    organizationId,
    month: previousMonthStr,
    year: previousMonth.getFullYear()
  });
  
  let carriedForwardFromPrevious = 0;
  const carriedForwardAdvances = [];
  const carriedForwardDeductions = [];
  
  if (previousPayroll && previousPayroll.summary.carriedForwardToNext > 0) {
    carriedForwardFromPrevious = previousPayroll.summary.carriedForwardToNext;
    
    // جلب تفاصيل الترحيل من الشهر السابق
    if (previousPayroll.summary.carryforwardDetails) {
      if (previousPayroll.summary.carryforwardDetails.advances) {
        carriedForwardAdvances.push(...previousPayroll.summary.carryforwardDetails.advances);
      }
      if (previousPayroll.summary.carryforwardDetails.deductions) {
        carriedForwardDeductions.push(...previousPayroll.summary.carryforwardDetails.deductions);
      }
    }
  }
  
  const advanceDeductions = [];
  let advancesTotal = 0;
  
  activeAdvances.forEach(adv => {
    const deductionAmount = Math.min(
      adv.repayment.amountPerMonth,
      adv.repayment.remainingAmount
    );
    
    advanceDeductions.push({
      advanceId: adv._id,
      originalAmount: adv.amount,
      installmentNumber: adv.repayment.deductions.length + 1,
      totalInstallments: adv.repayment.installments,
      amount: deductionAmount,
      remainingAfter: adv.repayment.remainingAmount - deductionAmount,
      reason: `${adv.reason} - قسط ${adv.repayment.deductions.length + 1} من ${adv.repayment.installments}`,
      requestDate: adv.requestDate
    });
    
    advancesTotal += deductionAmount;
  });
  
  // إضافة السلف المرحلة من الشهر السابق
  carriedForwardAdvances.forEach(cfa => {
    if (cfa.remainingToCarryforward > 0) {
      advanceDeductions.push({
        advanceId: cfa.advanceId,
        originalAmount: cfa.originalAmount,
        amount: cfa.remainingToCarryforward,
        remainingAfter: 0,
        reason: `${cfa.reason} (مرحل من الشهر السابق)`,
        isCarriedForward: true
      });
      advancesTotal += cfa.remainingToCarryforward;
    }
  });
  
  // الجزاءات (فارغة - سيتم إضافتها يدوياً)
  const penalties = [];
  const penaltiesTotal = 0;
  
  // خصومات أخرى - مع إضافة المرحل من الشهر السابق
  const otherDeductions = [];
  let otherTotal = 0;
  
  carriedForwardDeductions.forEach(cfd => {
    if (cfd.remainingToCarryforward > 0) {
      otherDeductions.push({
        type: cfd.type,
        amount: cfd.remainingToCarryforward,
        reason: `${cfd.reason} (مرحل من الشهر السابق)`,
        isCarriedForward: true
      });
      otherTotal += cfd.remainingToCarryforward;
    }
  });
  
  // إجمالي الخصومات قبل تطبيق منطق الترحيل
  const totalDeductionsBeforeCarryforward = insuranceAmount + taxAmount + absenceTotal + 
                          lateTotal + advancesTotal + penaltiesTotal + otherTotal;
  
  // حساب الراتب الإجمالي
  const grossSalary = earningsTotal;
  
  // منطق الترحيل: إذا كانت الخصومات أكبر من الراتب الإجمالي
  let actualDeductionsTotal = totalDeductionsBeforeCarryforward;
  let carriedForwardToNext = 0;
  const carryforwardDetails = {
    advances: [],
    deductions: []
  };
  
  if (totalDeductionsBeforeCarryforward > grossSalary) {
    // الخصومات أكبر من الراتب - نحتاج للترحيل
    let remainingToDeduct = grossSalary;
    actualDeductionsTotal = 0;
    
    // أولوية الخصم: التأمينات والضرائب أولاً (إلزامية)
    const mandatoryDeductions = insuranceAmount + taxAmount;
    if (remainingToDeduct >= mandatoryDeductions) {
      actualDeductionsTotal += mandatoryDeductions;
      remainingToDeduct -= mandatoryDeductions;
    } else {
      // حتى الخصومات الإلزامية لا يمكن خصمها بالكامل
      actualDeductionsTotal = remainingToDeduct;
      remainingToDeduct = 0;
      
      // ترحيل الباقي من الخصومات الإلزامية
      const remainingMandatory = mandatoryDeductions - actualDeductionsTotal;
      carriedForwardToNext += remainingMandatory;
      carryforwardDetails.deductions.push({
        type: 'mandatory',
        originalAmount: mandatoryDeductions,
        deductedThisMonth: actualDeductionsTotal,
        remainingToCarryforward: remainingMandatory,
        reason: 'تأمينات وضرائب'
      });
    }
    
    // ثانياً: خصم الغياب والتأخير
    if (remainingToDeduct > 0) {
      const attendanceDeductions = absenceTotal + lateTotal;
      if (remainingToDeduct >= attendanceDeductions) {
        actualDeductionsTotal += attendanceDeductions;
        remainingToDeduct -= attendanceDeductions;
      } else {
        actualDeductionsTotal += remainingToDeduct;
        const remainingAttendance = attendanceDeductions - remainingToDeduct;
        carriedForwardToNext += remainingAttendance;
        carryforwardDetails.deductions.push({
          type: 'attendance',
          originalAmount: attendanceDeductions,
          deductedThisMonth: remainingToDeduct,
          remainingToCarryforward: remainingAttendance,
          reason: 'خصومات الغياب والتأخير'
        });
        remainingToDeduct = 0;
      }
    } else if (absenceTotal + lateTotal > 0) {
      // لا يوجد مبلغ متبقي للخصم
      carriedForwardToNext += absenceTotal + lateTotal;
      carryforwardDetails.deductions.push({
        type: 'attendance',
        originalAmount: absenceTotal + lateTotal,
        deductedThisMonth: 0,
        remainingToCarryforward: absenceTotal + lateTotal,
        reason: 'خصومات الغياب والتأخير'
      });
    }
    
    // ثالثاً: السلف
    if (remainingToDeduct > 0 && advancesTotal > 0) {
      if (remainingToDeduct >= advancesTotal) {
        actualDeductionsTotal += advancesTotal;
        remainingToDeduct -= advancesTotal;
      } else {
        // خصم جزئي من السلف
        actualDeductionsTotal += remainingToDeduct;
        const remainingAdvances = advancesTotal - remainingToDeduct;
        carriedForwardToNext += remainingAdvances;
        
        // توزيع المبلغ المتبقي على السلف بالتناسب
        advanceDeductions.forEach(adv => {
          const proportion = adv.amount / advancesTotal;
          const deductedAmount = remainingToDeduct * proportion;
          const remainingAmount = adv.amount - deductedAmount;
          
          if (remainingAmount > 0) {
            carryforwardDetails.advances.push({
              advanceId: adv.advanceId,
              originalAmount: adv.amount,
              deductedThisMonth: deductedAmount,
              remainingToCarryforward: remainingAmount,
              reason: adv.reason
            });
          }
        });
        
        remainingToDeduct = 0;
      }
    } else if (advancesTotal > 0) {
      // لا يوجد مبلغ متبقي - ترحيل كل السلف
      carriedForwardToNext += advancesTotal;
      advanceDeductions.forEach(adv => {
        carryforwardDetails.advances.push({
          advanceId: adv.advanceId,
          originalAmount: adv.amount,
          deductedThisMonth: 0,
          remainingToCarryforward: adv.amount,
          reason: adv.reason
        });
      });
    }
    
    // رابعاً: الجزاءات والخصومات الأخرى
    if (remainingToDeduct > 0 && (penaltiesTotal + otherTotal) > 0) {
      const otherTotal2 = penaltiesTotal + otherTotal;
      if (remainingToDeduct >= otherTotal2) {
        actualDeductionsTotal += otherTotal2;
        remainingToDeduct -= otherTotal2;
      } else {
        actualDeductionsTotal += remainingToDeduct;
        const remainingOther = otherTotal2 - remainingToDeduct;
        carriedForwardToNext += remainingOther;
        carryforwardDetails.deductions.push({
          type: 'other',
          originalAmount: otherTotal2,
          deductedThisMonth: remainingToDeduct,
          remainingToCarryforward: remainingOther,
          reason: 'جزاءات وخصومات أخرى'
        });
        remainingToDeduct = 0;
      }
    } else if ((penaltiesTotal + otherTotal) > 0) {
      carriedForwardToNext += penaltiesTotal + otherTotal;
      carryforwardDetails.deductions.push({
        type: 'other',
        originalAmount: penaltiesTotal + otherTotal,
        deductedThisMonth: 0,
        remainingToCarryforward: penaltiesTotal + otherTotal,
        reason: 'جزاءات وخصومات أخرى'
      });
    }
  }
  
  // الملخص
  const netSalary = grossSalary - actualDeductionsTotal;
  
  return {
    employeeSnapshot: {
      type: employee.employment.type,
      dailyRate: employee.compensation.daily,
      hourlyRate: employee.compensation.hourly,
      monthlyRate: employee.compensation.monthly,
      department: employee.employment.department,
      position: employee.employment.position
    },
    attendance: {
      ...attendanceSummary,
      dailyRecords: attendance.map(a => ({
        date: a.date,
        day: a.day,
        status: a.status,
        checkIn: a.checkIn ? format(a.checkIn, 'HH:mm') : null,
        checkOut: a.checkOut ? format(a.checkOut, 'HH:mm') : null,
        hours: a.details?.totalHours || 0,
        overtime: a.details?.overtimeHours || 0,
        lateMinutes: a.details?.lateMinutes || 0,
        reason: a.reason,
        excused: a.excused,
        notes: a.notes,
        dailySalary: a.details?.dailySalary || 0,
        overtimePay: a.details?.overtimePay || 0,
        totalPay: a.details?.totalPay || 0
      }))
    },
    earnings: {
      basic: {
        amount: basicAmount,
        calculation: basicCalculation,
        days: daysWorked,
        rate: employee.employment.type === 'daily' ? employee.compensation.daily : 
              employee.employment.type === 'hourly' ? employee.compensation.hourly :
              employee.compensation.monthly
      },
      allowances,
      allowancesTotal,
      overtime: {
        hours: attendanceSummary.overtimeHours,
        rate: overtimeRate,
        amount: overtimeAmount,
        calculation: `${attendanceSummary.overtimeHours} ساعة × ${overtimeRate.toFixed(2)} جنيه`,
        reason: 'ساعات إضافية معتمدة',
        details: overtimeDetails
      },
      commission,
      bonuses,
      bonusesTotal,
      tips,
      total: earningsTotal
    },
    deductions: {
      insurance: {
        rate: insuranceRate,
        baseAmount: basicAmount,
        amount: insuranceAmount,
        calculation: `${basicAmount} × ${insuranceRate}%`,
        reason: 'تأمينات اجتماعية إلزامية',
        mandatory: true
      },
      tax: {
        taxableAmount: earningsTotal,
        rate: taxRate,
        amount: taxAmount,
        calculation: `${earningsTotal.toFixed(2)} × ${taxRate}%`,
        reason: 'ضريبة دخل',
        mandatory: true
      },
      absence: absenceDeductions,
      absenceTotal,
      late: lateDeductions,
      lateTotal,
      advances: advanceDeductions,
      advancesTotal,
      penalties,
      penaltiesTotal,
      other: otherDeductions,
      otherTotal,
      total: actualDeductionsTotal
    },
    summary: {
      grossSalary,
      totalDeductions: actualDeductionsTotal,
      netSalary,
      paidAmount: 0,
      unpaidBalance: netSalary,
      carriedForwardFromPrevious,
      carriedForwardToNext,
      carryforwardDetails,
      carriedForward: carriedForwardToNext
    }
  };
};

// Get all payrolls
export const getPayrolls = async (req, res) => {
  try {
    const { month, year, employeeId, status } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    
    const payrolls = await Payroll.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .populate('workflow.createdBy', 'username')
      .populate('workflow.approvedBy', 'username')
      .populate('workflow.paidBy', 'username')
      .sort({ year: -1, month: -1, employeeName: 1 });
    
    res.json({ success: true, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get payroll by ID
export const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    })
      .populate('employeeId')
      .populate('workflow.createdBy', 'username')
      .populate('workflow.approvedBy', 'username')
      .populate('workflow.paidBy', 'username')
      .populate('revisions.editedBy', 'username');
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    res.json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create/Generate payroll
export const generatePayroll = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;
    
    // التحقق من وجود الموظف
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }
    
    // التحقق من عدم وجود كشف راتب لنفس الشهر
    const existing = await Payroll.findOne({
      employeeId,
      month: `${year}-${month.toString().padStart(2, '0')}`,
      year,
      organizationId: req.user.organization
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'يوجد كشف راتب لهذا الشهر بالفعل' });
    }
    
    // حساب الراتب
    const payrollData = await calculatePayroll(
      employee,
      month,
      year,
      req.user.organization
    );
    
    // إنشاء كشف الراتب
    const payroll = new Payroll({
      employeeId,
      employeeName: employee.personalInfo.name,
      month: `${year}-${month.toString().padStart(2, '0')}`,
      year,
      ...payrollData,
      workflow: {
        createdAt: new Date(),
        createdBy: req.user._id
      },
      organizationId: req.user.organization
    });
    
    await payroll.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء كشف الراتب بنجاح',
      data: payroll
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Bulk generate payrolls
export const bulkGeneratePayrolls = async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    
    const results = [];
    const errors = [];
    
    for (const employeeId of employeeIds) {
      try {
        const employee = await Employee.findOne({
          _id: employeeId,
          organizationId: req.user.organization,
          'employment.status': 'active'
        });
        
        if (!employee) {
          errors.push({ employeeId, error: 'الموظف غير موجود أو غير نشط' });
          continue;
        }
        
        // التحقق من عدم وجود كشف راتب
        const existing = await Payroll.findOne({
          employeeId,
          month: `${year}-${month.toString().padStart(2, '0')}`,
          year,
          organizationId: req.user.organization
        });
        
        if (existing) {
          errors.push({ employeeId, error: 'يوجد كشف راتب بالفعل' });
          continue;
        }
        
        // حساب وإنشاء كشف الراتب
        const payrollData = await calculatePayroll(
          employee,
          month,
          year,
          req.user.organization
        );
        
        const payroll = new Payroll({
          employeeId,
          employeeName: employee.personalInfo.name,
          month: `${year}-${month.toString().padStart(2, '0')}`,
          year,
          ...payrollData,
          workflow: {
            createdAt: new Date(),
            createdBy: req.user._id
          },
          organizationId: req.user.organization
        });
        
        await payroll.save();
        results.push(payroll);
        
      } catch (error) {
        errors.push({ employeeId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `تم إنشاء ${results.length} كشف راتب بنجاح`,
      data: {
        results,
        errors
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper functions
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

function recalculatePayrollTotals(payroll) {
  // إعادة حساب إجمالي المستحقات
  payroll.earnings.allowancesTotal = payroll.earnings.allowances.reduce(
    (sum, a) => sum + a.amount, 0
  );
  
  payroll.earnings.bonusesTotal = payroll.earnings.bonuses.reduce(
    (sum, b) => sum + b.amount, 0
  );
  
  payroll.earnings.total = 
    payroll.earnings.basic.amount +
    payroll.earnings.allowancesTotal +
    payroll.earnings.overtime.amount +
    payroll.earnings.commission.amount +
    payroll.earnings.bonusesTotal +
    payroll.earnings.tips.amount;
  
  // إعادة حساب إجمالي الخصومات
  payroll.deductions.absenceTotal = payroll.deductions.absence.reduce(
    (sum, a) => sum + a.amount, 0
  );
  
  payroll.deductions.lateTotal = payroll.deductions.late.reduce(
    (sum, l) => sum + l.amount, 0
  );
  
  payroll.deductions.advancesTotal = payroll.deductions.advances.reduce(
    (sum, a) => sum + a.amount, 0
  );
  
  payroll.deductions.penaltiesTotal = payroll.deductions.penalties.reduce(
    (sum, p) => sum + p.amount, 0
  );
  
  payroll.deductions.otherTotal = payroll.deductions.other.reduce(
    (sum, o) => sum + o.amount, 0
  );
  
  payroll.deductions.total =
    payroll.deductions.insurance.amount +
    payroll.deductions.tax.amount +
    payroll.deductions.absenceTotal +
    payroll.deductions.lateTotal +
    payroll.deductions.advancesTotal +
    payroll.deductions.penaltiesTotal +
    payroll.deductions.otherTotal;
  
  // إعادة حساب الملخص
  payroll.summary.grossSalary = payroll.earnings.total;
  payroll.summary.totalDeductions = payroll.deductions.total;
  payroll.summary.netSalary = payroll.summary.grossSalary - payroll.summary.totalDeductions;
  payroll.summary.unpaidBalance = payroll.summary.netSalary - (payroll.summary.paidAmount || 0);
}

// Get payroll history for employee
export const getEmployeePayrollHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const payrolls = await Payroll.find({
      employeeId,
      organizationId: req.user.organization
    })
      .sort({ year: -1, month: -1 })
      .select('payrollId month year status summary attendance');
    
    // حساب الإحصائيات
    const stats = {
      totalPayrolls: payrolls.length,
      totalGross: payrolls.reduce((sum, p) => sum + (p.summary?.grossSalary || 0), 0),
      totalDeductions: payrolls.reduce((sum, p) => sum + (p.summary?.totalDeductions || 0), 0),
      totalNet: payrolls.reduce((sum, p) => sum + (p.summary?.netSalary || 0), 0),
      totalPaid: payrolls.reduce((sum, p) => sum + (p.summary?.paidAmount || 0), 0)
    };
    
    res.json({
      success: true,
      data: {
        payrolls,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// Get comprehensive payroll summary for all employees
export const getPayrollSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Get all active employees
    const employees = await Employee.find({
      organizationId: req.user.organization,
      'employment.status': 'active'
    });
    
    if (!employees || employees.length === 0) {
      return res.json({
        success: true,
        data: {
          month: month || 'all',
          year: year || 'all',
          totalEmployees: 0,
          statistics: {
            totalGrossSalary: 0,
            totalDeductions: 0,
            totalNetSalary: 0,
            totalPaid: 0,
            totalUnpaid: 0,
            totalAdvances: 0,
            totalOtherDeductions: 0
          },
          employees: []
        }
      });
    }
    
    // Calculate date range
    const monthNum = month ? parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}`;
    
    // Create dates in local timezone to avoid timezone issues
    const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    
    // Determine end date
    const today = new Date();
    const isCurrentMonth = (today.getMonth() + 1 === monthNum && today.getFullYear() === yearNum);
    const endDate = isCurrentMonth 
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
      : new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    
    // Get total days in the month for absence calculation
    const daysInMonth = getDaysInMonth(new Date(yearNum, monthNum - 1));
    
    console.log('Summary calculation:', { 
      monthStr, 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString(), 
      isCurrentMonth,
      daysInMonth,
      startDateLocal: `${startDate.getFullYear()}-${(startDate.getMonth()+1).toString().padStart(2,'0')}-${startDate.getDate().toString().padStart(2,'0')}`,
      endDateLocal: `${endDate.getFullYear()}-${(endDate.getMonth()+1).toString().padStart(2,'0')}-${endDate.getDate().toString().padStart(2,'0')}`
    });
    
    // Calculate statistics for each employee
    let totalGrossSalary = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalAdvances = 0;
    let totalOtherDeductions = 0;
    
    const employeesData = [];
    
    for (const employee of employees) {
      try {
        // Determine calculation end date for this employee
        let employeeEndDate = endDate;
        
        // If employee is suspended or terminated, calculate only until last attendance
        if (employee.employment.status === 'suspended' || employee.employment.status === 'terminated') {
          const lastAttendance = await Attendance.findOne({
            employeeId: employee._id,
            organizationId: req.user.organization,
            date: { $gte: startDate, $lte: endDate }
          }).sort({ date: -1 });
          
          if (lastAttendance) {
            employeeEndDate = lastAttendance.date;
            console.log(`Employee ${employee.personalInfo?.name} is ${employee.employment.status}. Calculating until last attendance: ${employeeEndDate}`);
          } else {
            console.log(`Employee ${employee.personalInfo?.name} is ${employee.employment.status} with no attendance. Skipping.`);
            continue;
          }
        }
        
        // Get attendance for the month
        const attendance = await Attendance.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          date: { $gte: startDate, $lte: employeeEndDate }
        });
        
        // Calculate salary based on employment type
        let grossSalary = 0;
        let salaryCalculationNote = '';
        
        if (employee.employment.type === 'monthly') {
          // For monthly employees: calculate based on attendance days
          // Gross = (Monthly Salary ÷ Days in Month) × Days Present
          const daysPresent = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
          const dailyRate = (employee.compensation.monthly || 0) / daysInMonth;
          grossSalary = dailyRate * daysPresent;
          salaryCalculationNote = `(${employee.compensation.monthly} ÷ ${daysInMonth}) × ${daysPresent} = ${dailyRate.toFixed(2)} × ${daysPresent} = ${grossSalary.toFixed(2)} جنيه`;
        } else if (employee.employment.type === 'daily') {
          // For daily employees: salary based on days worked
          const daysWorked = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
          grossSalary = (employee.compensation.daily || 0) * daysWorked;
          salaryCalculationNote = `${daysWorked} يوم × ${employee.compensation.daily} = ${grossSalary} جنيه`;
        } else if (employee.employment.type === 'hourly') {
          // For hourly employees: salary based on hours worked
          const totalHours = attendance.reduce((sum, a) => sum + (a.details?.totalHours || 0), 0);
          grossSalary = (employee.compensation.hourly || 0) * totalHours;
          salaryCalculationNote = `${totalHours} ساعة × ${employee.compensation.hourly} = ${grossSalary} جنيه`;
        }
        
        console.log(`\n=== Salary Calculation for ${employee.personalInfo?.name} ===`);
        console.log(`Employment Type: ${employee.employment.type}`);
        console.log(`Attendance Records: ${attendance.length}`);
        console.log(`Calculation: ${salaryCalculationNote}`);
        console.log(`Gross Salary: ${grossSalary.toFixed(2)} EGP`);
        
        // Get ALL advances for this employee
        const allAdvances = await Advance.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          status: { $in: ['approved', 'paid', 'completed'] }
        });
        
        console.log(`\n--- Advances for ${employee.personalInfo?.name} (${monthStr}) ---`);
        console.log(`Total advances in DB: ${allAdvances.length}`);
        
        let advancesTotal = 0;
        
        // Calculate advances for this month
        for (const adv of allAdvances) {
          const advanceDate = adv.disbursement?.paidDate || adv.approvalDate || adv.requestDate;
          
          if (advanceDate && advanceDate <= endDate) {
            // Check if there's already a deduction recorded for this month
            const deductionForMonth = adv.repayment?.deductions?.find(d => d.month === monthStr);
            
            if (deductionForMonth) {
              console.log(`  ✓ Deduction recorded: ${deductionForMonth.amount} EGP`);
              advancesTotal += deductionForMonth.amount;
            } else if (adv.repayment?.remainingAmount > 0) {
              const startMonth = adv.repayment?.startMonth || monthStr;
              
              if (monthStr >= startMonth) {
                const deductionAmount = Math.min(
                  adv.repayment.amountPerMonth || adv.amount,
                  adv.repayment.remainingAmount
                );
                
                if (deductionAmount > 0) {
                  console.log(`  ✓ Calculated deduction: ${deductionAmount} EGP`);
                  advancesTotal += deductionAmount;
                }
              }
            }
          }
        }
        
        console.log(`\n→ Total advances for ${employee.personalInfo?.name}: ${advancesTotal} EGP\n`);
        
        // Get manual deductions for the month
        const manualDeductions = await Deduction.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          month: monthStr
        });
        const manualDeductionsTotal = manualDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0);
        
        // NO automatic absence deduction
        // Deductions are ONLY from manual entries in Deduction table
        // Absence does NOT automatically create a deduction
        
        console.log(`\n--- Manual Deductions for ${employee.personalInfo?.name} (${monthStr}) ---`);
        console.log(`Manual deductions count: ${manualDeductions.length}`);
        console.log(`Manual deductions total: ${manualDeductionsTotal} EGP`);
        
        const otherDeductionsTotal = manualDeductionsTotal;
        const totalDeductionsEmp = advancesTotal + otherDeductionsTotal;
        const netSalary = grossSalary - totalDeductionsEmp;
        
        // Get payments for the month
        const payments = await Payment.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          month: monthStr
        });
        const paidAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const unpaidBalance = Math.max(0, netSalary - paidAmount);
        
        // Calculate carried forward from previous months
        // Using the SAME logic as EmployeeProfile (paymentController.js)
        let carriedForward = 0;
        
        const hireDate = employee.personalInfo?.hireDate || employee.createdAt || new Date('2020-01-01');
        const previousMonthEnd = new Date(startDate);
        previousMonthEnd.setDate(0); // آخر يوم من الشهر السابق
        
        console.log(`\n--- Calculating Carried Forward for ${employee.personalInfo?.name} ---`);
        console.log(`Hire Date: ${hireDate}`);
        console.log(`Previous Month End: ${previousMonthEnd}`);
        
        // Get all previous attendance
        const previousAttendance = await Attendance.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          date: { $gte: hireDate, $lte: previousMonthEnd }
        });
        
        console.log(`Previous Attendance Records: ${previousAttendance.length}`);
        
        // Calculate previous salaries based on employment type
        let previousSalaries = 0;
        
        if (employee.employment.type === 'monthly') {
          // For monthly employees: group by month and calculate based on attendance
          const attendanceByMonth = {};
          
          previousAttendance.forEach(record => {
            const recordMonth = record.date.toISOString().substring(0, 7); // YYYY-MM
            if (!attendanceByMonth[recordMonth]) {
              attendanceByMonth[recordMonth] = {
                present: 0,
                totalDays: 0
              };
            }
            
            attendanceByMonth[recordMonth].totalDays++;
            if (record.status === 'present' || record.status === 'late') {
              attendanceByMonth[recordMonth].present++;
            }
          });
          
          // Calculate salary for each month
          Object.keys(attendanceByMonth).forEach(monthKey => {
            const monthData = attendanceByMonth[monthKey];
            const [year, monthNum] = monthKey.split('-');
            const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
            
            // Salary = (Monthly Salary ÷ Days in Month) × Days Present
            const monthlySalary = employee.compensation?.monthly || 0;
            const monthSalary = (monthlySalary / daysInMonth) * monthData.present;
            
            previousSalaries += monthSalary;
            
            console.log(`  Month ${monthKey}: ${monthData.present} days present out of ${daysInMonth} days = ${monthSalary.toFixed(2)} EGP`);
          });
        } else if (employee.employment.type === 'daily') {
          // For daily employees: use totalPay from records
          previousSalaries = previousAttendance.reduce((sum, record) => 
            sum + (record.details?.totalPay || 0), 0
          );
        } else if (employee.employment.type === 'hourly') {
          // For hourly employees: use totalPay from records
          previousSalaries = previousAttendance.reduce((sum, record) => 
            sum + (record.details?.totalPay || 0), 0
          );
        }
        
        console.log(`Previous Salaries (calculated): ${previousSalaries.toFixed(2)} EGP`);
        
        // Get all previous advances
        const previousAdvances = await Advance.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          status: { $in: ['approved', 'paid'] },
          requestDate: { $lte: previousMonthEnd }
        });
        
        const previousAdvancesTotal = previousAdvances.reduce((sum, adv) => sum + adv.amount, 0);
        console.log(`Previous Advances Total: ${previousAdvancesTotal.toFixed(2)} EGP`);
        
        // Get all previous deductions
        const previousDeductions = await Deduction.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          date: { $lte: previousMonthEnd }
        });
        
        const previousDeductionsTotal = previousDeductions.reduce((sum, ded) => sum + ded.amount, 0);
        console.log(`Previous Deductions Total: ${previousDeductionsTotal.toFixed(2)} EGP`);
        
        // Get all previous payments
        const previousPayments = await Payment.find({
          employeeId: employee._id,
          organizationId: req.user.organization,
          paymentDate: { $lte: previousMonthEnd }
        });
        
        const previousPaid = previousPayments.reduce((sum, pay) => sum + pay.amount, 0);
        console.log(`Previous Paid: ${previousPaid.toFixed(2)} EGP`);
        
        // Carried Forward = (Previous Salaries - Previous Advances - Previous Deductions) - Previous Paid
        // This can be positive (مستحقات) or negative (ديون)
        carriedForward = (previousSalaries - previousAdvancesTotal - previousDeductionsTotal) - previousPaid;
        
        console.log(`\n========== CARRIED FORWARD CALCULATION ==========`);
        console.log(`Previous Salaries: ${previousSalaries.toFixed(2)}`);
        console.log(`Previous Advances: ${previousAdvancesTotal.toFixed(2)}`);
        console.log(`Previous Deductions: ${previousDeductionsTotal.toFixed(2)}`);
        console.log(`Previous Paid: ${previousPaid.toFixed(2)}`);
        console.log(`Calculation: (${previousSalaries.toFixed(2)} - ${previousAdvancesTotal.toFixed(2)} - ${previousDeductionsTotal.toFixed(2)}) - ${previousPaid.toFixed(2)}`);
        console.log(`Carried Forward Result: ${carriedForward.toFixed(2)} EGP`);
        console.log(`=================================================\n`);
        
        const totalUnpaidWithCarried = unpaidBalance + carriedForward;
        
        console.log(`\n=== Employee: ${employee.personalInfo?.name} ===`);
        console.log(`Gross Salary: ${grossSalary}`);
        console.log(`Advances: ${advancesTotal}`);
        console.log(`Manual Deductions: ${manualDeductionsTotal}`);
        console.log(`Other Deductions Total: ${otherDeductionsTotal}`);
        console.log(`Total Deductions: ${totalDeductionsEmp}`);
        console.log(`Net Salary: ${netSalary}`);
        console.log(`Paid Amount: ${paidAmount}`);
        console.log(`Unpaid Balance (Current Month): ${unpaidBalance}`);
        console.log(`Carried Forward: ${carriedForward}`);
        console.log(`Total Unpaid (with Carried): ${totalUnpaidWithCarried}`);
        console.log(`===================================\n`);
        
        totalGrossSalary += grossSalary;
        totalDeductions += totalDeductionsEmp;
        totalNetSalary += netSalary;
        totalPaid += paidAmount;
        totalUnpaid += totalUnpaidWithCarried;
        totalAdvances += advancesTotal;
        totalOtherDeductions += otherDeductionsTotal;
        
        employeesData.push({
          employeeId: employee._id,
          employeeName: employee.personalInfo?.name || 'غير معروف',
          department: employee.employment?.department || '-',
          position: employee.employment?.position || '-',
          grossSalary,
          advances: advancesTotal,
          otherDeductions: otherDeductionsTotal,
          deductions: totalDeductionsEmp,
          netSalary,
          paidAmount,
          unpaidBalance,
          carriedForward,
          totalUnpaid: totalUnpaidWithCarried,
          status: totalUnpaidWithCarried <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'approved',
          month: monthStr,
          year: yearNum
        });
      } catch (empError) {
        console.error(`Error calculating for employee ${employee._id}:`, empError);
      }
    }
    
    console.log('\n=== SUMMARY TOTALS ===');
    console.log(`Total Employees: ${employeesData.length}`);
    console.log(`Total Gross Salary: ${totalGrossSalary}`);
    console.log(`Total Advances: ${totalAdvances}`);
    console.log(`Total Other Deductions: ${totalOtherDeductions}`);
    console.log(`Total Deductions: ${totalDeductions}`);
    console.log(`Total Net Salary: ${totalNetSalary}`);
    console.log(`Total Paid: ${totalPaid}`);
    console.log(`Total Unpaid: ${totalUnpaid}`);
    console.log('======================\n');
    
    res.json({
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        totalEmployees: employeesData.length,
        statistics: {
          totalGrossSalary,
          totalDeductions,
          totalNetSalary,
          totalPaid,
          totalUnpaid,
          totalAdvances,
          totalOtherDeductions
        },
        employees: employeesData
      }
    });
  } catch (error) {
    console.error('Error in getPayrollSummary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// Edit payroll
export const editPayroll = async (req, res) => {
  try {
    const { changes, reason } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    // التحقق من إمكانية التعديل
    if (payroll.workflow.lockedAt) {
      return res.status(403).json({ success: false, error: 'الكشف مقفل ولا يمكن تعديله' });
    }
    
    // حفظ النسخة الأصلية للمقارنة
    const originalData = payroll.toObject();
    
    // إنشاء سجل المراجعة
    const revision = {
      revisionNumber: payroll.revisions.length + 1,
      date: new Date(),
      editedBy: req.user._id,
      changes: []
    };
    
    // تطبيق التغييرات
    for (const change of changes) {
      const oldValue = getNestedValue(payroll, change.field);
      setNestedValue(payroll, change.field, change.newValue);
      
      revision.changes.push({
        field: change.field,
        oldValue,
        newValue: change.newValue,
        reason: change.reason || reason
      });
    }
    
    // إعادة حساب الإجماليات
    recalculatePayrollTotals(payroll);
    
    // إضافة المراجعة
    payroll.revisions.push(revision);
    
    // إذا كان مدفوعاً، يحتاج موافقة مجدداً
    if (payroll.status === 'paid') {
      payroll.status = 'pending';
    }
    
    await payroll.save();
    
    res.json({
      success: true,
      message: 'تم تعديل كشف الراتب بنجاح',
      data: {
        payroll,
        revision
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Approve payroll
export const approvePayroll = async (req, res) => {
  try {
    const { notes } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    if (payroll.status === 'locked') {
      return res.status(400).json({ success: false, error: 'الكشف مقفل' });
    }
    
    payroll.status = 'approved';
    payroll.workflow.approvedAt = new Date();
    payroll.workflow.approvedBy = req.user._id;
    payroll.workflow.approvalNotes = notes;
    
    await payroll.save();
    
    res.json({
      success: true,
      message: 'تم اعتماد كشف الراتب بنجاح',
      data: payroll
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Pay payroll
export const payPayroll = async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    }).populate('employeeId');
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    if (payroll.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'يجب اعتماد الكشف أولاً' });
    }
    
    // تحديث معلومات الدفع
    payroll.summary.paidAmount += amount;
    payroll.summary.unpaidBalance = payroll.summary.netSalary - payroll.summary.paidAmount;
    
    if (payroll.summary.unpaidBalance <= 0) {
      payroll.status = 'paid';
      payroll.summary.unpaidBalance = 0;
    }
    
    payroll.workflow.paidAt = new Date();
    payroll.workflow.paidBy = req.user._id;
    payroll.workflow.paymentMethod = method;
    payroll.workflow.paymentReference = reference;
    
    await payroll.save();
    
    // تسجيل خصم السلف
    if (payroll.deductions.advances.length > 0) {
      for (const advDeduction of payroll.deductions.advances) {
        await Advance.findByIdAndUpdate(advDeduction.advanceId, {
          $push: {
            'repayment.deductions': {
              month: payroll.month,
              amount: advDeduction.amount,
              payrollId: payroll._id,
              date: new Date()
            }
          },
          $inc: {
            'repayment.totalPaid': advDeduction.amount,
            'repayment.remainingAmount': -advDeduction.amount
          }
        });
        
        // تحديث حالة السلفة إذا تم السداد بالكامل
        const advance = await Advance.findById(advDeduction.advanceId);
        if (advance && advance.repayment.remainingAmount <= 0) {
          advance.status = 'completed';
          await advance.save();
        }
      }
    }
    
    res.json({
      success: true,
      message: 'تم دفع الراتب بنجاح',
      data: payroll
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lock payroll
export const lockPayroll = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    if (payroll.workflow.lockedAt) {
      return res.status(400).json({ success: false, error: 'الكشف مقفل بالفعل' });
    }
    
    payroll.status = 'locked';
    payroll.workflow.lockedAt = new Date();
    payroll.workflow.lockedBy = req.user._id;
    payroll.workflow.lockReason = reason;
    
    await payroll.save();
    
    res.json({
      success: true,
      message: 'تم قفل كشف الراتب بنجاح',
      data: payroll
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Unlock payroll
export const unlockPayroll = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    if (!payroll.workflow.lockedAt) {
      return res.status(400).json({ success: false, error: 'الكشف غير مقفل' });
    }
    
    payroll.status = payroll.workflow.paidAt ? 'paid' : 'approved';
    payroll.workflow.lockedAt = null;
    payroll.workflow.lockedBy = null;
    payroll.workflow.unlockReason = reason;
    
    await payroll.save();
    
    res.json({
      success: true,
      message: 'تم فك قفل كشف الراتب بنجاح',
      data: payroll
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete payroll
export const deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    // لا يمكن حذف كشف مدفوع أو مقفل
    if (payroll.status === 'paid' || payroll.status === 'locked') {
      return res.status(400).json({ success: false, error: 'لا يمكن حذف كشف راتب مدفوع أو مقفل' });
    }
    
    await payroll.deleteOne();
    
    res.json({ success: true, message: 'تم حذف كشف الراتب بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get payroll statistics
export const getPayrollStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const query = { organizationId: req.user.organization };
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    
    const stats = await Payroll.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          paid: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          locked: {
            $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] }
          },
          totalGrossSalary: { $sum: '$summary.grossSalary' },
          totalDeductions: { $sum: '$summary.totalDeductions' },
          totalNetSalary: { $sum: '$summary.netSalary' },
          totalPaid: { $sum: '$summary.paidAmount' },
          totalUnpaid: { $sum: '$summary.unpaidBalance' }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          draft: 0,
          pending: 0,
          approved: 0,
          paid: 0,
          locked: 0,
          totalGrossSalary: 0,
          totalDeductions: 0,
          totalNetSalary: 0,
          totalPaid: 0,
          totalUnpaid: 0
        }
      });
    }
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Print payroll
export const printPayroll = async (req, res) => {
  try {
    const { template, options } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    }).populate('employeeId');
    
    if (!payroll) {
      return res.status(404).json({ success: false, error: 'كشف الراتب غير موجود' });
    }
    
    // استيراد خدمة PDF
    const { generatePayslipPDF } = await import('../services/payrollPdfService.js');
    
    // إنشاء PDF
    const pdf = await generatePayslipPDF(payroll, {
      template: template || 'detailed',
      ...options
    });
    
    // حفظ سجل الطباعة
    const printId = `PRINT-${Date.now()}`;
    payroll.prints.push({
      printId,
      date: new Date(),
      printedBy: req.user._id,
      template: template || 'detailed'
    });
    
    await payroll.save();
    
    // إرسال PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payroll.payrollId}.pdf`);
    res.send(pdf.buffer);
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
