import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Bill from '../models/Bill.js';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const testSessionEnd = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check current sessions and bills
    console.log('\n=== الجلسات الحالية ===');
    const sessions = await Session.find({});
    console.log(`عدد الجلسات: ${sessions.length}`);
    sessions.forEach(session => {
      console.log(`- ${session.deviceName} (${session.status}) - التكلفة: ${session.finalCost} ج.م`);
    });

    console.log('\n=== الفواتير الحالية ===');
    const bills = await Bill.find({});
    console.log(`عدد الفواتير: ${bills.length}`);
    bills.forEach(bill => {
      console.log(`- ${bill.billNumber} - المبلغ: ${bill.total} ج.م - الحالة: ${bill.status}`);
    });

    console.log('\n=== الأجهزة ===');
    const devices = await Device.find({});
    console.log(`عدد الأجهزة: ${devices.length}`);
    devices.forEach(device => {
      console.log(`- ${device.name} - الحالة: ${device.status}`);
    });

    // Check if there are any active sessions
    const activeSessions = await Session.find({ status: 'active' });
    if (activeSessions.length === 0) {
      console.log('\n❌ لا توجد جلسات نشطة لاختبار إنهائها');
      return;
    }

    console.log(`\n✅ تم العثور على ${activeSessions.length} جلسة نشطة`);
    console.log('يمكنك الآن إنهاء جلسة من الواجهة الأمامية لاختبار إنشاء الفاتورة التلقائي');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

testSessionEnd();
