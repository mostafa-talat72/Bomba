import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });

const Bill = mongoose.model('Bill', billSchema);
const Order = mongoose.model('Order', orderSchema);
const Table = mongoose.model('Table', tableSchema);

async function recreateBill535() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const billId = '691e9e70ab6c636406038ace';
    const billNumber = 'BILL-251120065200943';

    console.log(`🔄 إعادة إنشاء الفاتورة: ${billNumber}\n`);

    // Get the order
    const orders = await Order.find({ bill: new mongoose.Types.ObjectId(billId) });
    
    if (orders.length === 0) {
      console.log('❌ لا توجد طلبات لهذه الفاتورة!');
      return;
    }

    const order = orders[0];
    console.log(`📦 الطلب: ${order.orderNumber}`);
    console.log(`🏓 الطاولة: ${order.table}`);
    console.log(`📋 العناصر: ${order.items?.length || 0}\n`);

    // Calculate total
    let totalAmount = 0;
    const billItems = [];

    if (order.items && order.items.length > 0) {
      console.log('تفاصيل العناصر:');
      for (const item of order.items) {
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        totalAmount += itemTotal;
        console.log(`  - ${item.name}: ${item.quantity} x ${item.price} = ${itemTotal} EGP`);

        billItems.push({
          type: 'order',
          order: order._id,
          name: item.name,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          total: itemTotal
        });
      }
    }

    console.log(`\n💰 الإجمالي: ${totalAmount} EGP\n`);

    // Get table info
    let tableId = null;
    if (order.table) {
      tableId = order.table._id || order.table.id || order.table;
      const table = await Table.findById(tableId);
      if (table) {
        console.log(`🏓 الطاولة: ${table.number} (${table.name || 'بدون اسم'})\n`);
      }
    }

    // Recreate the bill
    const newBill = new Bill({
      _id: new mongoose.Types.ObjectId(billId),
      billNumber: billNumber,
      table: tableId ? new mongoose.Types.ObjectId(tableId) : null,
      items: billItems,
      totalAmount: totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      status: 'draft',
      createdAt: order.createdAt,
      updatedAt: new Date()
    });

    await newBill.save();
    console.log(`✅ تم إعادة إنشاء الفاتورة بنجاح!`);
    console.log(`   - Bill Number: ${billNumber}`);
    console.log(`   - Total: ${totalAmount} EGP`);
    console.log(`   - Items: ${billItems.length}`);

    // Update table status if exists
    if (tableId) {
      await Table.findByIdAndUpdate(tableId, { status: 'occupied' });
      console.log(`\n✅ تم تحديث حالة الطاولة إلى محجوزة`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

recreateBill535();
