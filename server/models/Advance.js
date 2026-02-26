import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema({
  advanceId: {
    type: String,
    unique: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // تفاصيل السلفة
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  requestDate: {
    type: Date,
    default: Date.now
  },
  
  reason: {
    type: String,
    required: true
  },
  
  // الموافقة
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'completed'],
    default: 'pending'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvalDate: Date,
  approvalNotes: String,
  
  rejectionReason: String,
  
  // خطة السداد
  repayment: {
    method: {
      type: String,
      enum: ['full', 'installments'],
      default: 'installments'
    },
    installments: {
      type: Number,
      default: 1
    },
    amountPerMonth: Number,
    startMonth: String,
    
    // التتبع
    totalPaid: {
      type: Number,
      default: 0
    },
    remainingAmount: Number,
    
    // سجل الخصم
    deductions: [{
      month: String,
      amount: Number,
      payrollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payroll'
      },
      date: Date
    }]
  },
  
  // الصرف
  disbursement: {
    method: {
      type: String,
      enum: ['cash', 'bank_transfer']
    },
    paidDate: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receiptNumber: String,
    notes: String
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
advanceSchema.index({ employeeId: 1, status: 1 });
advanceSchema.index({ organizationId: 1, status: 1 });

// Generate advance ID
advanceSchema.pre('save', async function(next) {
  if (!this.advanceId) {
    const count = await mongoose.model('Advance').countDocuments();
    this.advanceId = `ADV-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // حساب المبلغ المتبقي
  if (this.repayment) {
    this.repayment.remainingAmount = this.amount - (this.repayment.totalPaid || 0);
  }
  
  next();
});

const Advance = mongoose.model('Advance', advanceSchema);

export default Advance;
