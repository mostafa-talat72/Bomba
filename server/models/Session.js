import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  deviceNumber: {
    type: String,
    required: [true, 'رقم الجهاز مطلوب']
  },
  deviceName: {
    type: String,
    required: [true, 'اسم الجهاز مطلوب']
  },
  deviceType: {
    type: String,
    enum: ['playstation', 'computer'],
    required: true
  },
  customerName: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    required: true
  },
  controllers: {
    type: Number,
    default: 1,
    min: 1,
    max: 4
  },
  controllersHistory: [{
    controllers: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    },
    from: {
      type: Date,
      required: true
    },
    to: {
      type: Date
    }
  }],
  totalCost: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalCost: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  }
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ deviceNumber: 1, status: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ startTime: -1 });

// Middleware to initialize controllersHistory on new session
sessionSchema.pre('save', function(next) {
  if (this.isNew && this.controllersHistory.length === 0) {
    this.controllersHistory.push({
      controllers: this.controllers,
      from: this.startTime,
      to: null
    });
  }
  next();
});

// Helper function to round cost to nearest pound
const roundToNearestPound = (cost) => {
  if (cost <= 0) return 0;
  return Math.ceil(cost); // تقريب لأعلى لأقرب جنيه صحيح
};

// دالة لحساب سعر الساعة للبلايستيشن
function getPlayStationHourlyRate(controllers) {
  if (controllers === 1 || controllers === 2) return 20;
  if (controllers === 3) return 25;
  if (controllers === 4) return 30;
  return 20;
}

// Calculate cost based on controllersHistory
sessionSchema.methods.calculateCost = function() {
  console.log('🔍 Calculating cost for session:', this._id);
  console.log('📊 Controllers history:', this.controllersHistory);

  if (!this.controllersHistory || this.controllersHistory.length === 0) {
    console.log('⚠️ No controllers history found, using default calculation');
    // If no history, calculate based on total session duration
    if (this.startTime && this.endTime) {
      const durationMs = new Date(this.endTime) - new Date(this.startTime);
      const minutes = durationMs / (1000 * 60);

      if (this.deviceType === 'playstation') {
        const hourlyRate = getPlayStationHourlyRate(this.controllers);
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const rawCost = minutes * minuteRate;
        this.totalCost = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
      } else if (this.deviceType === 'computer') {
        const hourlyRate = 15; // 15 ج.م/ساعة للكمبيوتر
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const rawCost = minutes * minuteRate;
        this.totalCost = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
      }
    } else {
      this.totalCost = 0;
    }
    this.finalCost = this.totalCost - this.discount;
    console.log('💰 Calculated cost (no history):', { totalCost: this.totalCost, finalCost: this.finalCost });
    return this.finalCost;
  }

  let total = 0;
  let hasValidPeriods = false;

  for (const period of this.controllersHistory) {
    console.log('📅 Processing period:', period);

    // If period doesn't have 'to', use current time or endTime
    let periodEnd = period.to;
    if (!periodEnd) {
      periodEnd = this.endTime || new Date();
      console.log('⏰ Using end time for open period:', periodEnd);
    }

    if (period.from && periodEnd) {
      const durationMs = new Date(periodEnd) - new Date(period.from);
      const minutes = durationMs / (1000 * 60);

      console.log('⏱️ Duration for period:', { minutes, durationMs });

      if (minutes > 0) {
        hasValidPeriods = true;

        if (this.deviceType === 'playstation') {
          const hourlyRate = getPlayStationHourlyRate(period.controllers);
          const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
          const rawPeriodCost = minutes * minuteRate;
          const periodCost = roundToNearestPound(rawPeriodCost); // تقريب لأقرب جنيه صحيح
          total += periodCost;
          console.log('🎮 PlayStation period cost:', {
            controllers: period.controllers,
            hourlyRate,
            minuteRate,
            minutes,
            rawPeriodCost,
            periodCost
          });
        } else if (this.deviceType === 'computer') {
          const hourlyRate = 15; // 15 ج.م/ساعة للكمبيوتر
          const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
          const rawPeriodCost = minutes * minuteRate;
          const periodCost = roundToNearestPound(rawPeriodCost); // تقريب لأقرب جنيه صحيح
          total += periodCost;
          console.log('💻 Computer period cost:', {
            hourlyRate,
            minuteRate,
            minutes,
            rawPeriodCost,
            periodCost
          });
        }
      }
    }
  }

  // If no valid periods found, calculate based on total session duration
  if (!hasValidPeriods && this.startTime && this.endTime) {
    console.log('⚠️ No valid periods found, using total session duration');
    const durationMs = new Date(this.endTime) - new Date(this.startTime);
    const minutes = durationMs / (1000 * 60);

    if (this.deviceType === 'playstation') {
      const hourlyRate = getPlayStationHourlyRate(this.controllers);
      const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
      const rawCost = minutes * minuteRate;
      total = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
    } else if (this.deviceType === 'computer') {
      const hourlyRate = 15; // 15 ج.م/ساعة للكمبيوتر
      const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
      const rawCost = minutes * minuteRate;
      total = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
    }
  }

  // Ensure minimum cost for very short sessions (less than 1 minute)
  if (total === 0 && this.startTime && this.endTime) {
    const durationMs = new Date(this.endTime) - new Date(this.startTime);
    const minutes = durationMs / (1000 * 60);

    if (minutes > 0) {
      console.log('💰 Setting minimum cost for short session');
      if (this.deviceType === 'playstation') {
        const hourlyRate = getPlayStationHourlyRate(this.controllers);
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const rawCost = minutes * minuteRate;
        total = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
      } else if (this.deviceType === 'computer') {
        const hourlyRate = 15; // 15 ج.م/ساعة للكمبيوتر
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const rawCost = minutes * minuteRate;
        total = roundToNearestPound(rawCost); // تقريب لأقرب جنيه صحيح
      }
    }
  }

  this.totalCost = total;
  this.finalCost = total - this.discount;

  console.log('💰 Final calculation:', {
    totalCost: this.totalCost,
    discount: this.discount,
    finalCost: this.finalCost,
    deviceType: this.deviceType,
    controllers: this.controllers
  });

  return this.finalCost;
};

