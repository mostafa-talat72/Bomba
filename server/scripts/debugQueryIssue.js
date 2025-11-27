import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function debugQueryIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));
    
    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');
    
    // Test 1: Simple query
    console.log('=== TEST 1: Simple Query ===\n');
    const query1 = { organization: orgId };
    const bills1 = await Bill.find(query1).sort({ createdAt: -1 }).limit(50).lean();
    
    console.log(`Found: ${bills1.length} bills`);
    if (bills1.length > 0) {
      console.log(`Oldest: ${bills1[bills1.length - 1].billNumber} - ${new Date(bills1[bills1.length - 1].createdAt).toLocaleDateString('ar-EG')}`);
      console.log(`Newest: ${bills1[0].billNumber} - ${new Date(bills1[0].createdAt).toLocaleDateString('ar-EG')}`);
    }
    
    // Test 2: Count all bills
    console.log('\n=== TEST 2: Count All Bills ===\n');
    const totalCount = await Bill.countDocuments({ organization: orgId });
    console.log(`Total bills in database: ${totalCount}`);
    
    // Test 3: Get all bills (no limit)
    console.log('\n=== TEST 3: Get ALL Bills (no limit) ===\n');
    const allBills = await Bill.find({ organization: orgId }).sort({ createdAt: -1 }).lean();
    
    console.log(`Found: ${allBills.length} bills`);
    
    // Group by date
    const billsByDate = {};
    allBills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });
    
    console.log('\nBills by date:');
    Object.keys(billsByDate).sort().forEach(date => {
      console.log(`  📅 ${date}: ${billsByDate[date].length} فاتورة`);
    });
    
    if (allBills.length > 0) {
      console.log(`\nOldest: ${allBills[allBills.length - 1].billNumber} - ${new Date(allBills[allBills.length - 1].createdAt).toLocaleString('ar-EG')}`);
      console.log(`Newest: ${allBills[0].billNumber} - ${new Date(allBills[0].createdAt).toLocaleString('ar-EG')}`);
    }
    
    // Test 4: Check if there's an index causing issues
    console.log('\n=== TEST 4: Check Indexes ===\n');
    const indexes = await Bill.collection.getIndexes();
    console.log('Indexes:', JSON.stringify(indexes, null, 2));
    
    // Test 5: Compare first 50 with limit
    console.log('\n=== TEST 5: Compare Queries ===\n');
    
    const withLimit = await Bill.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('billNumber createdAt')
      .lean();
    
    console.log(`With limit(50): ${withLimit.length} bills`);
    console.log(`First: ${withLimit[0].billNumber} - ${new Date(withLimit[0].createdAt).toLocaleDateString('ar-EG')}`);
    console.log(`Last: ${withLimit[withLimit.length - 1].billNumber} - ${new Date(withLimit[withLimit.length - 1].createdAt).toLocaleDateString('ar-EG')}`);
    
    // Check if the 50th bill is from 22/11
    const bill50Date = new Date(withLimit[withLimit.length - 1].createdAt);
    const today = new Date();
    const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
    
    console.log(`\n50th bill date: ${bill50Date.toLocaleString('ar-EG')}`);
    console.log(`Is it older than 24 hours? ${bill50Date < yesterday ? 'YES' : 'NO'}`);
    
    // Test 6: Check if there are bills older than the 50th
    const olderThan50th = await Bill.countDocuments({
      organization: orgId,
      createdAt: { $lt: bill50Date }
    });
    
    console.log(`\nBills older than the 50th: ${olderThan50th}`);
    
    console.log('\n=== CONCLUSION ===\n');
    
    if (bill50Date < yesterday) {
      console.log('✅ The 50th bill IS older than 24 hours');
      console.log('✅ Backend is returning old bills correctly');
      console.log('❌ Problem is in the FRONTEND!');
    } else {
      console.log('❌ The 50th bill is NOT older than 24 hours');
      console.log('   This means there are not enough old bills in the first 50');
      console.log('   OR the data is mostly recent');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

debugQueryIssue();
