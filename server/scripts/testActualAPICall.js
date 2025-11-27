import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Import controllers
import { getBills } from '../controllers/billingController.js';
import { getOrders } from '../controllers/orderController.js';

async function testActualAPICall() {
  try {
    console.log('=== TESTING ACTUAL API CALLS ===\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');
    
    // Mock request and response objects
    const mockReq = {
      user: {
        organization: orgId,
        _id: new mongoose.Types.ObjectId()
      },
      query: {}
    };
    
    const mockRes = {
      json: function(data) {
        console.log('=== BILLS API RESPONSE ===\n');
        console.log(`Success: ${data.success}`);
        console.log(`Count: ${data.count}`);
        console.log(`Total: ${data.total}`);
        
        if (data.data && data.data.length > 0) {
          // Group by date
          const billsByDate = {};
          data.data.forEach(bill => {
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
          
          // Check for old bills
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          const oldBills = data.data.filter(bill => new Date(bill.createdAt) < oneDayAgo);
          
          console.log(`\n🕐 Bills older than 1 day: ${oldBills.length}`);
          
          if (oldBills.length > 0) {
            console.log('\n✅ OLD BILLS ARE RETURNED BY API!');
            console.log('\nSample old bills:');
            oldBills.slice(0, 3).forEach(bill => {
              console.log(`  - Bill #${bill.billNumber}: ${new Date(bill.createdAt).toLocaleString('ar-EG')}`);
            });
          } else {
            console.log('\n❌ NO OLD BILLS RETURNED BY API!');
          }
        }
        
        return this;
      },
      status: function(code) {
        console.log(`Status Code: ${code}`);
        return this;
      }
    };
    
    // Test getBills
    console.log('📊 Testing getBills controller...\n');
    await getBills(mockReq, mockRes);
    
    // Test getOrders
    console.log('\n\n📊 Testing getOrders controller...\n');
    
    const mockReq2 = {
      user: {
        organization: orgId,
        _id: new mongoose.Types.ObjectId()
      },
      query: {}
    };
    
    const mockRes2 = {
      json: function(data) {
        console.log('=== ORDERS API RESPONSE ===\n');
        console.log(`Success: ${data.success}`);
        console.log(`Count: ${data.count}`);
        console.log(`Total: ${data.total}`);
        
        if (data.data && data.data.length > 0) {
          // Group by date
          const ordersByDate = {};
          data.data.forEach(order => {
            const date = new Date(order.createdAt).toLocaleDateString('ar-EG');
            if (!ordersByDate[date]) {
              ordersByDate[date] = [];
            }
            ordersByDate[date].push(order);
          });
          
          console.log('\nOrders by date:');
          Object.keys(ordersByDate).sort().forEach(date => {
            console.log(`  📅 ${date}: ${ordersByDate[date].length} طلب`);
          });
          
          // Check for old orders
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          const oldOrders = data.data.filter(order => new Date(order.createdAt) < oneDayAgo);
          
          console.log(`\n🕐 Orders older than 1 day: ${oldOrders.length}`);
          
          if (oldOrders.length > 0) {
            console.log('\n✅ OLD ORDERS ARE RETURNED BY API!');
          } else {
            console.log('\n❌ NO OLD ORDERS RETURNED BY API!');
          }
        }
        
        return this;
      },
      status: function(code) {
        console.log(`Status Code: ${code}`);
        return this;
      }
    };
    
    await getOrders(mockReq2, mockRes2);
    
    console.log('\n\n=== CONCLUSION ===\n');
    console.log('If old bills/orders are returned above, then:');
    console.log('✅ Backend is working correctly');
    console.log('❌ Problem is in Frontend or Browser Cache\n');
    console.log('Next steps:');
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Go to Network tab');
    console.log('3. Reload page');
    console.log('4. Check /api/billing response');
    console.log('5. Compare with the numbers above');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

testActualAPICall();
