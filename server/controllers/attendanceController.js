import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import { createTombstone } from '../utils/tombstoneHelper.js';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { getDateFnsLocale } from '../utils/localeHelper.js';

// ── منطق حساب أجر اليوم — مصدر واحد تشترك فيه كل المسارات ──
// (markAttendance / bulkMarkAttendance / updateAttendance)
// القواعد: يومي = daily، بالساعة = hourly×regularHours، شهري = monthly/30،
// نصف يوم = النصف، الإضافي = overtimeHours × overtimeHourlyRate.
export function computeAttendancePay({ employee, status, checkInTime, checkOutTime, workHoursPerDay = 8 }) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let lateMinutes = 0;
  let dailySalary = 0;
  let overtimePay = 0;

  if (checkInTime instanceof Date && !isNaN(checkInTime) && checkOutTime instanceof Date && !isNaN(checkOutTime)) {
    let out = checkOutTime;
    if (out <= checkInTime) out = new Date(checkOutTime.getTime() + 24 * 60 * 60 * 1000);
    totalHours = Math.max(0, (out - checkInTime) / (1000 * 60 * 60));
    regularHours = Math.min(totalHours, workHoursPerDay);
    overtimeHours = Math.max(totalHours - workHoursPerDay, 0);
    if (status === 'late') {
      const expected = new Date(checkInTime);
      expected.setHours(9, 0, 0, 0);
      if (checkInTime > expected && checkInTime.getHours() < 12) {
        lateMinutes = Math.round((checkInTime - expected) / (1000 * 60));
      }
    }
  }

  const empType = employee?.employment?.type;
  const comp = employee?.compensation || {};
  if (status === 'present' || status === 'late') {
    if (empType === 'daily') dailySalary = num(comp.daily);
    else if (empType === 'hourly') dailySalary = num(comp.hourly) * regularHours;
    else if (empType === 'monthly') dailySalary = num(comp.monthly) / 30;
  } else if (status === 'half_day') {
    if (empType === 'daily') dailySalary = num(comp.daily) / 2;
    else if (empType === 'monthly') dailySalary = num(comp.monthly) / 60;
  }

  if (overtimeHours > 0) overtimePay = overtimeHours * num(comp.overtimeHourlyRate);
  return {
    totalHours, regularHours, overtimeHours, lateMinutes,
    dailySalary, overtimePay, totalPay: dailySalary + overtimePay,
  };
}

export function toAttendanceDate(date, timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const t = new Date(`${yyyy}-${mm}-${dd}T${timeStr}`);
  return isNaN(t) ? null : t;
}