// Update controllers during active session
sessionSchema.methods.updateControllers = function(newControllers) {
  if (this.status !== 'active') {
    throw new Error('لا يمكن تعديل عدد الدراعات في جلسة غير نشطة');
  }

  if (newControllers < 1 || newControllers > 4) {
    throw new Error('عدد الدراعات يجب أن يكون بين 1 و 4');
  }

  // Close current period
  if (this.controllersHistory.length > 0) {
    const currentPeriod = this.controllersHistory[this.controllersHistory.length - 1];
    if (!currentPeriod.to) {
      currentPeriod.to = new Date();
    }
  }

  // Add new period
  this.controllersHistory.push({
    controllers: newControllers,
    from: new Date(),
    to: null
  });

  this.controllers = newControllers;
  return this;
};

// End session
sessionSchema.methods.endSession = function() {
  if (this.status !== 'active') {
    throw new Error('الجلسة غير نشطة');
  }

  console.log('🔄 Ending session:', this._id);
  console.log('📊 Controllers history before ending:', this.controllersHistory);

  this.status = 'completed';
  this.endTime = new Date();

  // Close all open periods in controllersHistory
  if (this.controllersHistory && this.controllersHistory.length > 0) {
    for (const period of this.controllersHistory) {
      if (!period.to) {
        period.to = this.endTime;
        console.log('⏰ Closed period:', { from: period.from, to: period.to, controllers: period.controllers });
      }
    }
  } else {
    // If no controllersHistory exists, create one based on the session
    console.log('⚠️ No controllers history found, creating default period');
    this.controllersHistory = [{
      controllers: this.controllers,
      from: this.startTime,
      to: this.endTime
    }];
  }

  // Calculate final cost
  console.log('💰 Calculating final cost...');
  this.calculateCost();

  console.log('✅ Session ended successfully:', {
    finalCost: this.finalCost,
    totalCost: this.totalCost,
    duration: this.endTime - this.startTime
  });

  return this;
};

