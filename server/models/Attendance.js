import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  date: {
    type: Date,
    required: true
  },
  
  day: String,
  
  // أوقات الحضور
  checkIn: Date,
  checkOut: Date,
  
  // الحالة
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day', 'leave', 'weekly_off'],
    required: true,
    default: 'present'
  },
  
  // التفاصيل
  details: {
    lateMinutes: {
      type: Number,
      default: 0
    },
    earlyLeaveMinutes: {
      type: Number,
      default: 0
    },
    totalHours: {
      type: Number,
      default: 0
    },
    regularHours: {
      type: Number,
      default: 0
    },
    overtimeHours: {
      type: Number,
      default: 0
    },
    
    // المبالغ المالية
    dailySalary: {
      type: Number,
      default: 0,
      comment: 'الراتب اليومي المضاف'
    },
    overtimePay: {
      type: Number,
      default: 0,
      comment: 'قيمة الساعات الإضافية'
    },
    totalPay: {
      type: Number,
      default: 0,
      comment: 'إجمالي المبلغ (راتب يومي + ساعات إضافية)'
    },
    
    // الشفت
    shift: {
      name: String,
      start: String,
      end: String
    }
  },
  
  // نوع الإجازة
  leaveType: {
    type: String,
    enum: ['annual', 'sick', 'emergency', 'weekly_off', 'unpaid']
  },
  
  // السبب
  reason: String,
  
  // معتمد بعذر؟
  excused: {
    type: Boolean,
    default: false
  },
  
  // الموافقة
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ملاحظات
  notes: String,
  
  // المنظمة
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, date: 1 });
attendanceSchema.index({ status: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
