import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function fixInvalidBillEnums() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));

    // Find bills with invalid billType
    console.log('🔍 Searching for bills with invalid billType...\n');
    const invalidBillType = await Bill.find({
      billType: { $nin: ['cafe', 'playstation', 'computer', null, undefined] }
    }).lean();

    console.log(`Found ${invalidBillType.length} bills with invalid billType\n`);

    if (invalidBillType.length > 0) {
      console.log('Fixing billType...');
      for (const bill of invalidBillType) {
        let newBillType = 'cafe'; // default

        // Determine correct billType based on sessions
        if (bill.sessions && bill.sessions.length > 0) {
          // Check if it's a playstation or computer bill
          const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false, collection: 'sessions' }));
          const sessions = await Session.find({ _id: { $in: bill.sessions } }).lean();
          
          const hasPlaystation = sessions.some(s => s.deviceType === 'playstation');
          const hasComputer = sessions.some(s => s.deviceType === 'computer');
          
          if (hasPlaystation) {
            newBillType = 'playstation';
          } else if (hasComputer) {
            newBillType = 'computer';
          }
        }

        // If it has orders, it's a cafe bill
        if (bill.orders && bill.orders.length > 0 && !bill.sessions?.length) {
          newBillType = 'cafe';
        }

        console.log(`  Bill #${bill.billNumber}: ${bill.billType} → ${newBillType}`);

        await Bill.updateOne(
          { _id: bill._id },
          { $set: { billType: newBillType } }
        );
      }
      console.log('✅ Fixed billType\n');
    }

    // Find bills with invalid paymentMethod
    console.log('🔍 Searching for bills with invalid paymentMethod...\n');
    const invalidPaymentMethod = await Bill.find({
      paymentMethod: { $nin: ['cash', 'card', 'transfer', 'mixed', null, undefined] }
    }).lean();

    console.log(`Found ${invalidPaymentMethod.length} bills with invalid paymentMethod\n`);

    if (invalidPaymentMethod.length > 0) {
      console.log('Fixing paymentMethod...');
      for (const bill of invalidPaymentMethod) {
        let newPaymentMethod = 'cash'; // default

        // If bill has payments, determine payment method
        if (bill.payments && bill.payments.length > 0) {
          const methods = [...new Set(bill.payments.map(p => p.method))];
          if (methods.length > 1) {
            newPaymentMethod = 'mixed';
          } else {
            newPaymentMethod = methods[0] || 'cash';
          }
        }

        console.log(`  Bill #${bill.billNumber}: "${bill.paymentMethod}" → ${newPaymentMethod}`);

        await Bill.updateOne(
          { _id: bill._id },
          { $set: { paymentMethod: newPaymentMethod } }
        );
      }
      console.log('✅ Fixed paymentMethod\n');
    }

    // Find bills with empty string paymentMethod
    console.log('🔍 Searching for bills with empty paymentMethod...\n');
    const emptyPaymentMethod = await Bill.find({
      paymentMethod: ''
    }).lean();

    console.log(`Found ${emptyPaymentMethod.length} bills with empty paymentMethod\n`);

    if (emptyPaymentMethod.length > 0) {
      console.log('Fixing empty paymentMethod...');
      await Bill.updateMany(
        { paymentMethod: '' },
        { $set: { paymentMethod: 'cash' } }
      );
      console.log('✅ Fixed empty paymentMethod\n');
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`✅ Fixed ${invalidBillType.length} bills with invalid billType`);
    console.log(`✅ Fixed ${invalidPaymentMethod.length + emptyPaymentMethod.length} bills with invalid paymentMethod`);
    console.log('\n✅ All bills should now be valid!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

fixInvalidBillEnums();
