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

async function recreateDeletedBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const deletedBills = [
      {
        _id: '69211b72fca149529c1a7d14',
        billNumber: 'BILL-251122040954024',
        tableId: '691e9b85de2401464b331e8b',
        tableName: 'محمد مصطفى'
      },
      {
        _id: '692122c3fca149529c1a93df',
        billNumber: 'BILL-251122044107501',
        tableId: '6920ef239a81111bbca208fd',
        tableName: 'الخديوى'
      }
    ];

    for (const deletedBill of deletedBills) {
      console.log('='.repeat(80));
      console.log(`🔄 إعادة إنشاء الفاتورة: ${deletedBill.billNumber}`);
      console.log(`   للطاولة: ${deletedBill.tableName}\n`);

      // Get all orders for this bill
      const orders = await Order.find({ bill: new mongoose.Types.ObjectId(deletedBill._id) });
      console.log(`📦 الطلبات المرتبطة: ${orders.length}`);

      if (orders.length === 0) {
        console.log('⚠️ لا توجد طلبات - تخطي\n');
        continue;
      }

      // Calculate total from orders
      let totalAmount = 0;
      const billItems = [];

      for (const order of orders) {
        console.log(`   - Order #${order.orderNumber}: ${order.items?.length || 0} items`);
        
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const itemTotal = (item.price || 0) * (item.quantity || 0);
            totalAmount += itemTotal;

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
      }

      console.log(`\n💰 إجمالي المبلغ: ${totalAmount} EGP`);
      console.log(`📋 إجمالي العناصر: ${billItems.length}`);

      // Recreate the bill
      const newBill = new Bill({
        _id: new mongoose.Types.ObjectId(deletedBill._id),
        billNumber: deletedBill.billNumber,
        table: new mongoose.Types.ObjectId(deletedBill.tableId),
        items: billItems,
        totalAmount: totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: 'draft',
        createdAt: orders[0].createdAt, // Use first order's creation date
        updatedAt: new Date()
      });

      await newBill.save();
      console.log(`✅ تم إعادة إنشاء الفاتورة بنجاح!\n`);

      // Update table status
      await Table.findByIdAndUpdate(deletedBill.tableId, { status: 'occupied' });
      console.log(`✅ تم تحديث حالة الطاولة إلى محجوزة\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ تم إعادة إنشاء جميع الفواتير المحذوفة بنجاح!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

recreateDeletedBills();
