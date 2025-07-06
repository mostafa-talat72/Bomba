import mongoose from 'mongoose';

const orderItemAddonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الإضافة مطلوب']
  },
  price: {
    type: Number,
    required: [true, 'سعر الإضافة مطلوب'],
    min: 0
  }
});

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: [true, 'عنصر القائمة مطلوب']
  },
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب']
  },
  arabicName: {
    type: String,
    required: [true, 'الاسم العربي مطلوب']
  },
  price: {
    type: Number,
    required: [true, 'سعر المنتج مطلوب'],
    min: 0
  },
  quantity: {
    type: Number,
    required: [true, 'الكمية مطلوبة'],
    min: 1
  },
  preparedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  addons: [orderItemAddonSchema],
  addonsTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  itemTotal: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    default: null
  },
  preparationTime: {
    type: Number, // in minutes
    default: 5
  },
  isReady: {
    type: Boolean,
    default: false
  },
  wasEverReady: {
    type: Boolean,
    default: false
  },
  readyTime: {
    type: Date,
    default: null
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true
  },
  tableNumber: {
    type: Number,
    required: [true, 'رقم الطاولة مطلوب'],
    min: 1
  },
  customerName: {
    type: String,
    default: null
  },
  customerPhone: {
    type: String,
    default: null
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  subtotal: {
    type: Number,
    required: [true, 'المبلغ الفرعي مطلوب'],
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    default: null
  },
  estimatedReadyTime: {
    type: Date,
    default: null
  },
  actualReadyTime: {
    type: Date,
    default: null
  },
  deliveredTime: {
    type: Date,
    default: null
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  preparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deliveredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Combined pre-save hook for all operations
orderSchema.pre('save', async function(next) {
  try {
    console.log('🔄 Pre-save hook started for order');

    // Generate order number if new
    if (this.isNew) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });
      this.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;
      console.log('🔢 Generated order number:', this.orderNumber);
    }

    // Calculate item totals and subtotal
    if (this.items && this.items.length > 0) {
      this.subtotal = this.items.reduce((total, item) => {
        const itemTotal = (item.price + item.addonsTotal) * item.quantity;
        item.itemTotal = itemTotal;
        return total + itemTotal;
      }, 0);
    }

    // Calculate final amount
    this.finalAmount = this.subtotal - (this.discount || 0);
    console.log('💰 Calculated amounts:', {
      subtotal: this.subtotal,
      discount: this.discount || 0,
      finalAmount: this.finalAmount
    });

    // Update status timestamps
    if (this.isModified('status')) {
      const now = new Date();

      switch (this.status) {
        case 'preparing':
          // Calculate estimated ready time based on longest preparation time
          if (this.items && this.items.length > 0) {
            const maxPrepTime = Math.max(...this.items.map(item => item.preparationTime || 5));
            this.estimatedReadyTime = new Date(now.getTime() + maxPrepTime * 60000);
          }
          break;
        case 'ready':
          this.actualReadyTime = now;
          break;
        case 'delivered':
          this.deliveredTime = now;
          break;
      }
    }

    console.log('✅ Pre-save hook completed successfully');
    next();
  } catch (error) {
    console.error('❌ Pre-save hook error:', error);
    next(error);
  }
});

// Add post-save hook for logging
orderSchema.post('save', function(doc, next) {
  if (doc) {
    console.log('✅ Order saved successfully:', {
      orderNumber: doc.orderNumber,
      customerName: doc.customerName,
      subtotal: doc.subtotal,
      status: doc.status,
      createdAt: doc.createdAt
    });
  }
  next();
});

// Add post-save hook for error logging
orderSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('❌ Order save error:', {
      error: error.message,
      orderData: doc ? {
        customerName: doc.customerName,
        itemsCount: doc.items ? doc.items.length : 0,
        subtotal: doc.subtotal
      } : 'No doc'
    });
  }
  next(error);
});

// Indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ tableNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ bill: 1 });

export default mongoose.model('Order', orderSchema);
