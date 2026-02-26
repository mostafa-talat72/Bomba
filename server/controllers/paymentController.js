import Payment from '../models/Payment.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Deduction from '../models/Deduction.js';

// Get employee salary summary (cumulative)
export const getEmployeeSalarySummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query; // YYYY-MM
    
    if (!month) {
      return res.status(400).json({ success: false, error: 'الشهر مطلوب' });
    }
    
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }
    
    const hireDate = employee.personalInfo?.hireDate || employee.createdAt || new Date('2020-01-01');
    
    // تحديد نطاق الشهر الحالي
    const currentMonthStart = new Date(month + '-01');
    const currentMonthEnd = new Date(month + '-01');
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);
    currentMonthEnd.setDate(0);
    
    // تحديد نطاق الأشهر السابقة - من تاريخ التوظيف
    const previousMonthEnd = new Date(currentMonthStart);
    previousMonthEnd.setDate(0); // آخر يوم من الشهر السابق
    
  
    // ========== الشهر الحالي ==========
    const currentMonthAttendance = await Attendance.find({
      employeeId,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd },
      organizationId: req.user.organization
    });
    
    // حساب راتب الشهر الحالي بناءً على نوع التوظيف
    let currentMonthSalary = 0;
    
    if (employee.employment.type === 'monthly') {
      // للموظف الشهري: نحسب الراتب بناءً على أيام الحضور
      const daysInMonth = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0).getDate();
      const daysPresent = currentMonthAttendance.filter(record => 
        record.status === 'present' || record.status === 'late'
      ).length;
      
      const monthlySalary = employee.compensation?.monthly || 0;
      currentMonthSalary = (monthlySalary / daysInMonth) * daysPresent;
      
    } else {
      // للموظف اليومي أو بالساعة: نستخدم totalPay من السجلات
      currentMonthSalary = currentMonthAttendance.reduce((sum, record) => 
        sum + (record.details?.totalPay || 0), 0
      );
    }
    
    const currentMonthAdvances = await Advance.find({
      employeeId,
      status: { $in: ['approved', 'paid'] },
      requestDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
      organizationId: req.user.organization
    });
    
    const currentMonthAdvancesTotal = currentMonthAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    
    const currentMonthDeductions = await Deduction.find({
      employeeId,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd },
      organizationId: req.user.organization
    });
    
    const currentMonthDeductionsTotal = currentMonthDeductions.reduce((sum, ded) => sum + ded.amount, 0);
    
    const currentMonthPayments = await Payment.find({
      employeeId,
      month: month,
      organizationId: req.user.organization
    });
    
    const currentMonthPaid = currentMonthPayments.reduce((sum, pay) => sum + pay.amount, 0);
    
    // ========== الأشهر السابقة ==========
    const previousAttendance = await Attendance.find({
      employeeId,
      date: { $gte: hireDate, $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
   
    // حساب الرواتب السابقة بناءً على نوع التوظيف
    let previousSalaries = 0;
    
    if (employee.employment.type === 'monthly') {
      // للموظف الشهري: نحسب الراتب بناءً على أيام الحضور
      // نجمع الحضور حسب الشهر
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
      
      // حساب الراتب لكل شهر
      Object.keys(attendanceByMonth).forEach(monthKey => {
        const monthData = attendanceByMonth[monthKey];
        const [year, monthNum] = monthKey.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        
        // الراتب = (الراتب الشهري ÷ أيام الشهر) × أيام الحضور
        const monthlySalary = employee.compensation?.monthly || 0;
        const monthSalary = (monthlySalary / daysInMonth) * monthData.present;
        
        previousSalaries += monthSalary;
        
      });
    } else {
      // للموظف اليومي أو بالساعة: نستخدم totalPay من السجلات
      previousSalaries = previousAttendance.reduce((sum, record) => 
        sum + (record.details?.totalPay || 0), 0
      );
    }
        
    const previousAdvances = await Advance.find({
      employeeId,
      status: { $in: ['approved', 'paid'] },
      requestDate: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
        
    const previousAdvancesTotal = previousAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    
    const previousDeductions = await Deduction.find({
      employeeId,
      date: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
    const previousDeductionsTotal = previousDeductions.reduce((sum, ded) => sum + ded.amount, 0);
    
    const previousPayments = await Payment.find({
      employeeId,
      paymentDate: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });    
    const previousPaid = previousPayments.reduce((sum, pay) => sum + pay.amount, 0);
    
    // ========== الحسابات ==========
    // المرحل من الأشهر السابقة
    const carriedForward = (previousSalaries - previousAdvancesTotal - previousDeductionsTotal) - previousPaid;

    // الإجماليات التراكمية (حتى نهاية الشهر الحالي)
    const totalSalaries = previousSalaries + currentMonthSalary;
    const totalAdvances = previousAdvancesTotal + currentMonthAdvancesTotal;
    const totalDeductions = previousDeductionsTotal + currentMonthDeductionsTotal;
    const totalPaid = previousPaid + currentMonthPaid;
    
    // الرصيد المتاح
    const netSalary = totalSalaries - totalAdvances - totalDeductions;
    const remainingBalance = netSalary - totalPaid;
    
    res.json({
      success: true,
      data: {
        // الإجماليات التراكمية (من بداية التوظيف حتى الآن)
        totalSalaries,
        totalAdvances,
        totalDeductions,
        totalPaid,
        netSalary,
        remainingBalance,
        
        // الشهر الحالي
        currentMonth: {
          salary: currentMonthSalary,
          advances: currentMonthAdvancesTotal,
          deductions: currentMonthDeductionsTotal,
          paid: currentMonthPaid,
          net: currentMonthSalary - currentMonthAdvancesTotal - currentMonthDeductionsTotal - currentMonthPaid
        },
        currentMonthSalary,
        currentMonthAdvances: currentMonthAdvancesTotal,
        currentMonthDeductions: currentMonthDeductionsTotal,
        currentMonthPaid,
        
        // المرحل من أشهر سابقة (يمكن أن يكون موجب أو سالب)
        carriedForward,
        
        // التفاصيل
        attendanceRecords: currentMonthAttendance,
        advances: currentMonthAdvances,
        deductions: currentMonthDeductions,
        payments: currentMonthPayments
      }
    });
  } catch (error) {
    console.error('Error in getEmployeeSalarySummary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Make a payment
export const makePayment = async (req, res) => {
  try {
    const { employeeId, amount, month, method, notes, receiptNumber, date } = req.body;
    
    if (!employeeId || !amount || !month) {
      return res.status(400).json({ 
        success: false, 
        error: 'الموظف والمبلغ والشهر مطلوبة' 
      });
    }
    
    // التحقق من وجود الموظف
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }
    
    
    // التحقق من الرصيد المتاح - حساب للشهر الحالي فقط
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(month + '-01');
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    
    // حساب مرتبات الشهر الحالي فقط
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $gte: monthStart, $lte: monthEnd },
      organizationId: req.user.organization
    });
    
    const currentMonthSalary = attendanceRecords.reduce((sum, record) => 
      sum + (record.details?.totalPay || 0), 0
    );
        
    // حساب سلف الشهر الحالي فقط
    const advances = await Advance.find({
      employeeId,
      status: { $in: ['approved', 'paid'] },
      requestDate: { $gte: monthStart, $lte: monthEnd },
      organizationId: req.user.organization
    });
    
    const currentMonthAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);
    
    // حساب خصومات الشهر الحالي فقط
    const deductions = await Deduction.find({
      employeeId,
      date: { $gte: monthStart, $lte: monthEnd },
      organizationId: req.user.organization
    });
    
    const currentMonthDeductions = deductions.reduce((sum, ded) => sum + ded.amount, 0);
    
    // حساب المدفوعات السابقة في هذا الشهر
    const payments = await Payment.find({
      employeeId,
      month: month,
      organizationId: req.user.organization
    });
    
    const currentMonthPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
    
    // حساب المبالغ المرحلة من الأشهر السابقة
    // نحسب كل المرتبات والسلف والخصومات والمدفوعات من بداية التوظيف حتى الشهر السابق
    const previousMonthEnd = new Date(monthStart);
    previousMonthEnd.setDate(0); // آخر يوم من الشهر السابق
    
    const hireDate = employee.personalInfo?.hireDate || employee.createdAt || new Date('2020-01-01');
    
    // إجمالي المرتبات حتى الشهر السابق
    const previousAttendance = await Attendance.find({
      employeeId,
      date: { $gte: hireDate, $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
    const previousTotalSalaries = previousAttendance.reduce((sum, record) => 
      sum + (record.details?.totalPay || 0), 0
    );
    
    // إجمالي السلف حتى الشهر السابق
    const previousAdvances = await Advance.find({
      employeeId,
      status: { $in: ['approved', 'paid'] },
      requestDate: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
    const previousTotalAdvances = previousAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    
    // إجمالي الخصومات حتى الشهر السابق
    const previousDeductions = await Deduction.find({
      employeeId,
      date: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
    const previousTotalDeductions = previousDeductions.reduce((sum, ded) => sum + ded.amount, 0);
    
    // إجمالي المدفوعات حتى الشهر السابق
    const previousPayments = await Payment.find({
      employeeId,
      paymentDate: { $lte: previousMonthEnd },
      organizationId: req.user.organization
    });
    
    const previousTotalPaid = previousPayments.reduce((sum, pay) => sum + pay.amount, 0);
    
    // المبلغ المرحل من الأشهر السابقة
    const carriedForward = (previousTotalSalaries - previousTotalAdvances - previousTotalDeductions) - previousTotalPaid;
    
    // الرصيد المتاح = (مرتب الشهر الحالي - سلف الشهر - خصومات الشهر - مدفوعات الشهر) + المرحل
    const netSalary = currentMonthSalary - currentMonthAdvances - currentMonthDeductions;
    const remainingBalance = netSalary - currentMonthPaid + carriedForward;

    if (amount > remainingBalance) {
      return res.status(400).json({ 
        success: false, 
        error: `المبلغ المطلوب (${amount}) أكبر من الرصيد المتاح (${remainingBalance.toFixed(2)})` 
      });
    }
    
    // إنشاء الدفعة
    const payment = new Payment({
      employeeId,
      amount,
      month,
      paymentDate: date ? new Date(date) : new Date(),
      method: method || 'cash',
      notes,
      receiptNumber,
      paidBy: req.user._id,
      organizationId: req.user.organization
    });
    
    await payment.save();
    
    res.status(201).json({
      success: true,
      message: 'تم صرف المبلغ بنجاح',
      data: payment
    });
  } catch (error) {
    console.error('Error in makePayment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get payments history
export const getPayments = async (req, res) => {
  try {
    const { employeeId, month, startDate, endDate } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = month;
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }
    
    const payments = await Payment.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .populate('paidBy', 'username')
      .sort({ paymentDate: -1 });
    
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error in getPayments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete payment
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payment) {
      return res.status(404).json({ success: false, error: 'الدفعة غير موجودة' });
    }
    
    res.json({ success: true, message: 'تم حذف الدفعة بنجاح' });
  } catch (error) {
    console.error('Error in deletePayment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const { amount, method, notes } = req.body;
    
    const payment = await Payment.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!payment) {
      return res.status(404).json({ success: false, error: 'الدفعة غير موجودة' });
    }
    
    // تحديث البيانات
    if (amount !== undefined) payment.amount = amount;
    if (method !== undefined) payment.method = method;
    if (notes !== undefined) payment.notes = notes;
    
    await payment.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الدفعة بنجاح',
      data: payment
    });
  } catch (error) {
    console.error('Error in updatePayment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
