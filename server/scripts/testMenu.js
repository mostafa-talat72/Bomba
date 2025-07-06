import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';

// Load environment variables
dotenv.config();

const testMenuItems = async () => {
  try {
    console.log('🔄 Testing Menu Items...');

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count menu items
    const count = await MenuItem.countDocuments();
    console.log(`📊 Total menu items: ${count}`);

    if (count === 0) {
      console.log('⚠️  No menu items found in database');

      // Create a test menu item
      console.log('🧪 Creating a test menu item...');
      const testItem = new MenuItem({
        name: 'Test Coffee',
        arabicName: 'قهوة تجريبية',
        category: 'مشروبات ساخنة',
        price: 15,
        description: 'قهوة تجريبية للاختبار',
        isAvailable: true,
        createdBy: new mongoose.Types.ObjectId() // Temporary ID
      });

      await testItem.save();
      console.log('✅ Test menu item created');

      // Count again
      const newCount = await MenuItem.countDocuments();
      console.log(`📊 Menu items after test: ${newCount}`);
    } else {
      // Show some menu items
      const items = await MenuItem.find().limit(5);
      console.log('📋 Sample menu items:');
      items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.arabicName}) - ${item.price} ريال - ${item.category}`);
      });
    }

    // Test API endpoint simulation
    console.log('\n🧪 Testing API endpoint simulation...');
    const allItems = await MenuItem.find({ isAvailable: true }).populate('createdBy', 'name');
    console.log(`✅ Found ${allItems.length} available menu items`);

    if (allItems.length > 0) {
      console.log('📋 Available menu items:');
      allItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} - ${item.price} ريال - ${item.category}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing menu items:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Connection closed');
  }
};

testMenuItems();
