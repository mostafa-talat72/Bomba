import mongoose from 'mongoose';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkDevices() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🔍 فحص الأجهزة في قاعدة البيانات...');

    const devices = await Device.find({});
    console.log(`📊 عدد الأجهزة: ${devices.length}`);

    if (devices.length > 0) {
      console.log('\n📋 تفاصيل الأجهزة:');
      devices.forEach((device, index) => {
        console.log(`${index + 1}. ${device.name} - رقم: ${device.number} - نوع: ${device.type} - حالة: ${device.status}`);
      });
    } else {
      console.log('❌ لا توجد أجهزة في قاعدة البيانات');
    }

    // فحص الأجهزة التي لها number = null
    const nullDevices = await Device.find({ number: null });
    console.log(`\n⚠️ الأجهزة برقم null: ${nullDevices.length}`);

    if (nullDevices.length > 0) {
      console.log('🔧 حذف الأجهزة برقم null...');
      await Device.deleteMany({ number: null });
      console.log('✅ تم حذف الأجهزة برقم null');
    }

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

checkDevices();
