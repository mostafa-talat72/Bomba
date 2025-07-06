import mongoose from 'mongoose';
import Device from '../models/Device.js';
import Session from '../models/Session.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixDeviceFields() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🔧 إصلاح تضارب أسماء الحقول...');

    // فحص الأجهزة
    const devices = await Device.find({});
    console.log(`📊 عدد الأجهزة: ${devices.length}`);

    // فحص الجلسات
    const sessions = await Session.find({});
    console.log(`📊 عدد الجلسات: ${sessions.length}`);

    // فحص الجلسات التي لها deviceNumber = null
    const nullSessions = await Session.find({ deviceNumber: null });
    console.log(`⚠️ الجلسات برقم جهاز null: ${nullSessions.length}`);

    if (nullSessions.length > 0) {
      console.log('🔧 حذف الجلسات برقم جهاز null...');
      await Session.deleteMany({ deviceNumber: null });
      console.log('✅ تم حذف الجلسات برقم جهاز null');
    }

    // فحص الأجهزة التي لها number = null
    const nullDevices = await Device.find({ number: null });
    console.log(`⚠️ الأجهزة برقم null: ${nullDevices.length}`);

    if (nullDevices.length > 0) {
      console.log('🔧 حذف الأجهزة برقم null...');
      await Device.deleteMany({ number: null });
      console.log('✅ تم حذف الأجهزة برقم null');
    }

    console.log('✅ تم إصلاح تضارب أسماء الحقول');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

fixDeviceFields();
