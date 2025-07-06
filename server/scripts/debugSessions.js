import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const debugSessions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all sessions with raw data
    const sessions = await Session.find({}).lean();
    console.log('\n=== تفاصيل الجلسات ===');
    console.log(`عدد الجلسات: ${sessions.length}`);

    sessions.forEach((session, index) => {
      console.log(`\n--- الجلسة ${index + 1} ---`);
      console.log(`ID: ${session._id}`);
      console.log(`deviceNumber: ${session.deviceNumber}`);
      console.log(`deviceName: ${session.deviceName}`);
      console.log(`deviceType: ${session.deviceType} (type: ${typeof session.deviceType})`);
      console.log(`status: ${session.status}`);
      console.log(`controllers: ${session.controllers}`);
      console.log(`totalCost: ${session.totalCost}`);
      console.log(`finalCost: ${session.finalCost}`);
      console.log(`startTime: ${session.startTime}`);
      console.log(`endTime: ${session.endTime || 'لم تنتهي'}`);
    });

    // Check active sessions specifically
    const activeSessions = await Session.find({ status: 'active' }).lean();
    console.log('\n=== الجلسات النشطة ===');
    console.log(`عدد الجلسات النشطة: ${activeSessions.length}`);

    activeSessions.forEach((session, index) => {
      console.log(`\n--- الجلسة النشطة ${index + 1} ---`);
      console.log(`deviceNumber: ${session.deviceNumber}`);
      console.log(`deviceName: ${session.deviceName}`);
      console.log(`deviceType: ${session.deviceType}`);
      console.log(`status: ${session.status}`);
    });

    // Check devices
    const devices = await Device.find({}).lean();
    console.log('\n=== الأجهزة ===');
    console.log(`عدد الأجهزة: ${devices.length}`);

    devices.forEach((device, index) => {
      console.log(`\n--- الجهاز ${index + 1} ---`);
      console.log(`number: ${device.number}`);
      console.log(`name: ${device.name}`);
      console.log(`type: ${device.type}`);
      console.log(`status: ${device.status}`);
    });

    // Test the filtering logic
    console.log('\n=== اختبار منطق الفلترة ===');
    const playstationSessions = activeSessions.filter(s =>
      s.deviceType === 'playstation' &&
      s.status === 'active'
    );
    console.log(`الجلسات النشطة للبلايستيشن: ${playstationSessions.length}`);

    const matchingSessions = activeSessions.filter(s =>
      s.deviceNumber === 1 &&
      s.status === 'active'
    );
    console.log(`الجلسات النشطة للجهاز رقم 1: ${matchingSessions.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

debugSessions();
