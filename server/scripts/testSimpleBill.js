import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSimpleBill() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🧪 اختبار إنشاء فاتورة بسيطة...');

    // إنشاء فاتورة بسيطة
    const billData = {
      tableNumber: 1,
      sessions: [],
      notes: 'فاتورة بلايستيشن',
      subtotal: 0,
      total: 0,
      createdBy: new mongoose.Types.ObjectId() // إنشاء ObjectId مؤقت
    };

    console.log('📝 بيانات الفاتورة:', billData);

    const bill = new Bill(billData);
    await bill.save();

    console.log(`✅ تم إنشاء الفاتورة: ${bill.billNumber}`);
    console.log(`📊 رقم الفاتورة: ${bill.billNumber}`);
    console.log(`💰 المبلغ: ${bill.total}`);
    console.log(`📋 الحالة: ${bill.status}`);

    console.log('\n✅ تم اختبار إنشاء الفاتورة بنجاح!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

testSimpleBill();
