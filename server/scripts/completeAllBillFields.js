import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function completeAllBillFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billIds = [
      '69211b72fca149529c1a7d14', // 248 جنيه
      '692122c3fca149529c1a93df', // 230 جنيه
      '691e9e70ab6c636406038ace', // 550 جنيه
      '6922483a4611677dc2823b34'  // 33 جنيه
    ];

    console.log('🔄 إضافة جميع الحقول المفقودة للفواتير...\n');

    for (const billId of billIds) {
      const bill = await billsCollection.findOne({ _id: new mongoose.Types.ObjectId(billId) });
      
      if (!bill) {
        console.log(`❌ الفاتورة ${billId} غير موجودة!\n`);
        continue;
      }

      console.log(`📋 ${bill.billNumber}:`);

      const updateData = {};

      // Add missing fields with default values
      if (!bill.customerName) updateData.customerName = '';
      if (!bill.customerPhone) updateData.customerPhone = '';
      if (!bill.subtotal) updateData.subtotal = bill.totalAmount || 0;
      if (!bill.discount) updateData.discount = 0;
      if (!bill.discountPercent) updateData.discountPercent = 0;
      if (!bill.tax) updateData.tax = 0;
      if (!bill.total) updateData.total = bill.totalAmount || 0;
      if (!bill.paid) updateData.paid = bill.paidAmount || 0;
      if (!bill.remaining) updateData.remaining = bill.remainingAmount || bill.totalAmount || 0;
      if (!bill.paymentMethod) updateData.paymentMethod = '';
      if (!bill.notes) updateData.notes = '';
      if (!bill.dueDate) updateData.dueDate = null;
      if (!bill.updatedBy) updateData.updatedBy = bill.createdBy || null;
      if (!bill.payments) updateData.payments = [];
      if (!bill.partialPayments) updateData.partialPayments = [];
      if (bill.__v === undefined) updateData.__v = 0;

      // Update the bill
      if (Object.keys(updateData).length > 0) {
        await billsCollection.updateOne(
          { _id: new mongoose.Types.ObjectId(billId) },
          { $set: updateData }
        );
        console.log(`   ✅ تم إضافة ${Object.keys(updateData).length} حقل\n`);
      } else {
        console.log(`   ✓ جميع الحقول موجودة\n`);
      }
    }

    console.log('='  .repeat(80));
    console.log('✅ تم إضافة جميع الحقول المفقودة!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

completeAllBillFields();
