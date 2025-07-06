import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    console.log('🔧 إصلاح الفهارس المكررة...');

    const db = mongoose.connection.db;

    // فحص فهارس مجموعة devices
    const deviceIndexes = await db.collection('devices').indexes();
    console.log('📊 فهارس مجموعة devices:');
    deviceIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // حذف الفهارس المكررة
    const indexesToDrop = [];

    deviceIndexes.forEach(index => {
      if (index.name === 'deviceNumber_1') {
        indexesToDrop.push(index.name);
        console.log(`🗑️ سيتم حذف الفهرس: ${index.name}`);
      }
    });

    // حذف الفهارس
    for (const indexName of indexesToDrop) {
      try {
        await db.collection('devices').dropIndex(indexName);
        console.log(`✅ تم حذف الفهرس: ${indexName}`);
      } catch (error) {
        console.log(`⚠️ فشل في حذف الفهرس ${indexName}:`, error.message);
      }
    }

    // إعادة إنشاء الفهارس الصحيحة
    try {
      await db.collection('devices').createIndex({ number: 1 }, { unique: true });
      console.log('✅ تم إنشاء الفهرس الصحيح: number_1');
    } catch (error) {
      console.log('⚠️ فشل في إنشاء الفهرس number_1:', error.message);
    }

    console.log('✅ تم إصلاح الفهارس');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

fixIndexes();