// Calculate current cost for active sessions
sessionSchema.methods.calculateCurrentCost = function() {
  if (this.status !== 'active') {
    return this.totalCost;
  }

  const now = new Date();
  let total = 0;

  // If no controllersHistory, calculate based on total duration
  if (!this.controllersHistory || this.controllersHistory.length === 0) {
    const durationMs = now - new Date(this.startTime);
    const minutes = durationMs / (1000 * 60);

    if (this.deviceType === 'playstation') {
      const hourlyRate = getPlayStationHourlyRate(this.controllers);
      const minuteRate = hourlyRate / 60;
      const rawCost = minutes * minuteRate;
      total = roundToNearestPound(rawCost);
    } else if (this.deviceType === 'computer') {
      const hourlyRate = 15;
      const minuteRate = hourlyRate / 60;
      const rawCost = minutes * minuteRate;
      total = roundToNearestPound(rawCost);
    }
  } else {
    // Calculate based on controllersHistory
    for (const period of this.controllersHistory) {
      let periodEnd = period.to;
      if (!periodEnd) {
        periodEnd = now; // Use current time for open periods
      }

      if (period.from && periodEnd) {
        const durationMs = new Date(periodEnd) - new Date(period.from);
        const minutes = durationMs / (1000 * 60);

        if (minutes > 0) {
          if (this.deviceType === 'playstation') {
            const hourlyRate = getPlayStationHourlyRate(period.controllers);
            const minuteRate = hourlyRate / 60;
            const rawPeriodCost = minutes * minuteRate;
            const periodCost = roundToNearestPound(rawPeriodCost);
            total += periodCost;
          } else if (this.deviceType === 'computer') {
            const hourlyRate = 15;
            const minuteRate = hourlyRate / 60;
            const rawPeriodCost = minutes * minuteRate;
            const periodCost = roundToNearestPound(rawPeriodCost);
            total += periodCost;
          }
        }
      }
    }
  }

  return total;
};

// Get detailed cost breakdown for PlayStation sessions
sessionSchema.methods.getCostBreakdown = function() {
  if (this.deviceType !== 'playstation') {
    return {
      totalCost: this.totalCost,
      breakdown: []
    };
  }

  const breakdown = [];
  const now = new Date();

  if (this.controllersHistory && this.controllersHistory.length > 0) {
    for (const period of this.controllersHistory) {
      let periodEnd = period.to;
      if (!periodEnd) {
        periodEnd = this.status === 'active' ? now : this.endTime;
      }

      if (period.from && periodEnd) {
        const durationMs = new Date(periodEnd) - new Date(period.from);
        const hours = durationMs / (1000 * 60 * 60);
        const minutes = durationMs / (1000 * 60);

        if (hours > 0) {
          const hourlyRate = getPlayStationHourlyRate(period.controllers);
          const periodCost = roundToNearestPound((minutes * hourlyRate) / 60);

          breakdown.push({
            controllers: period.controllers,
            hours: Math.floor(hours),
            minutes: Math.floor(minutes % 60),
            hourlyRate,
            cost: periodCost,
            from: period.from,
            to: periodEnd
          });
        }
      }
    }
  } else {
    // Fallback to total session duration
    const endTime = this.status === 'active' ? now : this.endTime;
    if (this.startTime && endTime) {
      const durationMs = new Date(endTime) - new Date(this.startTime);
      const hours = durationMs / (1000 * 60 * 60);
      const minutes = durationMs / (1000 * 60);

      if (hours > 0) {
        const hourlyRate = getPlayStationHourlyRate(this.controllers);
        const periodCost = roundToNearestPound((minutes * hourlyRate) / 60);

        breakdown.push({
          controllers: this.controllers,
          hours: Math.floor(hours),
          minutes: Math.floor(minutes % 60),
          hourlyRate,
          cost: periodCost,
          from: this.startTime,
          to: endTime
        });
      }
    }
  }

  return {
    totalCost: breakdown.reduce((sum, item) => sum + item.cost, 0),
    breakdown
  };
};

const Session = mongoose.model('Session', sessionSchema);
export default Session;
