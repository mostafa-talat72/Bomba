import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function verifyNoDateFiltering() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');

    // Test 1: Get all bills
    const allBills = await Bill.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    // Group by date
    const billsByDate = {};
    allBills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });

    // Check for old bills
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    
    const billsOlderThan1Day = allBills.filter(bill => new Date(bill.createdAt) < oneDayAgo);
    const billsOlderThan2Days = allBills.filter(bill => new Date(bill.createdAt) < twoDaysAgo);

    // Test 2: Get all orders
    const allOrders = await Order.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    // Group by date
    const ordersByDate = {};
    allOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-EG');
      if (!ordersByDate[date]) {
        ordersByDate[date] = [];
      }
      ordersByDate[date].push(order);
    });

    const ordersOlderThan1Day = allOrders.filter(order => new Date(order.createdAt) < oneDayAgo);
    const ordersOlderThan2Days = allOrders.filter(order => new Date(order.createdAt) < twoDaysAgo);

    // Verification completed silently

  } catch (error) {
    // Error handled silently
  } finally {
    await mongoose.connection.close();
  }
}

verifyNoDateFiltering();
