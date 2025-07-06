import mongoose from 'mongoose';

const costSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'فئة التكلفة مطلوبة'],
    enum: ['rent', 'utilities', 'salaries', 'maintenance', 'inventory', 'marketing', 'other']
  },
  subcategory: {
    type: String,
    default: null
  },
  description: {
    type: String,
    required: [true, 'وصف التكلفة مطلوب']
  },
  amount: {
    type: Number,
    required: [true, 'المبلغ مطلوب'],
    min: 0
  },
  currency: {
    type: String,
    default: 'EGP'
  },
  date: {
    type: Date,
    required: [true, 'تاريخ التكلفة مطلوب'],
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'check'],
    default: 'cash'
  },
  receipt: {
    type: String,
    default: null
  },
  receiptImage: {
    type: String,
    default: null
  },
  vendor: {
    type: String,
    default: null
  },
  vendorContact: {
    type: String,
    default: null
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPeriod: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    default: null
  },
  nextDueDate: {
    type: Date,
    default: null
  },
  tags: [{
    type: String
  }],
  notes: {
    type: String,
    default: null
  },
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Update status based on due date
costSchema.pre('save', function(next) {
  if (this.dueDate && this.dueDate < new Date() && this.status === 'pending') {
    this.status = 'overdue';
  }
  next();
});

// Calculate next due date for recurring costs
costSchema.methods.calculateNextDueDate = function() {
  if (!this.isRecurring || !this.recurringPeriod) return null;
  
  const currentDate = this.dueDate || this.date;
  const nextDate = new Date(currentDate);
  
  switch (this.recurringPeriod) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }
  
  this.nextDueDate = nextDate;
  return nextDate;
};

// Indexes
costSchema.index({ category: 1 });
costSchema.index({ status: 1 });
costSchema.index({ date: 1 });
costSchema.index({ dueDate: 1 });
costSchema.index({ createdBy: 1 });

export default mongoose.model('Cost', costSchema);