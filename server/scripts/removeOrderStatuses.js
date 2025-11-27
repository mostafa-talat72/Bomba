import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Order from '../models/Order.js';

async function removeOrderStatuses() {
  try {
    console.log('🔧 إزالة حالات pending و delivered من الطلبات...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Find orders with pending or delivered status
    const ordersToUpdate = await Order.find({
      status: { $in: ['pending', 'delivered'] }
    }).lean();

    console.log(`📦 عدد الطلبات التي تحتاج إلى تحديث: ${ordersToUpdate.length}\n`);

    if (ordersToUpdate.length === 0) {
      console.log('✅ لا توجد طلبات تحتاج إلى تحديث');
      return;
    }

    console.log('الطلبات التي سيتم تحديثها:');
    ordersToUpdate.forEach(order => {
      console.log(`  - ${order.orderNumber}: ${order.status} → preparing`);
    });

    console.log('\n⏳ جاري التحديث...');

    // Update all orders to 'preparing' status
    const result = await Order.updateMany(
      { status: { $in: ['pending', 'delivered'] } },
      { $set: { status: 'preparing' } }
    );

    console.log(`\n✅ تم تحديث ${result.modifiedCount} طلب بنجاح!`);
    console.log(`   - جميع الطلبات الآن في حالة "preparing"`);

    console.log('\n📊 ملخص:');
    console.log(`   - الطلبات المحدثة: ${result.modifiedCount}`);
    console.log(`   - الحالة الجديدة: preparing`);

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

removeOrderStatuses();
