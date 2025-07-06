import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';
import Bill from '../models/Bill.js';
import User from '../models/User.js';

dotenv.config();

const testDatabase = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully');

    // Test MenuItems
    console.log('\n📋 Testing MenuItems...');
    const menuItems = await MenuItem.find({});
    console.log(`📋 Found ${menuItems.length} menu items`);

    if (menuItems.length > 0) {
      console.log('📋 Sample menu items:');
      menuItems.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} - ${item.price} ريال - ${item.category}`);
      });
    } else {
      console.log('⚠️ No menu items found');
    }

    // Test Orders
    console.log('\n📋 Testing Orders...');
    const orders = await Order.find({});
    console.log(`📋 Found ${orders.length} orders`);

    if (orders.length > 0) {
      console.log('📋 Sample orders:');
      orders.slice(0, 3).forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.orderNumber} - ${order.customerName} - ${order.finalAmount} ريال`);
      });
    } else {
      console.log('⚠️ No orders found');
    }

    // Test Bills
    console.log('\n📄 Testing Bills...');
    const bills = await Bill.find({});
    console.log(`📄 Found ${bills.length} bills`);

    if (bills.length > 0) {
      console.log('📄 Sample bills:');
      bills.slice(0, 3).forEach((bill, index) => {
        console.log(`  ${index + 1}. ${bill.billNumber} - ${bill.customerName} - ${bill.total} ريال - ${bill.status}`);
      });
    } else {
      console.log('⚠️ No bills found');
    }

    // Test Users
    console.log('\n👥 Testing Users...');
    const users = await User.find({});
    console.log(`👥 Found ${users.length} users`);

    if (users.length > 0) {
      console.log('👥 Sample users:');
      users.slice(0, 3).forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} - ${user.email} - ${user.role}`);
      });
    } else {
      console.log('⚠️ No users found');
    }

    console.log('\n✅ Database test completed successfully');
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

testDatabase();
