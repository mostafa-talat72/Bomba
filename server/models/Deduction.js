import mongoose from 'mongoose';

const deductionSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  type: {
    type: String,
    enum: ['absence', 'late', 'penalty', 'loan', 'insurance', 'tax', 'other'],
    required: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  reason: {
    type: String,
    required: true
  },
  
  date: {
    type: Date,
    required: true
  },
  
  month: {
    type: String,
    required: true // YYYY-MM
  },
  
  recurring: {
    type: Boolean,
    default: false
  },
  
  // من قام بإضافة الخصم
  addedBy: {
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
deductionSchema.index({ employeeId: 1, month: 1 });
deductionSchema.index({ organizationId: 1, date: -1 });
deductionSchema.index({ type: 1 });

const Deduction = mongoose.model('Deduction', deductionSchema);

export default Deduction;
