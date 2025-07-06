import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const fixSessionData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find sessions with undefined deviceType
    const sessionsToFix = await Session.find({ deviceType: undefined });
    console.log(`\n=== الجلسات التي تحتاج إصلاح ===`);
    console.log(`عدد الجلسات: ${sessionsToFix.length}`);

    if (sessionsToFix.length === 0) {
      console.log('لا توجد جلسات تحتاج إصلاح');
      return;
    }

    // Fix each session
    for (const session of sessionsToFix) {
      console.log(`\nإصلاح الجلسة: ${session.deviceName} (رقم: ${session.deviceNumber})`);

      // Determine device type based on device name or number
      let deviceType = 'playstation'; // default

      if (session.deviceName && session.deviceName.includes('كمبيوتر')) {
        deviceType = 'computer';
      } else if (session.deviceName && session.deviceName.includes('بلايستيشن')) {
        deviceType = 'playstation';
      }

      // Update the session
      await Session.findByIdAndUpdate(session._id, {
        deviceType: deviceType
      });

      console.log(`✅ تم تحديث نوع الجهاز إلى: ${deviceType}`);
    }

    // Verify the fix
    console.log('\n=== التحقق من الإصلاح ===');
    const allSessions = await Session.find({});
    allSessions.forEach(session => {
      console.log(`- ${session.deviceName} (رقم: ${session.deviceNumber}) - النوع: ${session.deviceType} - الحالة: ${session.status}`);
    });

    console.log('\n✅ تم إصلاح جميع الجلسات بنجاح');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

fixSessionData();
