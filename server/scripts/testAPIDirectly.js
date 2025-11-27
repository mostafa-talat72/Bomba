import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function testAPIDirectly() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Simulate what the API does
    console.log('=== SIMULATING API CALL ===\n');
    
    const query = {
      organization: new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f') // Your organization ID
    };

    const bills = await Bill.find(query)
      .select('billNumber customerName status total createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    console.log(`✅ Found ${bills.length} bills\n`);

    // Group by date
    const billsByDate = {};
    bills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });

    console.log('=== BILLS BY DATE ===\n');
    Object.keys(billsByDate).forEach(date => {
      console.log(`📅 ${date}: ${billsByDate[date].length} فاتورة`);
    });

    // Check for bills older than 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const oldBills = bills.filter(bill => new Date(bill.createdAt) < twentyFourHoursAgo);
    const recentBills = bills.filter(bill => new Date(bill.createdAt) >= twentyFourHoursAgo);

    console.log(`\n=== AGE ANALYSIS ===`);
    console.log(`📊 Total bills: ${bills.length}`);
    console.log(`🕐 Bills older than 24 hours: ${oldBills.length}`);
    console.log(`🆕 Bills within 24 hours: ${recentBills.length}`);

    if (oldBills.length > 0) {
      console.log(`\n✅ OLD BILLS ARE BEING RETURNED BY API!`);
      console.log(`\nSample old bills:`);
      oldBills.slice(0, 5).forEach(bill => {
        const age = Math.floor((now - new Date(bill.createdAt)) / (1000 * 60 * 60));
        console.log(`  - ${bill.billNumber}: ${age} hours old`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

testAPIDirectly();
