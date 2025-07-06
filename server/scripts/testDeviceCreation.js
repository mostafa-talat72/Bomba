import mongoose from 'mongoose';
import Device from '../models/Device.js';
import '../config/database.js';

const testDeviceCreation = async () => {
  try {
    console.log('🧪 اختبار إضافة أجهزة جديدة...\n');

    // اختبار إضافة جهاز بلايستيشن
    console.log('📋 اختبار إضافة جهاز بلايستيشن');
    const psDevice = new Device({
      name: 'PlayStation Test',
      number: 1,
      type: 'playstation',
      status: 'available',
      controllers: 2
    });

    await psDevice.save();
    console.log(`✅ تم إضافة PlayStation: ${psDevice.deviceNumber}\n`);

    // اختبار إضافة جهاز كمبيوتر
    console.log('📋 اختبار إضافة جهاز كمبيوتر');
    const pcDevice = new Device({
      name: 'Computer Test',
      number: 1,
      type: 'computer',
      status: 'available',
      controllers: 1
    });

    await pcDevice.save();
    console.log(`✅ تم إضافة Computer: ${pcDevice.deviceNumber}\n`);

    // عرض جميع الأجهزة
    console.log('📱 جميع الأجهزة في قاعدة البيانات:');
    const allDevices = await Device.find({}).sort({ type: 1, number: 1 });
    allDevices.forEach(device => {
      console.log(`${device.type}: ${device.name} - رقم: ${device.number} - deviceNumber: ${device.deviceNumber}`);
    });

    console.log('\n✅ تم اختبار إضافة الأجهزة بنجاح!');

  } catch (error) {
    console.error('❌ خطأ في اختبار إضافة الأجهزة:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
};

testDeviceCreation();
