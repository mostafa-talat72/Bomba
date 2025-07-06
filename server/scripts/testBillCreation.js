import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from '../models/Session.js';
import Bill from '../models/Bill.js';
import Device from '../models/Device.js';
import User from '../models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const testBillCreation = async () => {
  try {
    await connectDB();

    // Find an active session
    const session = await Session.findOne({ status: 'active' }).populate('createdBy');

    if (!session) {
      console.log('❌ No active sessions found');
      return;
    }

    console.log('📋 Found session:', {
      id: session._id,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      finalCost: session.finalCost,
      customerName: session.customerName
    });

    // Determine bill type based on device type
    let billType = 'cafe';
    let customerName = session.customerName || 'عميل';

    if (session.deviceType === 'playstation') {
      billType = 'playstation';
      customerName = session.customerName || 'عميل بلايستيشن';
    } else if (session.deviceType === 'computer') {
      billType = 'computer';
      customerName = session.customerName || 'عميل كمبيوتر';
    }

    console.log('💰 Creating bill with:', {
      billType,
      customerName,
      finalCost: session.finalCost,
      discount: session.discount
    });

    // Create bill
    const bill = await Bill.create({
      tableNumber: 0, // Special table number for device sessions
      customerName: customerName,
      sessions: [session._id],
      subtotal: session.finalCost,
      total: session.finalCost,
      discount: session.discount,
      tax: 0,
      notes: `فاتورة جلسة ${session.deviceName} - ${session.deviceType}`,
      billType: billType,
      createdBy: session.createdBy._id
    });

    console.log('✅ Bill created successfully:', {
      id: bill._id,
      billNumber: bill.billNumber,
      total: bill.total,
      status: bill.status,
      billType: bill.billType
    });

    // Calculate bill totals
    await bill.calculateSubtotal();
    await bill.populate(['sessions', 'createdBy'], 'name');

    console.log('✅ Bill after calculation:', {
      subtotal: bill.subtotal,
      total: bill.total,
      remaining: bill.remaining
    });

    // Update session to reference this bill
    session.bill = bill._id;
    await session.save();

    console.log('✅ Session updated with bill reference');

    // Test fetching the bill
    const fetchedBill = await Bill.findById(bill._id).populate(['sessions', 'createdBy']);
    console.log('✅ Fetched bill:', {
      billNumber: fetchedBill.billNumber,
      sessions: fetchedBill.sessions.length,
      total: fetchedBill.total
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

testBillCreation();
