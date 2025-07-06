import mongoose from 'mongoose';
import Device from '../models/Device.js';
import '../config/database.js';

const updateDeviceNumbers = async () => {
  try {
    console.log('🔄 بدء تحديث أرقام الأجهزة...\n');

    // Get all devices
    const devices = await Device.find({});
    console.log(`📊 تم العثور على ${devices.length} جهاز\n`);

    let updatedCount = 0;

    for (const device of devices) {
      console.log(`🔍 فحص الجهاز: ${device.name} (النوع: ${device.type})`);

      // Check if number already has prefix
      if (typeof device.number === 'string' && (device.number.startsWith('ps') || device.number.startsWith('pc'))) {
        console.log(`✅ الجهاز ${device.name} لديه بالفعل رقم صحيح: ${device.number}`);
        continue;
      }

      // Generate new number with prefix
      const prefix = device.type === 'playstation' ? 'ps' : 'pc';
      const deviceNumber = `${prefix}${device.number}`;

      console.log(`📝 تحديث ${device.name}: ${device.number} → ${deviceNumber}`);

      // Update device
      await Device.findByIdAndUpdate(device._id, {
        number: deviceNumber
      });

      console.log(`✅ تم تحديث ${device.name}: ${deviceNumber}`);
      updatedCount++;
    }

    console.log(`\n🎉 تم الانتهاء من التحديث!`);
    console.log(`📊 تم تحديث ${updatedCount} جهاز من أصل ${devices.length}`);

    // Show final state
    console.log('\n📋 الحالة النهائية للأجهزة:');
    const finalDevices = await Device.find({}).sort({ type: 1, number: 1 });
    for (const device of finalDevices) {
      console.log(`${device.type}: ${device.name} - رقم: ${device.number}`);
    }

  } catch (error) {
    console.error('❌ خطأ في تحديث أرقام الأجهزة:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
};

updateDeviceNumbers();
