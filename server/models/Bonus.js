import mongoose from 'mongoose';

const bonusSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['performance', 'holiday', 'achievement', 'sales', 'attendance', 'overtime', 'other'],
    default: 'other'
  },
  reason: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  month: {
    type: String, // YYYY-MM format
    required: true
  },
  notes: {
    type: String
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
bonusSchema.index({ employeeId: 1, date: -1 });
bonusSchema.index({ organizationId: 1, month: 1 });
bonusSchema.index({ employeeId: 1, month: 1 });

const Bonus = mongoose.model('Bonus', bonusSchema);

export default Bonus;
