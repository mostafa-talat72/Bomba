import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';

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

const checkBills = async () => {
  try {
    await connectDB();

    const bills = await Bill.find();
    console.log('📊 Total bills in database:', bills.length);

    if (bills.length > 0) {
      console.log('\n📋 Bills details:');
      bills.forEach((bill, index) => {
        console.log(`${index + 1}. ${bill.billNumber} - Total: ${bill.total} ج.م - Type: ${bill.billType} - Status: ${bill.status}`);
      });
    } else {
      console.log('❌ No bills found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

checkBills();
