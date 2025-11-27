import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function addOrganizationToBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');
    const ordersCollection = db.collection('orders');

    const billIds = [
      '69211b72fca149529c1a7d14', // 248 جنيه
      '692122c3fca149529c1a93df', // 230 جنيه
      '691e9e70ab6c636406038ace', // 550 جنيه
      '6922483a4611677dc2823b34'  // 33 جنيه
    ];

    console.log('🔄 إضافة organization للفواتير...\n');

    // Get organization from an existing order
    const sampleOrder = await ordersCollection.findOne({ organization: { $exists: true } });
    
    if (!sampleOrder || !sampleOrder.organization) {
      console.log('❌ لا يمكن العثور على organization!');
      return;
    }

    const organizationId = sampleOrder.organization;
    console.log(`📊 Organization ID: ${organizationId}\n`);

    for (const billId of billIds) {
      const bill = await billsCollection.findOne({ _id: new mongoose.Types.ObjectId(billId) });
      
      if (!bill) {
        console.log(`❌ الفاتورة ${billId} غير موجودة!\n`);
        continue;
      }

      console.log(`📋 ${bill.billNumber}:`);

      // Get createdBy from one of the orders
      let createdBy = null;
      if (bill.orders && bill.orders.length > 0) {
        const order = await ordersCollection.findOne({ _id: bill.orders[0] });
        if (order && order.createdBy) {
          createdBy = order.createdBy;
        }
      }

      // If no createdBy found, use from sample order
      if (!createdBy && sampleOrder.createdBy) {
        createdBy = sampleOrder.createdBy;
      }

      // Update bill
      const updateData = {
        organization: organizationId,
        updatedAt: new Date()
      };

      if (createdBy) {
        updateData.createdBy = createdBy;
      }

      await billsCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(billId) },
        { $set: updateData }
      );

      console.log(`   ✅ تم إضافة organization${createdBy ? ' و createdBy' : ''}\n`);
    }

    console.log('='  .repeat(80));
    console.log('✅ تم إضافة organization لجميع الفواتير!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

addOrganizationToBills();
