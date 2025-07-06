import mongoose from 'mongoose';

const addonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الإضافة مطلوب'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'سعر الإضافة مطلوب'],
    min: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
});

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب'],
    trim: true
  },
  arabicName: {
    type: String,
    required: [true, 'الاسم العربي مطلوب'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'فئة المنتج مطلوبة'],
    enum: ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'وجبات خفيفة', 'عصائر', 'قهوة', 'شاي']
  },
  description: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    required: [true, 'السعر مطلوب'],
    min: 0
  },
  image: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  preparationTime: {
    type: Number, // in minutes
    default: 5,
    min: 1
  },
  addons: [addonSchema],
  notes: {
    type: String,
    default: null
  },
  allergens: [{
    type: String,
    enum: ['حليب', 'بيض', 'فول سوداني', 'مكسرات', 'سمك', 'محار', 'قمح', 'صويا']
  }],
  nutritionalInfo: {
    calories: {
      type: Number,
      default: null
    },
    protein: {
      type: Number,
      default: null
    },
    carbs: {
      type: Number,
      default: null
    },
    fat: {
      type: Number,
      default: null
    }
  },
  sortOrder: {
    type: Number,
    default: 0
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

// Indexes
menuItemSchema.index({ name: 1 });
menuItemSchema.index({ arabicName: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ isPopular: 1 });
menuItemSchema.index({ sortOrder: 1 });

export default mongoose.model('MenuItem', menuItemSchema);
