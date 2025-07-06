import mongoose from 'mongoose';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAddDevice() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🧪 اختبار إضافة جهاز جديد...');

    // فحص الأجهزة الموجودة
    const existingDevices = await Device.find({});
    console.log(`📊 الأجهزة الموجودة: ${existingDevices.length}`);

    existingDevices.forEach(device => {
      console.log(`- ${device.name} (رقم: ${device.number})`);
    });

    // العثور على أكبر رقم جهاز
    const maxNumber = existingDevices.length > 0
      ? Math.max(...existingDevices.map(d => d.number))
      : 0;

    const newDeviceNumber = maxNumber + 1;
    console.log(`🔢 الرقم المقترح للجهاز الجديد: ${newDeviceNumber}`);

    // محاولة إضافة جهاز جديد
    const newDevice = new Device({
      name: `بلايستيشن ${newDeviceNumber}`,
      number: newDeviceNumber,
      type: 'playstation',
      status: 'available',
      controllers: 2
    });

    console.log('📝 بيانات الجهاز الجديد:', {
      name: newDevice.name,
      number: newDevice.number,
      type: newDevice.type,
      status: newDevice.status,
      controllers: newDevice.controllers
    });

    await newDevice.save();
    console.log('✅ تم إضافة الجهاز بنجاح!');

    // فحص الأجهزة بعد الإضافة
    const updatedDevices = await Device.find({});
    console.log(`📊 عدد الأجهزة بعد الإضافة: ${updatedDevices.length}`);

  } catch (error) {
    console.error('❌ خطأ في إضافة الجهاز:', error.message);

    if (error.code === 11000) {
      console.error('🔍 هذا خطأ تكرار مفتاح. تحقق من الأجهزة الموجودة:');
      const devices = await Device.find({});
      devices.forEach(device => {
        console.log(`- ${device.name} (رقم: ${device.number})`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

testAddDevice();
