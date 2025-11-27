import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function simpleCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));
    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');
    
    // Get first 50 bills
    const bills = await Bill.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('billNumber createdAt')
      .lean();
    
    console.log(`\nFirst 50 bills:`);
    console.log(`Total: ${bills.length}`);
    console.log(`Oldest: ${bills[bills.length - 1].billNumber} - ${new Date(bills[bills.length - 1].createdAt).toLocaleDateString('ar-EG')}`);
    console.log(`Newest: ${bills[0].billNumber} - ${new Date(bills[0].createdAt).toLocaleDateString('ar-EG')}`);
    
    // Check if 50th bill is from 22/11
    const bill50 = bills[bills.length - 1];
    const bill50Date = new Date(bill50.createdAt);
    
    console.log(`\n50th bill full date: ${bill50Date.toLocaleString('ar-EG')}`);
    
    // Count bills older than 22/11
    const startOf22 = new Date('2025-11-22T00:00:00');
    const olderThan22 = await Bill.countDocuments({
      organization: orgId,
      createdAt: { $lt: startOf22 }
    });
    
    console.log(`\nBills older than 22/11: ${olderThan22}`);
    
    if (olderThan22 > 0) {
      console.log('\n❌ PROBLEM: There ARE bills older than 22/11 but they are not in the first 50!');
      console.log('   This means the sort is wrong or there is a filter somewhere');
    } else {
      console.log('\n✅ No bills older than 22/11 in database');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

simpleCheck();
