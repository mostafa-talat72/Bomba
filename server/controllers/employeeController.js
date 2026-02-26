import Employee from '../models/Employee.js';
import User from '../models/User.js';

// Get all employees
export const getEmployees = async (req, res) => {
  try {
    const { status, department, type, search } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (status) query['employment.status'] = status;
    if (department) query['employment.department'] = department;
    if (type) query['employment.type'] = type;
    if (search) {
      query.$or = [
        { 'personalInfo.name': { $regex: search, $options: 'i' } },
        { 'personalInfo.phone': { $regex: search, $options: 'i' } }
      ];
    }
    
    const employees = await Employee.find(query)
      .populate('userId', 'username email role')
      .sort({ 'personalInfo.name': 1 });
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    }).populate('userId', 'username email role');
    
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        error: 'الموظف غير موجود' 
      });
    }
    
    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Create employee
export const createEmployee = async (req, res) => {
  try {
    const employeeData = {
      ...req.body,
      organizationId: req.user.organization
    };
    
    // حساب الإجازات المتبقية
    if (employeeData.leaves) {
      if (employeeData.leaves.annual) {
        employeeData.leaves.annual.remaining = 
          employeeData.leaves.annual.total - (employeeData.leaves.annual.used || 0);
      }
      if (employeeData.leaves.sick) {
        employeeData.leaves.sick.remaining = 
          employeeData.leaves.sick.total - (employeeData.leaves.sick.used || 0);
      }
    }
    
    const employee = new Employee(employeeData);
    await employee.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة الموظف بنجاح',
      data: employee
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'الرقم القومي مستخدم بالفعل' 
      });
    }
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        error: 'الموظف غير موجود' 
      });
    }
    
    // تحديث البيانات
    Object.assign(employee, req.body);
    
    // إعادة حساب الإجازات المتبقية
    if (employee.leaves) {
      if (employee.leaves.annual) {
        employee.leaves.annual.remaining = 
          employee.leaves.annual.total - employee.leaves.annual.used;
      }
      if (employee.leaves.sick) {
        employee.leaves.sick.remaining = 
          employee.leaves.sick.total - employee.leaves.sick.used;
      }
    }
    
    await employee.save();
    
    res.json({
      success: true,
      message: 'تم تحديث بيانات الموظف بنجاح',
      data: employee
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Delete employee
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        error: 'الموظف غير موجود' 
      });
    }
    
    // حذف الموظف فعلياً
    await Employee.deleteOne({ _id: req.params.id });
    
    res.json({ 
      success: true,
      message: 'تم حذف الموظف بنجاح' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get employee statistics
export const getEmployeeStats = async (req, res) => {
  try {
    const stats = await Employee.aggregate([
      { $match: { organizationId: req.user.organization } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$employment.status', 'active'] }, 1, 0] }
          },
          suspended: {
            $sum: { $cond: [{ $eq: ['$employment.status', 'suspended'] }, 1, 0] }
          },
          terminated: {
            $sum: { $cond: [{ $eq: ['$employment.status', 'terminated'] }, 1, 0] }
          },
          byDepartment: {
            $push: '$employment.department'
          },
          byType: {
            $push: '$employment.type'
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          active: 0,
          suspended: 0,
          terminated: 0,
          byDepartment: {},
          byType: {}
        }
      });
    }
    
    const result = stats[0];
    
    // حساب التوزيع حسب القسم
    const departmentCounts = {};
    result.byDepartment.forEach(dept => {
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });
    
    // حساب التوزيع حسب النوع
    const typeCounts = {};
    result.byType.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        total: result.total,
        active: result.active,
        suspended: result.suspended,
        terminated: result.terminated,
        byDepartment: departmentCounts,
        byType: typeCounts
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
