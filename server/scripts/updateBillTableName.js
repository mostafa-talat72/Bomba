import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Session from '../models/Session.js';

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

const updateBillTableName = async () => {
  try {
    await connectDB();

    // Find the existing bill
    const bill = await Bill.findOne({ billNumber: 'INV-20250705-001' });

    if (!bill) {
      console.log('❌ Bill not found');
      return;
    }

    console.log('📋 Found bill:', {
      billNumber: bill.billNumber,
      tableNumber: bill.tableNumber,
      sessions: bill.sessions
    });

    // Get the session
    const session = await Session.findById(bill.sessions[0]);

    if (session) {
      console.log('📋 Session details:', {
        deviceName: session.deviceName,
        deviceNumber: session.deviceNumber,
        deviceType: session.deviceType
      });

      // Update bill with device name
      bill.tableNumber = session.deviceName;

      await bill.save();

      console.log('✅ Bill updated:', {
        billNumber: bill.billNumber,
        tableNumber: bill.tableNumber
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

updateBillTableName();
