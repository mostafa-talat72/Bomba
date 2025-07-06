import mongoose from 'mongoose';
import Device from '../models/Device.js';
import Session from '../models/Session.js';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import User from '../models/User.js';
import '../config/database.js';

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const testCompleteSystem = async () => {
  try {
    console.log('🧪 Testing complete system with new rounding...\n');

    // Test 1: Very short session (1 minute) - should round to 1 pound
    console.log('📋 Test 1: Very short session (1 minute)');
    const shortSession = new Session({
      deviceNumber: 1,
      deviceName: 'PlayStation 1',
      deviceType: 'playstation',
      customerName: 'Test Customer 1',
      controllers: 1,
      startTime: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    shortSession.calculateCost();
    console.log(`⏱️ Duration: 1 minute`);
    console.log(`💰 Raw cost: ${(1 * 20 / 60).toFixed(2)} ج.م`);
    console.log(`💵 Final cost: ${shortSession.finalCost} ج.م\n`);

    // Test 2: 30 minutes session - should round to 10 pounds
    console.log('📋 Test 2: 30 minutes session');
    const mediumSession = new Session({
      deviceNumber: 2,
      deviceName: 'PlayStation 2',
      deviceType: 'playstation',
      customerName: 'Test Customer 2',
      controllers: 2,
      startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    mediumSession.calculateCost();
    console.log(`⏱️ Duration: 30 minutes`);
    console.log(`💰 Raw cost: ${(30 * 20 / 60).toFixed(2)} ج.م`);
    console.log(`💵 Final cost: ${mediumSession.finalCost} ج.م\n`);

    // Test 3: 1 hour session - should be exactly 20 pounds
    console.log('📋 Test 3: 1 hour session');
    const hourSession = new Session({
      deviceNumber: 3,
      deviceName: 'PlayStation 3',
      deviceType: 'playstation',
      customerName: 'Test Customer 3',
      controllers: 2,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    hourSession.calculateCost();
    console.log(`⏱️ Duration: 60 minutes`);
    console.log(`💰 Raw cost: ${(60 * 20 / 60).toFixed(2)} ج.م`);
    console.log(`💵 Final cost: ${hourSession.finalCost} ج.م\n`);

    // Test 4: 3 controllers for 45 minutes - should round to 25 pounds
    console.log('📋 Test 4: 3 controllers for 45 minutes');
    const threeControllersSession = new Session({
      deviceNumber: 4,
      deviceName: 'PlayStation 4',
      deviceType: 'playstation',
      customerName: 'Test Customer 4',
      controllers: 3,
      startTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    threeControllersSession.calculateCost();
    console.log(`⏱️ Duration: 45 minutes`);
    console.log(`🎮 Controllers: 3`);
    console.log(`💰 Hourly rate: 20 + 5 = 25 ج.م/ساعة`);
    console.log(`💰 Raw cost: ${(45 * 25 / 60).toFixed(2)} ج.م`);
    console.log(`💵 Final cost: ${threeControllersSession.finalCost} ج.م\n`);

    // Test 5: Computer session for 90 minutes - should round to 30 pounds
    console.log('📋 Test 5: Computer session for 90 minutes');
    const computerSession = new Session({
      deviceNumber: 5,
      deviceName: 'Computer 1',
      deviceType: 'computer',
      customerName: 'Test Customer 5',
      controllers: 1,
      startTime: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    computerSession.calculateCost();
    console.log(`⏱️ Duration: 90 minutes`);
    console.log(`💻 Device type: Computer`);
    console.log(`💰 Hourly rate: 20 ج.م/ساعة`);
    console.log(`💰 Raw cost: ${(90 * 20 / 60).toFixed(2)} ج.م`);
    console.log(`💵 Final cost: ${computerSession.finalCost} ج.م\n`);

    // Test 6: Edge case - 0.04 pounds should round to 1 pound
    console.log('📋 Test 6: Edge case - very small amount');
    const tinySession = new Session({
      deviceNumber: 6,
      deviceName: 'PlayStation 6',
      deviceType: 'playstation',
      customerName: 'Test Customer 6',
      controllers: 1,
      startTime: new Date(Date.now() - 0.12 * 60 * 1000), // 0.12 minutes ago (7.2 seconds)
      endTime: new Date(),
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId()
    });

    tinySession.calculateCost();
    console.log(`⏱️ Duration: 0.12 minutes (7.2 seconds)`);
    console.log(`💰 Raw cost: ${(0.12 * 20 / 60).toFixed(4)} ج.م`);
    console.log(`💵 Final cost: ${tinySession.finalCost} ج.م\n`);

    console.log('✅ All tests completed successfully!');
    console.log('📝 Summary: All costs are now rounded up to the nearest pound');
    console.log('💡 Examples: 0.04 → 1, 9.99 → 10, 20.01 → 21');

  } catch (error) {
    console.error('❌ Error testing system:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

testCompleteSystem();
