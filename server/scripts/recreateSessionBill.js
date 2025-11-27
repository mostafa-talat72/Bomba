import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });
const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);
const Table = mongoose.model('Table', tableSchema);

async function recreateSessionBill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const sessionId = '6922483a4611677dc2823b33';
    const billId = '6922483a4611677dc2823b34';
    const billNumber = 'BILL-251123013314241';

    console.log('🔍 فحص الجلسة...\n');

    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة!');
      return;
    }

    console.log('🎮 معلومات الجلسة:');
    console.log(`   ID: ${session._id}`);
    console.log(`   Device: ${session.deviceName || session.deviceNumber}`);
    console.log(`   Device Type: ${session.deviceType}`);
    console.log(`   Table: ${session.table || 'لا توجد'}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Controllers: ${session.controllers}`);
    console.log(`   Total Cost: ${session.totalCost} جنيه`);
    console.log(`   Final Cost: ${session.finalCost} جنيه`);
    console.log(`   Discount: ${session.discount} جنيه`);
    console.log(`   Created: ${session.createdAt}\n`);

    // Calculate duration if available
    if (session.startTime && session.endTime) {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);
      const durationMs = end - start;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      console.log(`   Duration: ${durationMinutes} دقيقة\n`);
    }

    const sessionCost = session.finalCost || session.totalCost || 0;

    if (sessionCost === 0) {
      console.log('⚠️ الجلسة ليس لها تكلفة! لا يمكن إنشاء فاتورة.');
      return;
    }

    // Create bill item
    const billItem = {
      type: 'session',
      session: session._id,
      name: `جلسة ${session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'} - ${session.deviceName || session.deviceNumber}`,
      productName: `جلسة ${session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}`,
      quantity: 1,
      price: sessionCost,
      total: sessionCost
    };

    console.log('📋 إنشاء الفاتورة...\n');

    // Create bill
    const newBill = new Bill({
      _id: new mongoose.Types.ObjectId(billId),
      billNumber: billNumber,
      table: session.table ? new mongoose.Types.ObjectId(session.table) : null,
      items: [billItem],
      totalAmount: sessionCost,
      paidAmount: 0,
      remainingAmount: sessionCost,
      status: 'draft',
      createdAt: session.createdAt,
      updatedAt: new Date()
    });

    await newBill.save();

    console.log('✅ تم إنشاء الفاتورة بنجاح!');
    console.log(`   - Bill Number: ${billNumber}`);
    console.log(`   - Total: ${sessionCost} جنيه`);
    console.log(`   - Items: 1 (جلسة)\n`);

    // Update table status if exists
    if (session.table) {
      const table = await Table.findById(session.table);
      if (table) {
        console.log(`🏓 الطاولة: ${table.number} (${table.name || 'بدون اسم'})`);
        table.status = 'occupied';
        await table.save();
        console.log('✅ تم تحديث حالة الطاولة إلى محجوزة\n');
      }
    } else {
      console.log('⚠️ الجلسة ليست مربوطة بطاولة\n');
    }

    console.log('✅ اكتمل إنشاء الفاتورة!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

recreateSessionBill();
