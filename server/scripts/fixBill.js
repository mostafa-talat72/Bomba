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

const fixBill = async () => {
  try {
    await connectDB();

    // Find the bill
    const bill = await Bill.findOne({ billNumber: 'INV-20250705-001' });

    if (!bill) {
      console.log('❌ Bill not found');
      return;
    }

    console.log('📋 Found bill:', {
      billNumber: bill.billNumber,
      total: bill.total,
      subtotal: bill.subtotal,
      sessions: bill.sessions
    });

    // Get the session
    const session = await Session.findById(bill.sessions[0]);

    if (session) {
      console.log('📋 Session details:', {
        finalCost: session.finalCost,
        totalCost: session.totalCost,
        deviceType: session.deviceType
      });

      // Update bill with correct values
      bill.subtotal = session.finalCost || session.totalCost || 0;
      bill.total = bill.subtotal + (bill.tax || 0) - (bill.discount || 0);

      await bill.save();

      console.log('✅ Bill updated:', {
        billNumber: bill.billNumber,
        total: bill.total,
        subtotal: bill.subtotal
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

fixBill();
