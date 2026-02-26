import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // معلومات شخصية
  personalInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    nationalId: {
      type: String,
      unique: true,
      sparse: true
    },
    phone: {
      type: String,
      required: true
    },
    address: String,
    birthDate: Date,
    hireDate: {
      type: Date,
      default: Date.now
    },
    photo: String
  },

  // نوع التوظيف
  employment: {
    type: {
      type: String,
      enum: ['monthly', 'daily', 'hourly'],
      required: true,
      default: 'monthly'
    },
    department: {
      type: String,
      enum: ['kitchen', 'cashier', 'waiter', 'admin', 'gaming', 'other'],
      required: true
    },
    position: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'terminated'],
      default: 'active'
    }
  },

  // الراتب والأجر
  compensation: {
    monthly: {
      type: Number,
      default: 0
    },
    daily: {
      type: Number,
      default: 0
    },
    hourly: {
      type: Number,
      default: 0
    },
    overtimeRate: {
      type: Number,
      default: 1.5
    },
    overtimeHourlyRate: {
      type: Number,
      default: 0,
      comment: 'سعر الساعة الإضافية بالجنيه'
    },
    
    // البدلات الثابتة
    allowances: {
      transport: {
        type: Number,
        default: 0
      },
      food: {
        type: Number,
        default: 0
      },
      housing: {
        type: Number,
        default: 0
      }
    },
    
    // نظام العمولة
    commission: {
      enabled: {
        type: Boolean,
        default: false
      },
      rate: {
        type: Number,
        default: 0
      },
      target: {
        type: Number,
        default: 0
      },
      bonusIfExceeded: {
        type: Number,
        default: 0
      }
    }
  },

  // الإعدادات المالية
  financial: {
    bankAccount: String,
    bankName: String,
    insuranceNumber: String,
    taxNumber: String,
    advanceLimit: {
      type: Number,
      default: 2000
    },
    maxActiveAdvances: {
      type: Number,
      default: 1
    }
  },

  // الإجازات
  leaves: {
    annual: {
      total: {
        type: Number,
        default: 21
      },
      used: {
        type: Number,
        default: 0
      },
      remaining: {
        type: Number,
        default: 21
      }
    },
    sick: {
      total: {
        type: Number,
        default: 15
      },
      used: {
        type: Number,
        default: 0
      },
      remaining: {
        type: Number,
        default: 15
      }
    },
    emergency: {
      used: {
        type: Number,
        default: 0
      }
    }
  },

  // ربط مع المستخدم
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ربط مع المنظمة
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
employeeSchema.index({ organizationId: 1, 'employment.status': 1 });
employeeSchema.index({ 'personalInfo.name': 'text' });

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
