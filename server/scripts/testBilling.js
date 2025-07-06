import mongoose from 'mongoose';
import Device from '../models/Device.js';
import Session from '../models/Session.js';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testBilling() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🧪 اختبار إنشاء الفاتورة...');

    // فحص الأجهزة
    const devices = await Device.find({});
    console.log(`📊 عدد الأجهزة: ${devices.length}`);

    // فحص الجلسات النشطة
    const activeSessions = await Session.find({ status: 'active' });
    console.log(`📊 الجلسات النشطة: ${activeSessions.length}`);

    if (activeSessions.length > 0) {
      console.log('\n📋 تفاصيل الجلسات النشطة:');
      activeSessions.forEach((session, index) => {
        console.log(`${index + 1}. جهاز رقم: ${session.deviceNumber} - نوع: ${session.deviceType} - دراعات: ${session.controllers}`);
      });

      // محاولة إنشاء فاتورة
      const session = activeSessions[0];
      console.log(`\n💰 إنشاء فاتورة للجلسة: ${session._id}`);

      const billData = {
        tableNumber: 0,
        sessions: [session._id],
        notes: 'فاتورة بلايستيشن',
        subtotal: 0,
        total: 0,
        createdBy: session.createdBy
      };

      const bill = new Bill(billData);
      await bill.save();

      console.log(`✅ تم إنشاء الفاتورة: ${bill.billNumber}`);

      // تحديث الجلسة برقم الفاتورة
      await Session.findByIdAndUpdate(session._id, { bill: bill._id });
      console.log('✅ تم ربط الفاتورة بالجلسة');

    } else {
      console.log('❌ لا توجد جلسات نشطة لإنشاء فاتورة');
    }

    // فحص الفواتير
    const bills = await Bill.find({});
    console.log(`📊 عدد الفواتير: ${bills.length}`);

    if (bills.length > 0) {
      console.log('\n📋 تفاصيل الفواتير:');
      bills.forEach((bill, index) => {
        console.log(`${index + 1}. رقم الفاتورة: ${bill.billNumber} - الحالة: ${bill.status} - المبلغ: ${bill.total}`);
      });
    }

    console.log('\n✅ تم اختبار نظام الفواتير بنجاح!');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

testBilling();
