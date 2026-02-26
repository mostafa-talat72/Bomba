import Advance from '../models/Advance.js';
import Employee from '../models/Employee.js';

// Get all advances
export const getAdvances = async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    
    const advances = await Advance.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .populate('approvedBy', 'username')
      .populate('disbursement.paidBy', 'username')
      .sort({ requestDate: -1 });
    
    res.json({ success: true, data: advances });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get advance by ID
export const getAdvanceById = async (req, res) => {
  try {
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    })
      .populate('employeeId', 'personalInfo.name employment compensation financial')
      .populate('approvedBy', 'username')
      .populate('disbursement.paidBy', 'username');
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    res.json({ success: true, data: advance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Request advance
export const requestAdvance = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('User organization:', req.user.organization);
    
    const { employeeId, amount, reason, repayment } = req.body;
    
    // التحقق من وجود الموظف
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: req.user.organization
    });
    
    console.log('Employee found:', employee ? 'Yes' : 'No');
    
    if (!employee) {
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }
    
    // تم إزالة التحقق من الحد الأقصى - لا يوجد حد أقصى للسلف
    
    // إنشاء السلفة
    const advanceData = {
      employeeId,
      amount,
      reason,
      repayment: {
        method: repayment?.method || 'installments',
        installments: repayment?.installments || 1,
        amountPerMonth: repayment?.installments ? Math.ceil(amount / repayment.installments) : amount,
        remainingAmount: amount,
        totalPaid: 0,
        deductions: []
      },
      organizationId: req.user.organization
    };
    
    console.log('Creating advance with data:', advanceData);
    
    const advance = new Advance(advanceData);
    await advance.save();
    
    console.log('Advance created successfully:', advance._id);
    
    res.status(201).json({
      success: true,
      message: 'تم تقديم طلب السلفة بنجاح',
      data: advance
    });
  } catch (error) {
    console.error('Error in requestAdvance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Approve/Reject advance
export const updateAdvanceStatus = async (req, res) => {
  try {
    const { status, notes, rejectionReason } = req.body;
    
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    if (advance.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'لا يمكن تعديل حالة هذه السلفة' });
    }
    
    advance.status = status;
    advance.approvedBy = req.user._id;
    advance.approvalDate = new Date();
    advance.approvalNotes = notes;
    
    if (status === 'rejected') {
      advance.rejectionReason = rejectionReason;
    }
    
    await advance.save();
    
    res.json({
      success: true,
      message: status === 'approved' ? 'تم الموافقة على السلفة' : 'تم رفض السلفة',
      data: advance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Disburse advance (صرف السلفة)
export const disburseAdvance = async (req, res) => {
  try {
    const { method, receiptNumber, notes } = req.body;
    
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    if (advance.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'السلفة غير معتمدة' });
    }
    
    advance.status = 'paid';
    advance.disbursement = {
      method,
      paidDate: new Date(),
      paidBy: req.user._id,
      receiptNumber,
      notes
    };
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم صرف السلفة بنجاح',
      data: advance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Record advance deduction (تسجيل خصم السلفة من الراتب)
export const recordAdvanceDeduction = async (req, res) => {
  try {
    const { month, amount, payrollId } = req.body;
    
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    if (advance.status !== 'paid') {
      return res.status(400).json({ success: false, error: 'السلفة غير مصروفة' });
    }
    
    // إضافة الخصم
    advance.repayment.deductions.push({
      month,
      amount,
      payrollId,
      date: new Date()
    });
    
    // تحديث المبالغ
    advance.repayment.totalPaid += amount;
    advance.repayment.remainingAmount = advance.amount - advance.repayment.totalPaid;
    
    // إذا تم السداد بالكامل
    if (advance.repayment.remainingAmount <= 0) {
      advance.status = 'completed';
      advance.repayment.remainingAmount = 0;
    }
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل الخصم بنجاح',
      data: advance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get active advances for employee
export const getActiveAdvances = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const advances = await Advance.find({
      employeeId,
      organizationId: req.user.organization,
      status: { $in: ['approved', 'paid'] },
      'repayment.remainingAmount': { $gt: 0 }
    }).sort({ requestDate: -1 });
    
    res.json({ success: true, data: advances });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get advance statistics
export const getAdvanceStats = async (req, res) => {
  try {
    const stats = await Advance.aggregate([
      { $match: { organizationId: req.user.organization } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          paid: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$repayment.totalPaid' },
          totalRemaining: { $sum: '$repayment.remainingAmount' }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          pending: 0,
          approved: 0,
          paid: 0,
          completed: 0,
          rejected: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalRemaining: 0
        }
      });
    }
    
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete advance
export const deleteAdvance = async (req, res) => {
  try {
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    // لا يمكن حذف سلفة مصروفة
    if (advance.status === 'paid' || advance.status === 'completed') {
      return res.status(400).json({ success: false, error: 'لا يمكن حذف سلفة مصروفة' });
    }
    
    await advance.deleteOne();
    
    res.json({ success: true, message: 'تم حذف السلفة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update advance
export const updateAdvance = async (req, res) => {
  try {
    const { amount, reason, requestDate } = req.body;
    
    const advance = await Advance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!advance) {
      return res.status(404).json({ success: false, error: 'السلفة غير موجودة' });
    }
    
    // تحديث البيانات
    if (amount !== undefined) advance.amount = amount;
    if (reason !== undefined) advance.reason = reason;
    if (requestDate !== undefined) advance.requestDate = new Date(requestDate);
    
    // إذا تم تغيير المبلغ، نحدث بيانات السداد
    if (amount !== undefined && advance.repayment) {
      const installments = advance.repayment.installments || 1;
      advance.repayment.amountPerMonth = Math.ceil(amount / installments);
      advance.repayment.remainingAmount = amount - (advance.repayment.totalPaid || 0);
    }
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث السلفة بنجاح',
      data: advance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

