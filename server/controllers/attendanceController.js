import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

// Get attendance records
export const getAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, status } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await Attendance.find(query)
      .populate('employeeId', 'personalInfo.name employment')
      .populate('approvedBy', 'username')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get attendance by employee and month
export const getAttendanceByMonth = async (req, res) => {
  try {
    const { employeeId, month } = req.params;
    
    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = endOfMonth(startDate);
    
    const attendance = await Attendance.find({
      employeeId,
      organizationId: req.user.organization,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });
    
    // تحويل البيانات للعرض وإعادة حساب الساعات
    const formattedAttendance = attendance.map(a => {
      let hours = a.details?.totalHours || 0;
      let overtime = a.details?.overtimeHours || 0;
      let lateMinutes = a.details?.lateMinutes || 0;
      
      // إعادة حساب الساعات إذا كانت سالبة
      if (a.checkIn && a.checkOut && hours < 0) {
        let checkInTime = new Date(a.checkIn);
        let checkOutTime = new Date(a.checkOut);
        
        // إذا كان وقت الانصراف أقل من وقت الحضور، فهذا يعني أن الانصراف في اليوم التالي
        if (checkOutTime <= checkInTime) {
          checkOutTime = new Date(checkOutTime.getTime() + 24 * 60 * 60 * 1000);
        }
        
        hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        overtime = Math.max(hours - 8, 0);
        
        // إعادة حساب التأخير فقط للحالة "late" وللحضور الصباحي
        lateMinutes = 0;
        if (a.status === 'late' && checkInTime.getHours() < 12) {
          const dateStr = format(a.date, 'yyyy-MM-dd');
          const expectedCheckIn = new Date(`${dateStr}T09:00`);
          if (checkInTime > expectedCheckIn) {
            lateMinutes = Math.round((checkInTime - expectedCheckIn) / (1000 * 60));
          }
        }
      }
      
      return {
        _id: a._id,
        date: format(a.date, 'yyyy-MM-dd'),
        day: format(a.date, 'EEEE', { locale: ar }),
        status: a.status,
        checkIn: a.checkIn ? format(a.checkIn, 'HH:mm') : null,
        checkOut: a.checkOut ? format(a.checkOut, 'HH:mm') : null,
        hours: hours,
        overtime: overtime,
        lateMinutes: lateMinutes,
        reason: a.reason,
        excused: a.excused,
        notes: a.notes,
        dailySalary: a.details?.dailySalary || 0,
        overtimePay: a.details?.overtimePay || 0,
        totalPay: a.details?.totalPay || 0
      };
    });
    
    // حساب الملخص
    const summary = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      leaves: attendance.filter(a => a.status === 'leave').length,
      halfDays: attendance.filter(a => a.status === 'half_day').length,
      totalHours: formattedAttendance.reduce((sum, a) => sum + (a.hours || 0), 0),
      overtimeHours: formattedAttendance.reduce((sum, a) => sum + (a.overtime || 0), 0)
    };
    
    res.json({
      success: true,
      data: {
        attendance: formattedAttendance,
        summary
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Create or update attendance
export const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, checkIn, checkOut, status, reason, excused, notes } = req.body;
    
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
    
    // الحصول على إعدادات ساعات العمل من المؤسسة
    let workHoursPerDay = 10; // القيمة الافتراضية
    try {
      const payrollSettings = await Settings.findOne({
        category: 'payroll',
        organization: req.user.organization
      });
      if (payrollSettings && payrollSettings.settings.workHoursPerDay) {
        workHoursPerDay = payrollSettings.settings.workHoursPerDay;
      }
    } catch (error) {
      console.log('Using default work hours:', workHoursPerDay);
    }
    
    const attendanceDate = new Date(date);
    const dayName = format(attendanceDate, 'EEEE', { locale: ar });
    
    // حساب الساعات
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let lateMinutes = 0;
    let dailySalary = 0;
    let overtimePay = 0;
    let totalPay = 0;
    
    if (checkIn && checkOut) {
      let checkInTime = new Date(`${date}T${checkIn}`);
      let checkOutTime = new Date(`${date}T${checkOut}`);
      
      // إذا كان وقت الانصراف أقل من وقت الحضور، فهذا يعني أن الانصراف في اليوم التالي
      if (checkOutTime <= checkInTime) {
        checkOutTime = new Date(checkOutTime.getTime() + 24 * 60 * 60 * 1000); // إضافة 24 ساعة
      }
      
      totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      
      // حساب الساعات العادية والإضافية بناءً على ساعات العمل المحددة
      regularHours = Math.min(totalHours, workHoursPerDay);
      overtimeHours = Math.max(totalHours - workHoursPerDay, 0);
      
      // لا نحسب التأخير تلقائياً - يجب أن يتم تحديده يدوياً حسب نوع الشفت
      // إذا كانت الحالة "late" فقط نحسب التأخير
      if (status === 'late') {
        // يمكن حساب التأخير بناءً على وقت محدد أو تركه للإدخال اليدوي
        const expectedCheckIn = new Date(`${date}T09:00`);
        if (checkInTime > expectedCheckIn && checkInTime.getHours() < 12) {
          // فقط إذا كان الحضور في الصباح (قبل الظهر)
          lateMinutes = Math.round((checkInTime - expectedCheckIn) / (1000 * 60));
        }
      }
    }
    
    // حساب الراتب اليومي بناءً على نوع التوظيف
    if (status === 'present' || status === 'late') {
      if (employee.employment.type === 'daily') {
        dailySalary = employee.compensation.daily || 0;
      } else if (employee.employment.type === 'hourly') {
        dailySalary = (employee.compensation.hourly || 0) * totalHours;
      } else if (employee.employment.type === 'monthly') {
        // للموظفين الشهريين، نحسب الراتب اليومي = الراتب الشهري / 30
        dailySalary = (employee.compensation.monthly || 0) / 30;
      }
    } else if (status === 'half_day') {
      // نصف يوم = نصف الراتب اليومي
      if (employee.employment.type === 'daily') {
        dailySalary = (employee.compensation.daily || 0) / 2;
      } else if (employee.employment.type === 'monthly') {
        dailySalary = (employee.compensation.monthly || 0) / 60;
      }
    }
    
    // حساب قيمة الساعات الإضافية
    if (overtimeHours > 0) {
      const overtimeRate = employee.compensation.overtimeHourlyRate || 0;
      overtimePay = overtimeHours * overtimeRate;
    }
    
    // إجمالي المبلغ
    totalPay = dailySalary + overtimePay;
    
    // البحث عن سجل موجود
    let attendance = await Attendance.findOne({
      employeeId,
      date: attendanceDate,
      organizationId: req.user.organization
    });
    
    if (attendance) {
      // تحديث السجل الموجود
      attendance.checkIn = checkIn ? new Date(`${date}T${checkIn}`) : attendance.checkIn;
      attendance.checkOut = checkOut ? new Date(`${date}T${checkOut}`) : attendance.checkOut;
      attendance.status = status || attendance.status;
      attendance.reason = reason || attendance.reason;
      attendance.excused = excused !== undefined ? excused : attendance.excused;
      attendance.notes = notes || attendance.notes;
      attendance.details = {
        lateMinutes,
        totalHours,
        regularHours,
        overtimeHours,
        dailySalary,
        overtimePay,
        totalPay
      };
      attendance.approvedBy = req.user._id;
    } else {
      // إنشاء سجل جديد
      attendance = new Attendance({
        employeeId,
        date: attendanceDate,
        day: dayName,
        checkIn: checkIn ? new Date(`${date}T${checkIn}`) : null,
        checkOut: checkOut ? new Date(`${date}T${checkOut}`) : null,
        status: status || 'present',
        reason,
        excused: excused || false,
        notes,
        details: {
          lateMinutes,
          totalHours,
          regularHours,
          overtimeHours,
          dailySalary,
          overtimePay,
          totalPay
        },
        approvedBy: req.user._id,
        organizationId: req.user.organization
      });
    }
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل الحضور بنجاح',
      data: attendance
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'تم تسجيل الحضور لهذا اليوم بالفعل' 
      });
    }
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Bulk mark attendance
export const bulkMarkAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    
    const results = [];
    const errors = [];
    
    for (const record of records) {
      try {
        const attendance = await markAttendance({
          body: record,
          user: req.user
        });
        results.push(attendance);
      } catch (error) {
        errors.push({
          record,
          error: error.message
        });
      }
    }
    
    res.json({
      message: `تم تسجيل ${results.length} سجل بنجاح`,
      results,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update attendance
export const updateAttendance = async (req, res) => {
  try {
    const { status, checkIn, checkOut, reason, notes } = req.body;
    
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!attendance) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    
    // تحديث البيانات
    if (status) attendance.status = status;
    if (checkIn !== undefined) attendance.checkIn = checkIn;
    if (checkOut !== undefined) attendance.checkOut = checkOut;
    if (reason !== undefined) attendance.reason = reason;
    if (notes !== undefined) attendance.notes = notes;
    
    // إعادة حساب الساعات والمرتب
    if (attendance.checkIn && attendance.checkOut) {
      const checkInTime = new Date(`1970-01-01T${attendance.checkIn}`);
      const checkOutTime = new Date(`1970-01-01T${attendance.checkOut}`);
      
      let hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      if (hours < 0) hours += 24;
      
      attendance.hours = hours;
      
      // حساب المرتب
      const employee = await Employee.findById(attendance.employeeId);
      if (employee) {
        const dailySalary = employee.compensation?.baseSalary / 30 || 0;
        const overtimeRate = employee.compensation?.overtimeRate || 1.5;
        const standardHours = 8;
        
        if (hours > standardHours) {
          attendance.overtime = hours - standardHours;
          attendance.details = {
            dailySalary: dailySalary,
            overtimePay: (hours - standardHours) * (dailySalary / standardHours) * overtimeRate,
            totalPay: dailySalary + ((hours - standardHours) * (dailySalary / standardHours) * overtimeRate)
          };
        } else {
          attendance.overtime = 0;
          attendance.details = {
            dailySalary: dailySalary,
            overtimePay: 0,
            totalPay: dailySalary
          };
        }
      }
    }
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث السجل بنجاح',
      data: attendance
    });
  } catch (error) {
    console.error('Error in updateAttendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete attendance
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      organizationId: req.user.organization
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        success: false,
        error: 'السجل غير موجود' 
      });
    }
    
    await attendance.deleteOne();
    
    res.json({ 
      success: true,
      message: 'تم حذف السجل بنجاح' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get attendance summary
export const getAttendanceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { organizationId: req.user.organization };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const summary = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$employeeId',
          totalDays: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          leaves: {
            $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
          },
          totalHours: { $sum: '$details.totalHours' },
          overtimeHours: { $sum: '$details.overtimeHours' }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' }
    ]);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
