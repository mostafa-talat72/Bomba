import Deduction from '../models/Deduction.js';

// Get all deductions
export const getDeductions = async (req, res) => {
  try {
    const { employeeId, month, type } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = month;
    if (type) query.type = type;
    
    const deductions = await Deduction.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .sort({ date: -1 });
    
    res.json({ success: true, data: deductions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create deduction
export const createDeduction = async (req, res) => {
  try {
    const { employeeId, type, amount, reason, date, month, recurring } = req.body;
    
    const deduction = new Deduction({
      employeeId,
      type,
      amount,
      reason,
      date,
      month,
      recurring: recurring || false,
      organizationId: req.user.organization
    });
    
    await deduction.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة الخصم بنجاح',
      data: deduction
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete deduction
export const deleteDeduction = async (req, res) => {
  try {
    const deduction = await Deduction.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!deduction) {
      return res.status(404).json({ success: false, error: 'الخصم غير موجود' });
    }
    
    await deduction.deleteOne();
    
    res.json({ success: true, message: 'تم حذف الخصم بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update deduction
export const updateDeduction = async (req, res) => {
  try {
    const { amount, reason, type, date } = req.body;
    
    const deduction = await Deduction.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!deduction) {
      return res.status(404).json({ success: false, error: 'الخصم غير موجود' });
    }
    
    // تحديث البيانات
    if (amount !== undefined) deduction.amount = amount;
    if (reason !== undefined) deduction.reason = reason;
    if (type !== undefined) deduction.type = type;
    if (date !== undefined) deduction.date = new Date(date);
    
    await deduction.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الخصم بنجاح',
      data: deduction
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
