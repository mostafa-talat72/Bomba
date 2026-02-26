import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // المبلغ المدفوع
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // الشهر الذي تم الصرف فيه
  month: {
    type: String,
    required: true // YYYY-MM
  },
  
  // تاريخ الصرف
  paymentDate: {
    type: Date,
    default: Date.now
  },
  
  // طريقة الدفع
  method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'check'],
    default: 'cash'
  },
  
  // ملاحظات
  notes: String,
  
  // من قام بالصرف
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // رقم الإيصال
  receiptNumber: String,
  
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
paymentSchema.index({ employeeId: 1, month: 1 });
paymentSchema.index({ organizationId: 1, paymentDate: -1 });

// Generate payment ID
paymentSchema.pre('save', async function(next) {
  if (!this.paymentId) {
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentId = `PAY-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
