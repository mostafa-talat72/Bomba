import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const checkSessions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check all sessions
    const allSessions = await Session.find({});
    console.log('\n=== جميع الجلسات ===');
    console.log(`عدد الجلسات: ${allSessions.length}`);
    allSessions.forEach(session => {
      console.log(`- ID: ${session._id}`);
      console.log(`  الجهاز: ${session.deviceName} (رقم: ${session.deviceNumber})`);
      console.log(`  النوع: ${session.deviceType}`);
      console.log(`  الحالة: ${session.status}`);
      console.log(`  وقت البداية: ${session.startTime}`);
      console.log(`  وقت النهاية: ${session.endTime || 'لم تنتهي'}`);
      console.log('---');
    });

    // Check active sessions
    const activeSessions = await Session.find({ status: 'active' });
    console.log('\n=== الجلسات النشطة ===');
    console.log(`عدد الجلسات النشطة: ${activeSessions.length}`);
    activeSessions.forEach(session => {
      console.log(`- الجهاز: ${session.deviceName} (رقم: ${session.deviceNumber})`);
      console.log(`  النوع: ${session.deviceType}`);
      console.log(`  وقت البداية: ${session.startTime}`);
      console.log('---');
    });

    // Check devices
    const devices = await Device.find({});
    console.log('\n=== الأجهزة ===');
    console.log(`عدد الأجهزة: ${devices.length}`);
    devices.forEach(device => {
      console.log(`- الاسم: ${device.name}`);
      console.log(`  الرقم: ${device.number}`);
      console.log(`  النوع: ${device.type}`);
      console.log(`  الحالة: ${device.status}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

checkSessions();
