import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function debugFrontendIssue() {
  try {
    console.log('=== DEBUGGING FRONTEND ISSUE ===\n');

    // Step 1: Check database directly
    console.log('📊 Step 1: Checking database directly...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false, collection: 'orders' }));
    
    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');
    
    const allBills = await Bill.find({ organization: orgId }).sort({ createdAt: -1 }).lean();
    const allOrders = await Order.find({ organization: orgId }).sort({ createdAt: -1 }).lean();
    
    console.log(`✅ Database has ${allBills.length} bills`);
    console.log(`✅ Database has ${allOrders.length} orders\n`);
    
    // Check age
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const oldBills = allBills.filter(b => new Date(b.createdAt) < oneDayAgo);
    const oldOrders = allOrders.filter(o => new Date(o.createdAt) < oneDayAgo);
    
    console.log(`🕐 Bills older than 1 day: ${oldBills.length}`);
    console.log(`🕐 Orders older than 1 day: ${oldOrders.length}\n`);
    
    await mongoose.connection.close();
    
    // Summary
    console.log('\n=== SUMMARY ===\n');
    
    if (oldBills.length > 0) {
      console.log('✅ Old bills exist in database');
    } else {
      console.log('❌ No old bills in database');
    }
    
    console.log('\n📌 NEXT STEPS:\n');
    console.log('1. Make sure backend is running: npm run server:dev');
    console.log('2. Make sure frontend is running: npm run client:dev');
    console.log('3. Open browser DevTools (F12)');
    console.log('4. Go to Network tab');
    console.log('5. Reload the page');
    console.log('6. Look for /api/billing request');
    console.log('7. Check the response - how many bills does it return?');
    console.log('8. If it returns old bills but they don\'t show:');
    console.log('   - Check Console tab for JavaScript errors');
    console.log('   - Clear cache: Ctrl+Shift+Delete');
    console.log('   - Try Incognito mode: Ctrl+Shift+N');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugFrontendIssue();