async function getWorkHoursPerDay(organizationId) {
  try {
    const s = await Settings.findOne({ category: 'payroll', organization: organizationId });
    if (s && Number(s.settings?.workHoursPerDay) > 0) return Number(s.settings.workHoursPerDay);
  } catch {}
  return 8;
}

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
    
    // الحصول على إعدادات ساعات العمل من المؤسسة
    let workHoursPerDay = 8; // القيمة الافتراضية
    try {
      const payrollSettings = await Settings.findOne({
        category: 'payroll',
        organization: req.user.organization
      });
      if (payrollSettings && payrollSettings.settings.workHoursPerDay) {
        workHoursPerDay = payrollSettings.settings.workHoursPerDay;
      }
    } catch (error) {
    }
    
    // تحويل البيانات للعرض وإعادة حساب الساعات
    const formattedAttendance = attendance.map(a => {
      let hours = a.details?.totalHours || 0;
      let overtime = a.details?.overtimeHours || 0;
      let lateMinutes = a.details?.lateMinutes || 0;
      
      // للغياب والإجازة: لا يوجد ساعات
      if (a.status === 'absent' || a.status === 'leave' || a.status === 'weekly_off') {
        return {
          _id: a._id,
          date: format(a.date, 'yyyy-MM-dd'),
          day: format(a.date, 'EEEE', { locale: getDateFnsLocale(req.user) }),
          status: a.status,
          checkIn: null,
          checkOut: null,
          hours: 0,
          overtime: 0,
          lateMinutes: 0,
          reason: a.reason,
          excused: a.excused,
          notes: a.notes,
          dailySalary: 0,
          overtimePay: 0,
          totalPay: 0
        };
      }
      
      // إعادة حساب الساعات إذا كانت سالبة أو صفر
      if (a.checkIn && a.checkOut && hours <= 0) {
        let checkInTime = new Date(a.checkIn);
        let checkOutTime = new Date(a.checkOut);
        
        // إذا كان وقت الانصراف أقل من وقت الحضور، فهذا يعني أن الانصراف في اليوم التالي
        if (checkOutTime <= checkInTime) {
          checkOutTime = new Date(checkOutTime.getTime() + 24 * 60 * 60 * 1000);
        }
        
        hours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        // حساب الوقت الإضافي بناءً على ساعات العمل المحددة في المنشأة
        overtime = Math.max(hours - workHoursPerDay, 0);
        
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
        day: format(a.date, 'EEEE', { locale: getDateFnsLocale(req.user) }),
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
    let workHoursPerDay = 8; // القيمة الافتراضية
    try {
      const payrollSettings = await Settings.findOne({
        category: 'payroll',
        organization: req.user.organization
      });
      if (payrollSettings && payrollSettings.settings.workHoursPerDay) {
        workHoursPerDay = payrollSettings.settings.workHoursPerDay;
      }
    } catch (error) {
    }
    
    const attendanceDate = new Date(date);
    const dayName = format(attendanceDate, 'EEEE', { locale: getDateFnsLocale(req.user) });
    
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
        // للموظف بالساعة: نحسب فقط الساعات الأساسية (بدون الإضافي)
        dailySalary = (employee.compensation.hourly || 0) * regularHours;
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

// Bulk mark attendance — same shared pay logic as single marking
export const bulkMarkAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'لا توجد سجلات' });
    }

    const results = [];
    const errors = [];
    const workHoursPerDay = await getWorkHoursPerDay(req.user.organization);

    for (const record of records) {
      try {
        const { employeeId, date, checkIn, checkOut, status, reason, excused, notes } = record || {};
        if (!employeeId || !date) throw new Error('employeeId والتاريخ مطلوبان');
        const employee = await Employee.findOne({ _id: employeeId, organizationId: req.user.organization });
        if (!employee) throw new Error('الموظف غير موجود');

        const attendanceDate = new Date(date);
        if (isNaN(attendanceDate)) throw new Error('التاريخ غير صالح');
        const inTime = checkIn ? toAttendanceDate(attendanceDate, checkIn) : null;
        const outTime = checkOut ? toAttendanceDate(attendanceDate, checkOut) : null;
        const st = status || 'present';
        const pay = computeAttendancePay({ employee, status: st, checkInTime: inTime, checkOutTime: outTime, workHoursPerDay });

        let attendance = await Attendance.findOne({ employeeId, date: attendanceDate, organizationId: req.user.organization });
        if (attendance) {
          if (inTime) attendance.checkIn = inTime;
          if (outTime) attendance.checkOut = outTime;
          attendance.status = st;
          if (reason !== undefined) attendance.reason = reason;
          if (excused !== undefined) attendance.excused = excused;
          if (notes !== undefined) attendance.notes = notes;
          attendance.details = pay;
          attendance.approvedBy = req.user._id;
        } else {
          const dayName = format(attendanceDate, 'EEEE', { locale: getDateFnsLocale(req.user) });
          attendance = new Attendance({
            employeeId, date: attendanceDate, day: dayName,
            checkIn: inTime, checkOut: outTime, status: st,
            reason, excused: excused || false, notes,
            details: pay, approvedBy: req.user._id,
            organizationId: req.user.organization,
          });
        }
        await attendance.save();
        results.push(attendance);
      } catch (error) {
        errors.push({ record, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `تم تسجيل ${results.length} سجل بنجاح`,
      data: { results, errors },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
      const anyAttendance = await Attendance.findById(req.params.id);
      
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    // تحديث البيانات
    if (status) {
      attendance.status = status;
      attendance.markModified('status');
    }
    if (checkIn !== undefined) {
      attendance.checkIn = checkIn;
      attendance.markModified('checkIn');
    }
    if (checkOut !== undefined) {
      attendance.checkOut = checkOut;
      attendance.markModified('checkOut');
    }
    if (reason !== undefined) {
      attendance.reason = reason;
      attendance.markModified('reason');
    }
    if (notes !== undefined) {
      attendance.notes = notes;
      attendance.markModified('notes');
    }
    
    console.log('[updateAttendance] normalized:', { normalizedIn, normalizedOut });
    {
      const employee = await Employee.findById(attendance.employeeId);
      const workHoursPerDay = await getWorkHoursPerDay(req.user.organization);
      const pay = computeAttendancePay({
        employee,
        status: attendance.status,
        checkInTime: attendance.checkIn instanceof Date ? attendance.checkIn : null,
        checkOutTime: attendance.checkOut instanceof Date ? attendance.checkOut : null,
        workHoursPerDay,
      });
      attendance.details = pay;
    }
    
    await attendance.save();
        
    res.json({
      success: true,
      message: 'تم تحديث السجل بنجاح',
      data: attendance
    });
  } catch (error) {
    console.error('❌ Error in updateAttendance:', error);
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
    
    const attendanceId = attendance._id;
    // Tombstone FIRST (before delete) — see deleteAdvance.
    try { await createTombstone('attendances', attendanceId, req.user.organization, req.user._id); } catch (e) {}
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
