import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'فئة المنتج مطلوبة'],
    enum: ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'مواد خام', 'أخرى']
  },
  currentStock: {
    type: Number,
    required: [true, 'المخزون الحالي مطلوب'],
    min: 0,
    default: 0
  },
  minStock: {
    type: Number,
    required: [true, 'الحد الأدنى للمخزون مطلوب'],
    min: 0,
    default: 10
  },
  maxStock: {
    type: Number,
    default: null,
    min: 0
  },
  unit: {
    type: String,
    required: [true, 'وحدة القياس مطلوبة'],
    enum: ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كيس', 'زجاجة']
  },
  price: {
    type: Number,
    required: [true, 'السعر مطلوب'],
    min: 0
  },
  cost: {
    type: Number,
    default: 0,
    min: 0
  },
  supplier: {
    type: String,
    default: null
  },
  supplierContact: {
    type: String,
    default: null
  },
  barcode: {
    type: String,
    default: null,
    sparse: true
  },
  description: {
    type: String,
    default: null
  },
  image: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isRawMaterial: {
    type: Boolean,
    default: false
  },
  recipe: [{
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  }],
  stockMovements: [{
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    reference: {
      type: String,
      default: null
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastRestocked: {
    type: Date,
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Check if item is low stock
inventoryItemSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minStock;
});

// Check if item is out of stock
inventoryItemSchema.virtual('isOutOfStock').get(function() {
  return this.currentStock === 0;
});

// Calculate profit margin
inventoryItemSchema.virtual('profitMargin').get(function() {
  if (this.cost === 0) return 0;
  return ((this.price - this.cost) / this.cost) * 100;
});

// Add stock movement
inventoryItemSchema.methods.addStockMovement = function(type, quantity, reason, user, reference = null) {
  this.stockMovements.push({
    type,
    quantity,
    reason,
    reference,
    user,
    timestamp: new Date()
  });

  if (type === 'in') {
    this.currentStock += quantity;
    this.lastRestocked = new Date();
  } else if (type === 'out') {
    this.currentStock = Math.max(0, this.currentStock - quantity);
  } else if (type === 'adjustment') {
    this.currentStock = quantity;
  }

  return this.save();
};

// Consume ingredients for recipe
inventoryItemSchema.methods.consumeIngredients = async function(quantity = 1) {
  if (!this.recipe || this.recipe.length === 0) return;

  for (const ingredient of this.recipe) {
    const item = await this.constructor.findById(ingredient.ingredient);
    if (item) {
      const consumeQty = ingredient.quantity * quantity;
      await item.addStockMovement(
        'out',
        consumeQty,
        `استهلاك لتحضير ${this.name}`,
        null,
        this._id.toString()
      );
    }
  }
};

// Indexes
inventoryItemSchema.index({ name: 1 }, { unique: true });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ currentStock: 1 });
inventoryItemSchema.index({ isActive: 1 });
inventoryItemSchema.index({ barcode: 1 }, { sparse: true });

export default mongoose.model('InventoryItem', inventoryItemSchema);
