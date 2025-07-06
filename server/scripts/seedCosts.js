import mongoose from 'mongoose';
import Cost from '../models/Cost.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Connect to MongoDB directly
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bastira';
    console.log('🔄 Connecting to MongoDB...');

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB Connected Successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const sampleCosts = [
  {
    category: 'rent',
    description: 'إيجار المحل - يناير 2024',
    amount: 5000,
    date: new Date('2024-01-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-001',
    vendor: 'شركة العقارات المتحدة',
    vendorContact: '0123456789'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - يناير',
    amount: 450,
    date: new Date('2024-01-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-001',
    vendor: 'شركة الكهرباء'
  },
  {
    category: 'utilities',
    description: 'فاتورة المياه - يناير',
    amount: 120,
    date: new Date('2024-01-20'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'WATER-2024-001',
    vendor: 'شركة المياه'
  },
  {
    category: 'utilities',
    description: 'فاتورة الإنترنت - يناير',
    amount: 300,
    date: new Date('2024-01-10'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'NET-2024-001',
    vendor: 'شركة الاتصالات'
  },
  {
    category: 'salaries',
    description: 'راتب أحمد - يناير 2024',
    amount: 3000,
    date: new Date('2024-01-31'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'SAL-2024-001',
    vendor: 'أحمد محمد'
  },
  {
    category: 'salaries',
    description: 'راتب سارة - يناير 2024',
    amount: 2800,
    date: new Date('2024-01-31'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'SAL-2024-002',
    vendor: 'سارة أحمد'
  },
  {
    category: 'maintenance',
    description: 'صيانة بلايستيشن 2',
    amount: 200,
    date: new Date('2024-01-20'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'MNT-2024-001',
    vendor: 'مركز الصيانة السريع'
  },
  {
    category: 'maintenance',
    description: 'صيانة مكيف الهواء',
    amount: 350,
    date: new Date('2024-01-25'),
    status: 'pending',
    paymentMethod: 'cash',
    vendor: 'شركة الصيانة المتخصصة'
  },
  {
    category: 'inventory',
    description: 'شراء قهوة ومواد خام',
    amount: 800,
    date: new Date('2024-01-18'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'INV-2024-001',
    vendor: 'مورد القهوة الجيد'
  },
  {
    category: 'inventory',
    description: 'شراء أوراق ومواد مكتبية',
    amount: 150,
    date: new Date('2024-01-22'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'INV-2024-002',
    vendor: 'متجر الأدوات المكتبية'
  },
  {
    category: 'marketing',
    description: 'إعلانات فيسبوك - يناير',
    amount: 500,
    date: new Date('2024-01-12'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'ADV-2024-001',
    vendor: 'فيسبوك'
  },
  {
    category: 'marketing',
    description: 'طباعة منشورات إعلانية',
    amount: 200,
    date: new Date('2024-01-28'),
    status: 'pending',
    paymentMethod: 'cash',
    vendor: 'مطبعة المدينة'
  },
  {
    category: 'insurance',
    description: 'تأمين المحل - يناير',
    amount: 400,
    date: new Date('2024-01-05'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'INS-2024-001',
    vendor: 'شركة التأمين الوطنية'
  },
  {
    category: 'other',
    description: 'رسوم البلدية',
    amount: 250,
    date: new Date('2024-01-08'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'MUN-2024-001',
    vendor: 'بلدية المدينة'
  },
  {
    category: 'other',
    description: 'رسوم الترخيص التجاري',
    amount: 300,
    date: new Date('2024-01-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'LIC-2024-001',
    vendor: 'إدارة الترخيص'
  },
  // بيانات فبراير
  {
    category: 'rent',
    description: 'إيجار المحل - فبراير 2024',
    amount: 5000,
    date: new Date('2024-02-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-002',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - فبراير',
    amount: 480,
    date: new Date('2024-02-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-002',
    vendor: 'شركة الكهرباء'
  },
  {
    category: 'salaries',
    description: 'راتب أحمد - فبراير 2024',
    amount: 3000,
    date: new Date('2024-02-29'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'SAL-2024-003',
    vendor: 'أحمد محمد'
  },
  {
    category: 'inventory',
    description: 'شراء قهوة ومواد خام - فبراير',
    amount: 750,
    date: new Date('2024-02-18'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'INV-2024-003',
    vendor: 'مورد القهوة الجيد'
  },
  // بيانات مارس
  {
    category: 'rent',
    description: 'إيجار المحل - مارس 2024',
    amount: 5000,
    date: new Date('2024-03-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-003',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - مارس',
    amount: 520,
    date: new Date('2024-03-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-003',
    vendor: 'شركة الكهرباء'
  },
  {
    category: 'maintenance',
    description: 'صيانة الكمبيوترات',
    amount: 400,
    date: new Date('2024-03-10'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'MNT-2024-002',
    vendor: 'مركز صيانة الكمبيوتر'
  },
  // بيانات أبريل
  {
    category: 'rent',
    description: 'إيجار المحل - أبريل 2024',
    amount: 5000,
    date: new Date('2024-04-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-004',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'marketing',
    description: 'حملة إعلانية عيد الفطر',
    amount: 800,
    date: new Date('2024-04-05'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'ADV-2024-002',
    vendor: 'وكالة الإعلانات'
  },
  // بيانات مايو
  {
    category: 'rent',
    description: 'إيجار المحل - مايو 2024',
    amount: 5000,
    date: new Date('2024-05-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-005',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - مايو',
    amount: 600,
    date: new Date('2024-05-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-004',
    vendor: 'شركة الكهرباء'
  },
  // بيانات يونيو
  {
    category: 'rent',
    description: 'إيجار المحل - يونيو 2024',
    amount: 5000,
    date: new Date('2024-06-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-006',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'maintenance',
    description: 'صيانة المكيفات',
    amount: 600,
    date: new Date('2024-06-10'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'MNT-2024-003',
    vendor: 'شركة صيانة المكيفات'
  },
  // بيانات يوليو
  {
    category: 'rent',
    description: 'إيجار المحل - يوليو 2024',
    amount: 5000,
    date: new Date('2024-07-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-007',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - يوليو',
    amount: 700,
    date: new Date('2024-07-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-005',
    vendor: 'شركة الكهرباء'
  },
  // بيانات أغسطس
  {
    category: 'rent',
    description: 'إيجار المحل - أغسطس 2024',
    amount: 5000,
    date: new Date('2024-08-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-008',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'marketing',
    description: 'إعلانات العودة للمدارس',
    amount: 400,
    date: new Date('2024-08-20'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'ADV-2024-003',
    vendor: 'فيسبوك'
  },
  // بيانات سبتمبر
  {
    category: 'rent',
    description: 'إيجار المحل - سبتمبر 2024',
    amount: 5000,
    date: new Date('2024-09-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-009',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - سبتمبر',
    amount: 550,
    date: new Date('2024-09-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-006',
    vendor: 'شركة الكهرباء'
  },
  // بيانات أكتوبر
  {
    category: 'rent',
    description: 'إيجار المحل - أكتوبر 2024',
    amount: 5000,
    date: new Date('2024-10-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-010',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'inventory',
    description: 'شراء معدات جديدة',
    amount: 1200,
    date: new Date('2024-10-10'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'INV-2024-004',
    vendor: 'متجر المعدات'
  },
  // بيانات نوفمبر
  {
    category: 'rent',
    description: 'إيجار المحل - نوفمبر 2024',
    amount: 5000,
    date: new Date('2024-11-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-011',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'utilities',
    description: 'فاتورة الكهرباء - نوفمبر',
    amount: 480,
    date: new Date('2024-11-15'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'ELEC-2024-007',
    vendor: 'شركة الكهرباء'
  },
  // بيانات ديسمبر
  {
    category: 'rent',
    description: 'إيجار المحل - ديسمبر 2024',
    amount: 5000,
    date: new Date('2024-12-01'),
    status: 'paid',
    paymentMethod: 'transfer',
    receipt: 'RENT-2024-012',
    vendor: 'شركة العقارات المتحدة'
  },
  {
    category: 'marketing',
    description: 'حملة إعلانية عيد الميلاد',
    amount: 600,
    date: new Date('2024-12-10'),
    status: 'paid',
    paymentMethod: 'card',
    receipt: 'ADV-2024-004',
    vendor: 'وكالة الإعلانات'
  },
  {
    category: 'other',
    description: 'تجهيزات عيد الميلاد',
    amount: 300,
    date: new Date('2024-12-20'),
    status: 'paid',
    paymentMethod: 'cash',
    receipt: 'DEC-2024-001',
    vendor: 'متجر التجهيزات'
  }
];

const createDefaultUser = async () => {
  try {
    // Check if user exists
    let user = await User.findOne({ email: 'admin@bastira.com' });

    if (!user) {
      console.log('👤 إنشاء مستخدم افتراضي...');

      const hashedPassword = await bcrypt.hash('admin123', 12);

      user = await User.create({
        name: 'مدير النظام',
        email: 'admin@bastira.com',
        password: hashedPassword,
        role: 'admin',
        permissions: ['all'],
        status: 'active'
      });

      console.log('✅ تم إنشاء المستخدم الافتراضي بنجاح');
    } else {
      console.log('✅ المستخدم موجود بالفعل');
    }

    return user;
  } catch (error) {
    console.error('❌ خطأ في إنشاء المستخدم:', error.message);
    throw error;
  }
};

const seedCosts = async () => {
  try {
    console.log('🌱 بدء إضافة بيانات التكاليف التجريبية...');

    // Connect to database
    await connectDB();

    // Create or get user
    const user = await createDefaultUser();

    // Delete existing costs
    await Cost.deleteMany({});
    console.log('🗑️ تم حذف بيانات التكاليف الموجودة');

    // Add new costs
    const costsWithUser = sampleCosts.map(cost => ({
      ...cost,
      createdBy: user._id
    }));

    const createdCosts = await Cost.insertMany(costsWithUser);
    console.log(`✅ تم إضافة ${createdCosts.length} تكلفة بنجاح`);

    // Show quick statistics
    const totalAmount = createdCosts.reduce((sum, cost) => sum + cost.amount, 0);
    console.log(`💰 إجمالي التكاليف: ${totalAmount} ج.م`);

    const categoryStats = {};
    createdCosts.forEach(cost => {
      categoryStats[cost.category] = (categoryStats[cost.category] || 0) + cost.amount;
    });

    console.log('📊 توزيع التكاليف حسب الفئة:');
    Object.entries(categoryStats).forEach(([category, amount]) => {
      console.log(`   ${category}: ${amount} ج.م`);
    });

    console.log('🎉 تم إكمال إضافة بيانات التكاليف التجريبية');

  } catch (error) {
    console.error('❌ خطأ في إضافة بيانات التكاليف:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
};

seedCosts();
