import Bonus from '../models/Bonus.js';
import Employee from '../models/Employee.js';

// Get all bonuses
export const getBonuses = async (req, res) => {
  try {
    const { employeeId, month, startDate, endDate, type } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = month;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const bonuses = await Bonus.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .populate('approvedBy', 'username')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: bonuses
    });
  } catch (error) {
    console.error('Error in getBonuses:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get bonuses by employee and month
export const getBonusesByMonth = async (req, res) => {
  try {
    const { employeeId, month } = req.params;
    
    const bonuses = await Bonus.find({
      employeeId,
      month,
      organizationId: req.user.organization
    }).sort({ date: -1 });
    
    const totalBonus = bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
    
    res.json({
      success: true,
      data: {
        bonuses,
        totalBonus
      }
    });
  } catch (error) {
    console.error('Error in getBonusesByMonth:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Create bonus
export const createBonus = async (req, res) => {
  try {
    const { employeeId, amount, type, reason, date, notes } = req.body;
    
    if (!employeeId || !amount || !reason) {
      return res.status(400).json({ 
        success: false,
        error: 'الموظف والمبلغ والسبب مطلوبة' 
      });
    }
    
    // التحقق من وجود الموظف
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        error: 'الموظف غير موجود' 
      });
    }
    
    const bonusDate = date ? new Date(date) : new Date();
    const month = bonusDate.toISOString().substring(0, 7); // YYYY-MM
    
    const bonus = new Bonus({
      employeeId,
      amount,
      type: type || 'other',
      reason,
      date: bonusDate,
      month,
      notes,
      approvedBy: req.user._id,
      organizationId: req.user.organization
    });
    
    await bonus.save();
    
    // Populate employee info before sending response
    await bonus.populate('employeeId', 'personalInfo.name employment');
    await bonus.populate('approvedBy', 'username');
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة المكافأة بنجاح',
      data: bonus
    });
  } catch (error) {
    console.error('Error in createBonus:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update bonus
export const updateBonus = async (req, res) => {
  try {
    const { amount, type, reason, date, notes } = req.body;
    
    const bonus = await Bonus.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!bonus) {
      return res.status(404).json({ 
        success: false,
        error: 'المكافأة غير موجودة' 
      });
    }
    
    // تحديث البيانات
    if (amount !== undefined) bonus.amount = amount;
    if (type !== undefined) bonus.type = type;
    if (reason !== undefined) bonus.reason = reason;
    if (notes !== undefined) bonus.notes = notes;
    
    if (date !== undefined) {
      bonus.date = new Date(date);
      bonus.month = bonus.date.toISOString().substring(0, 7);
    }
    
    await bonus.save();
    
    // Populate employee info
    await bonus.populate('employeeId', 'personalInfo.name employment');
    await bonus.populate('approvedBy', 'username');
    
    res.json({
      success: true,
      message: 'تم تحديث المكافأة بنجاح',
      data: bonus
    });
  } catch (error) {
    console.error('Error in updateBonus:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Delete bonus
export const deleteBonus = async (req, res) => {
  try {
    const bonus = await Bonus.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!bonus) {
      return res.status(404).json({ 
        success: false,
        error: 'المكافأة غير موجودة' 
      });
    }
    
    await bonus.deleteOne();
    
    res.json({ 
      success: true,
      message: 'تم حذف المكافأة بنجاح' 
    });
  } catch (error) {
    console.error('Error in deleteBonus:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get bonus summary
export const getBonusSummary = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (month) {
      query.month = month;
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const summary = await Bonus.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalBonuses = await Bonus.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        byType: summary,
        total: totalBonuses[0] || { totalAmount: 0, count: 0 }
      }
    });
  } catch (error) {
    console.error('Error in getBonusSummary:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
