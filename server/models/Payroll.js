import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  payrollId: {
    type: String,
    unique: true,
    required: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  employeeName: String,
  
  month: {
    type: String,
    required: true
  },
  
  year: {
    type: Number,
    required: true
  },
  
  // بيانات الموظف في هذا الشهر (snapshot)
  employeeSnapshot: {
    type: String,
    dailyRate: Number,
    hourlyRate: Number,
    monthlyRate: Number,
    department: String,
    position: String
  },
  
  // الحضور والانصراف
  attendance: {
    totalDays: Number,
    workingDays: Number,
    present: Number,
    absent: Number,
    absenceExcused: Number,
    absenceUnexcused: Number,
    late: Number,
    lateExcused: Number,
    lateUnexcused: Number,
    leaves: Number,
    halfDays: Number,
    totalHours: Number,
    regularHours: Number,
    overtimeHours: Number,
    
    // تفاصيل يومية
    dailyRecords: [{
      date: Date,
      day: String,
      status: String,
      checkIn: String,
      checkOut: String,
      hours: Number,
      overtime: Number,
      lateMinutes: Number,
      reason: String,
      excused: Boolean,
      notes: String
    }]
  },
  
  // المستحقات
  earnings: {
    basic: {
      amount: Number,
      calculation: String,
      days: Number,
      rate: Number
    },
    
    allowances: [{
      type: String,
      name: String,
      amount: Number,
      reason: String,
      isFixed: Boolean
    }],
    allowancesTotal: Number,
    
    overtime: {
      hours: Number,
      rate: Number,
      amount: Number,
      calculation: String,
      reason: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      details: [{
        date: Date,
        hours: Number,
        amount: Number,
        reason: String
      }]
    },
    
    commission: {
      enabled: Boolean,
      salesAmount: Number,
      rate: Number,
      amount: Number,
      calculation: String,
      reason: String,
      target: Number,
      exceeded: Boolean,
      exceedanceBonus: Number
    },
    
    bonuses: [{
      type: String,
      name: String,
      amount: Number,
      reason: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      date: Date
    }],
    bonusesTotal: Number,
    
    tips: {
      amount: Number,
      reason: String,
      distributionMethod: String
    },
    
    total: Number
  },
  
  // الخصومات
  deductions: {
    insurance: {
      rate: Number,
      baseAmount: Number,
      amount: Number,
      calculation: String,
      reason: String,
      mandatory: Boolean
    },
    
    tax: {
      taxableAmount: Number,
      rate: Number,
      amount: Number,
      calculation: String,
      reason: String,
      mandatory: Boolean
    },
    
    absence: [{
      date: Date,
      day: String,
      amount: Number,
      reason: String,
      excused: Boolean,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    absenceTotal: Number,
    
    late: [{
      date: Date,
      minutes: Number,
      amount: Number,
      reason: String,
      excused: Boolean,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    lateTotal: Number,
    
    advances: [{
      advanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Advance'
      },
      originalAmount: Number,
      installmentNumber: Number,
      totalInstallments: Number,
      amount: Number,
      remainingAfter: Number,
      reason: String,
      requestDate: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    advancesTotal: Number,
    
    penalties: [{
      type: String,
      amount: Number,
      reason: String,
      date: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String
    }],
    penaltiesTotal: Number,
    
    other: [{
      type: String,
      amount: Number,
      reason: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    otherTotal: Number,
    
    total: Number
  },
  
  // الملخص
  summary: {
    grossSalary: Number,
    totalDeductions: Number,
    netSalary: Number,
    paidAmount: Number,
    unpaidBalance: Number,
    
    // الترحيل من الشهر السابق
    carriedForwardFromPrevious: {
      type: Number,
      default: 0,
      comment: 'المبلغ المرحل من الشهر السابق (سلف وخصومات لم تُخصم)'
    },
    
    // الترحيل للشهر التالي
    carriedForwardToNext: {
      type: Number,
      default: 0,
      comment: 'المبلغ المرحل للشهر التالي (سلف وخصومات لم يمكن خصمها)'
    },
    
    // تفاصيل الترحيل
    carryforwardDetails: {
      advances: [{
        advanceId: mongoose.Schema.Types.ObjectId,
        originalAmount: Number,
        deductedThisMonth: Number,
        remainingToCarryforward: Number,
        reason: String
      }],
      deductions: [{
        deductionId: mongoose.Schema.Types.ObjectId,
        type: String,
        originalAmount: Number,
        deductedThisMonth: Number,
        remainingToCarryforward: Number,
        reason: String
      }]
    },
    
    carriedForward: Number, // للتوافق مع الكود القديم
    previousMonthNet: Number,
    difference: Number,
    differencePercentage: Number
  },
  
  // الحالة والموافقات
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'paid', 'locked'],
    default: 'draft'
  },
  
  workflow: {
    createdAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    submittedAt: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalNotes: String,
    
    paidAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    paymentMethod: String,
    paymentReference: String,
    
    lockedAt: Date,
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lockReason: String,
    unlockReason: String
  },
  
  // سجل التعديلات
  revisions: [{
    revisionNumber: Number,
    date: Date,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      reason: String
    }]
  }],
  
  // إعدادات الطباعة
  printSettings: {
    template: String,
    language: String,
    includeAttendanceDetails: Boolean,
    includeReasons: Boolean,
    includeSignatures: Boolean,
    logo: Boolean,
    watermark: Boolean
  },
  
  // الطباعة
  prints: [{
    printId: String,
    date: Date,
    printedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    template: String,
    fileUrl: String
  }],
  
  // ملاحظات ومرفقات
  notes: String,
  attachments: [{
    type: String,
    url: String,
    generatedAt: Date
  }],
  
  // بيانات إضافية للتحليل
  analytics: {
    attendanceRate: Number,
    punctualityRate: Number,
    productivityScore: Number,
    salesContribution: Number,
    costToRevenueRatio: Number
  },
  
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
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ organizationId: 1, month: 1, year: 1 });
payrollSchema.index({ status: 1 });

// Generate payroll ID
payrollSchema.pre('save', async function(next) {
  if (!this.payrollId) {
    this.payrollId = `PAY-${this.year}${this.month.replace('-', '')}-${this.employeeId.toString().slice(-6)}`;
  }
  next();
});

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;
