import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function checkBill550() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const billId = '691e9e70ab6c636406038ace';
    
    const bill = await Bill.findById(billId);
    
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    console.log('📋 الفاتورة: ' + bill.billNumber);
    console.log('   Total Amount: ' + bill.totalAmount);
    console.log('   Items: ' + (bill.items?.length || 0));
    console.log('\nالعناصر:');
    
    let calculatedTotal = 0;
    bill.items?.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}: ${item.quantity} x ${item.price} = ${item.total} جنيه (type: ${item.type})`);
      calculatedTotal += item.total || 0;
    });
    
    console.log(`\nالإجمالي المحسوب: ${calculatedTotal} جنيه`);
    console.log(`الإجمالي المخزن: ${bill.totalAmount} جنيه`);
    
    if (calculatedTotal !== bill.totalAmount) {
      console.log('\n⚠️ هناك فرق! يجب تحديث الإجمالي');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkBill550();
