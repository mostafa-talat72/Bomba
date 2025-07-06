import mongoose from 'mongoose';
import QRCode from 'qrcode';

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: false
  },
  tableNumber: {
    type: String,
    required: [true, 'رقم الطاولة مطلوب'],
    default: '0'
  },
  customerName: {
    type: String,
    default: null
  },
  customerPhone: {
    type: String,
    default: null
  },
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  paid: {
    type: Number,
    default: 0,
    min: 0
  },
  remaining: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'partial', 'paid', 'cancelled', 'overdue'],
    default: 'draft'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'mixed'],
    default: 'cash'
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'transfer'],
      required: true
    },
    reference: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  // تتبع المدفوعات الجزئية للمشروبات
  partialPayments: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    orderNumber: {
      type: String,
      required: true
    },
    items: [{
      itemName: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        default: 1
      },
      paidAt: {
        type: Date,
        default: Date.now
      },
      paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        required: true
      }
    }],
    totalPaid: {
      type: Number,
      required: true,
      default: 0
    }
  }],
  qrCode: {
    type: String,
    default: null
  },
  qrCodeUrl: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  billType: {
    type: String,
    enum: ['cafe', 'playstation', 'computer'],
    default: 'cafe',
    required: true
  },
  dueDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Generate bill number
billSchema.pre('save', async function(next) {
  if (this.isNew && !this.billNumber) {
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });
      this.billNumber = `INV-${dateStr}-${String(count + 1).padStart(3, '0')}`;
      console.log('📄 Generated bill number:', this.billNumber);
    } catch (error) {
      console.error('❌ Error generating bill number:', error);
      // Fallback bill number
      this.billNumber = `INV-${Date.now()}`;
    }
  }
  next();
});

// Calculate totals and status
billSchema.pre('save', function(next) {
  console.log('🔄 Bill pre-save middleware - Current status:', this.status);
  console.log('🔄 Bill pre-save middleware - Paid amount:', this.paid);
  console.log('🔄 Bill pre-save middleware - Total amount:', this.total);

  // حساب المبلغ المتبقي
  this.remaining = this.total - this.paid;

  // تحديد حالة الفاتورة بناءً على المبلغ المتبقي
  // لا نعيد تحديد الحالة إذا كانت ملغية
  if (this.status !== 'cancelled') {
    console.log('🔄 Bill pre-save middleware - Status is not cancelled, recalculating...');

    if (this.remaining === 0 && this.paid > 0) {
      // إذا كان المبلغ المتبقي = صفر وتم دفع شيء، تصبح مدفوعة بالكامل
      this.status = 'paid';
      console.log('🔄 Bill pre-save middleware - Setting status to: paid');
    } else if (this.paid > 0 && this.paid < this.total) {
      // إذا تم دفع جزء من المبلغ، تصبح مدفوعة جزئياً
      this.status = 'partial';
      console.log('🔄 Bill pre-save middleware - Setting status to: partial');
    } else if (this.paid === 0) {
      // إذا لم يتم دفع أي شيء، تبقى مسودة
      this.status = 'draft';
      console.log('🔄 Bill pre-save middleware - Setting status to: draft');
    }

    // التحقق من التأخير (إذا كان هناك تاريخ استحقاق)
    if (this.dueDate && this.dueDate < new Date() && this.status !== 'paid') {
      this.status = 'overdue';
      console.log('🔄 Bill pre-save middleware - Setting status to: overdue (due date passed)');
    }
  } else {
    console.log('🔄 Bill pre-save middleware - Status is cancelled, keeping as is');
  }

  console.log('🔄 Bill pre-save middleware - Final status:', this.status);
  next();
});

// Generate QR Code after save
billSchema.post('save', async function(doc) {
  if (!doc.qrCode) {
    try {
      const qrData = {
        billId: doc._id,
        billNumber: doc.billNumber,
        total: doc.total,
        url: `http://localhost:3000/bill/${doc._id}`
      };

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

      await this.constructor.findByIdAndUpdate(doc._id, {
        qrCode: qrCodeDataURL,
        qrCodeUrl: qrData.url
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }
});

// Add payment
billSchema.methods.addPayment = function(amount, method, user, reference = null) {
  this.payments.push({
    amount,
    method,
    reference,
    user,
    timestamp: new Date()
  });

  this.paid += amount;
  return this.save();
};

// Add partial payment for specific items
billSchema.methods.addPartialPayment = function(orderId, orderNumber, items, user, paymentMethod) {
  const totalPaid = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  this.partialPayments.push({
    orderId,
    orderNumber,
    items: items.map(item => ({
      ...item,
      paidBy: user._id,
      paymentMethod
    })),
    totalPaid
  });

  this.paid += totalPaid;
  return this.save();
};

// Get partial payments summary
billSchema.methods.getPartialPaymentsSummary = function() {
  const summary = {
    totalPaid: 0,
    orders: {}
  };

  this.partialPayments.forEach(payment => {
    summary.totalPaid += payment.totalPaid;
    if (!summary.orders[payment.orderId]) {
      summary.orders[payment.orderId] = {
        orderNumber: payment.orderNumber,
        items: [],
        totalPaid: 0
      };
    }
    summary.orders[payment.orderId].items.push(...payment.items);
    summary.orders[payment.orderId].totalPaid += payment.totalPaid;
  });

  return summary;
};

// Calculate subtotal from orders and sessions
billSchema.methods.calculateSubtotal = async function() {
  try {
    console.log('🔄 Calculating subtotal for bill:', this.billNumber);

    // Try to populate, but don't fail if models aren't available
    try {
      await this.populate(['orders', 'sessions']);
      console.log('✅ Populated orders and sessions');
    } catch (populateError) {
      console.log('⚠️ Could not populate orders/sessions, using direct values');
    }

    let subtotal = 0;

    // Add orders total
    if (this.orders && this.orders.length > 0) {
      console.log('📋 Processing orders:', this.orders.length);
      subtotal += this.orders.reduce((sum, order) => {
        const orderAmount = order.finalAmount || order.totalAmount || 0;
        console.log('📋 Order:', order.orderNumber, 'Amount:', orderAmount);
        return sum + orderAmount;
      }, 0);
    }

    // Add sessions total
    if (this.sessions && this.sessions.length > 0) {
      console.log('📋 Processing sessions:', this.sessions.length);
      subtotal += this.sessions.reduce((sum, session) => {
        const sessionAmount = session.finalCost || session.totalCost || 0;
        console.log('📋 Session:', session._id, 'Amount:', sessionAmount);
        return sum + sessionAmount;
      }, 0);
    }

    // If no orders or sessions, use the existing subtotal
    if (subtotal === 0 && this.subtotal > 0) {
      subtotal = this.subtotal;
      console.log('⚠️ Using existing subtotal:', subtotal);
    }

    this.subtotal = subtotal;
    this.total = this.subtotal + (this.tax || 0) - (this.discount || 0);

    console.log('💰 Bill calculation:', {
      subtotal: this.subtotal,
      tax: this.tax,
      discount: this.discount,
      total: this.total
    });

    return this.save();
  } catch (error) {
    console.error('❌ Error in calculateSubtotal:', error);
    // Set default values if calculation fails
    this.subtotal = this.subtotal || 0;
    this.total = this.total || 0;
    return this.save();
  }
};

// Indexes
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ tableNumber: 1 });
billSchema.index({ status: 1 });
billSchema.index({ billType: 1 });
billSchema.index({ createdAt: 1 });
billSchema.index({ customerName: 1 });

export default mongoose.model('Bill', billSchema);
