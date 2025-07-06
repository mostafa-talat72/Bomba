import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';
import '../config/database.js';

const seedMenuItems = async () => {
  try {
    console.log('🌱 بدء إضافة بيانات تجريبية للمنيو...\n');

    // Get admin user for createdBy field
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ لم يتم العثور على مستخدم مدير. يرجى إنشاء مستخدم مدير أولاً.');
      return;
    }

    // Sample menu items data
    const menuItemsData = [
      // مشروبات ساخنة
      {
        name: 'قهوة تركية',
        price: 15,
        category: 'مشروبات ساخنة',
        description: 'قهوة تركية تقليدية مع الهيل',
        isAvailable: true,
        preparationTime: 3,
        calories: 5,
        allergens: [],
        isPopular: true,
        orderCount: 45
      },
      {
        name: 'شاي أحمر',
        price: 10,
        category: 'مشروبات ساخنة',
        description: 'شاي أحمر طبيعي',
        isAvailable: true,
        preparationTime: 2,
        calories: 2,
        allergens: [],
        isPopular: true,
        orderCount: 38
      },
      {
        name: 'نسكافيه',
        price: 12,
        category: 'مشروبات ساخنة',
        description: 'نسكافيه 3 في 1',
        isAvailable: true,
        preparationTime: 2,
        calories: 80,
        allergens: ['حليب'],
        isPopular: false,
        orderCount: 25
      },
      {
        name: 'شاي أخضر',
        price: 12,
        category: 'مشروبات ساخنة',
        description: 'شاي أخضر طبيعي',
        isAvailable: true,
        preparationTime: 3,
        calories: 1,
        allergens: [],
        isPopular: false,
        orderCount: 15
      },

      // مشروبات باردة
      {
        name: 'عصير برتقال',
        price: 18,
        category: 'مشروبات باردة',
        description: 'عصير برتقال طازج',
        isAvailable: true,
        preparationTime: 2,
        calories: 110,
        allergens: [],
        isPopular: true,
        orderCount: 52
      },
      {
        name: 'كولا',
        price: 15,
        category: 'مشروبات باردة',
        description: 'كوكا كولا',
        isAvailable: true,
        preparationTime: 1,
        calories: 140,
        allergens: [],
        isPopular: true,
        orderCount: 48
      },
      {
        name: 'عصير تفاح',
        price: 20,
        category: 'مشروبات باردة',
        description: 'عصير تفاح طبيعي',
        isAvailable: true,
        preparationTime: 2,
        calories: 120,
        allergens: [],
        isPopular: false,
        orderCount: 22
      },
      {
        name: 'ليمونادة',
        price: 16,
        category: 'مشروبات باردة',
        description: 'ليمونادة طازجة',
        isAvailable: true,
        preparationTime: 3,
        calories: 90,
        allergens: [],
        isPopular: false,
        orderCount: 18
      },

      // طعام
      {
        name: 'ساندويش جبنة',
        price: 20,
        category: 'طعام',
        description: 'ساندويش جبنة مشوية',
        isAvailable: true,
        preparationTime: 5,
        calories: 280,
        allergens: ['حليب', 'قمح'],
        isPopular: true,
        orderCount: 35
      },
      {
        name: 'كرواسون',
        price: 25,
        category: 'طعام',
        description: 'كرواسون فرنسي',
        isAvailable: true,
        preparationTime: 2,
        calories: 320,
        allergens: ['حليب', 'بيض', 'قمح'],
        isPopular: true,
        orderCount: 42
      },
      {
        name: 'ساندويش دجاج',
        price: 30,
        category: 'طعام',
        description: 'ساندويش دجاج مشوي',
        isAvailable: true,
        preparationTime: 8,
        calories: 350,
        allergens: ['قمح'],
        isPopular: false,
        orderCount: 28
      },
      {
        name: 'بيتزا صغيرة',
        price: 45,
        category: 'طعام',
        description: 'بيتزا صغيرة بالجبنة',
        isAvailable: true,
        preparationTime: 15,
        calories: 450,
        allergens: ['حليب', 'قمح'],
        isPopular: false,
        orderCount: 20
      },

      // حلويات
      {
        name: 'كيك شوكولاتة',
        price: 30,
        category: 'حلويات',
        description: 'كيك شوكولاتة طازج',
        isAvailable: true,
        preparationTime: 2,
        calories: 380,
        allergens: ['حليب', 'بيض', 'قمح'],
        isPopular: true,
        orderCount: 40
      },
      {
        name: 'كنافة',
        price: 35,
        category: 'حلويات',
        description: 'كنافة بالجبنة',
        isAvailable: true,
        preparationTime: 3,
        calories: 420,
        allergens: ['حليب', 'قمح'],
        isPopular: false,
        orderCount: 25
      },
      {
        name: 'بسبوسة',
        price: 25,
        category: 'حلويات',
        description: 'بسبوسة بالجوز',
        isAvailable: true,
        preparationTime: 2,
        calories: 320,
        allergens: ['مكسرات', 'قمح'],
        isPopular: false,
        orderCount: 18
      },

      // وجبات سريعة
      {
        name: 'برجر دجاج',
        price: 40,
        category: 'وجبات سريعة',
        description: 'برجر دجاج مع البطاطس',
        isAvailable: true,
        preparationTime: 10,
        calories: 550,
        allergens: ['قمح'],
        isPopular: true,
        orderCount: 38
      },
      {
        name: 'شاورما دجاج',
        price: 35,
        category: 'وجبات سريعة',
        description: 'شاورما دجاج مع الخضار',
        isAvailable: true,
        preparationTime: 8,
        calories: 480,
        allergens: ['قمح'],
        isPopular: true,
        orderCount: 45
      },

      // عصائر طبيعية
      {
        name: 'عصير مانجو',
        price: 25,
        category: 'عصائر طبيعية',
        description: 'عصير مانجو طبيعي',
        isAvailable: true,
        preparationTime: 4,
        calories: 140,
        allergens: [],
        isPopular: false,
        orderCount: 15
      },
      {
        name: 'عصير فراولة',
        price: 22,
        category: 'عصائر طبيعية',
        description: 'عصير فراولة طبيعي',
        isAvailable: true,
        preparationTime: 4,
        calories: 120,
        allergens: [],
        isPopular: false,
        orderCount: 12
      },

      // منتجات أخرى
      {
        name: 'شيبسي',
        price: 8,
        category: 'منتجات أخرى',
        description: 'شيبسي نكهة البطاطس',
        isAvailable: true,
        preparationTime: 1,
        calories: 150,
        allergens: [],
        isPopular: true,
        orderCount: 60
      },
      {
        name: 'شوكولاتة',
        price: 12,
        category: 'منتجات أخرى',
        description: 'شوكولاتة داكنة',
        isAvailable: true,
        preparationTime: 1,
        calories: 200,
        allergens: ['حليب'],
        isPopular: false,
        orderCount: 30
      },
      {
        name: 'مكسرات',
        price: 20,
        category: 'منتجات أخرى',
        description: 'مكسرات مشكلة',
        isAvailable: true,
        preparationTime: 1,
        calories: 180,
        allergens: ['مكسرات'],
        isPopular: false,
        orderCount: 22
      }
    ];

    // Check if menu items already exist
    const existingCount = await MenuItem.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️ يوجد ${existingCount} عنصر في القائمة بالفعل.`);
      const shouldContinue = process.argv.includes('--force');
      if (!shouldContinue) {
        console.log('استخدم --force لتجاوز هذا التحذير وإضافة البيانات التجريبية.');
        return;
      }
      console.log('حذف العناصر الموجودة...');
      await MenuItem.deleteMany({});
    }

    // Add createdBy field to all items
    const itemsWithUser = menuItemsData.map(item => ({
      ...item,
      createdBy: adminUser._id
    }));

    // Insert menu items
    const result = await MenuItem.insertMany(itemsWithUser);

    console.log(`✅ تم إضافة ${result.length} عنصر بنجاح!\n`);

    // Show summary by category
    console.log('📊 ملخص العناصر حسب الفئة:');
    const categoryStats = await MenuItem.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalOrders: { $sum: '$orderCount' },
          averagePrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    categoryStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} عنصر - ${stat.totalOrders} طلب - متوسط السعر: ${stat.averagePrice.toFixed(1)} ج.م`);
    });

    console.log('\n🎉 تم الانتهاء من إضافة بيانات تجريبية للمنيو!');

  } catch (error) {
    console.error('❌ خطأ في إضافة بيانات تجريبية للمنيو:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
};

seedMenuItems();
