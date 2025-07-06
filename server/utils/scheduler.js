import cron from 'node-cron';
import Logger from '../middleware/logger.js';
import { createDatabaseBackup } from './backup.js';
import { sendDailyReport, sendLowStockAlert } from './email.js';
import InventoryItem from '../models/InventoryItem.js';
import User from '../models/User.js';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Session from '../models/Session.js';
import Cost from '../models/Cost.js';

// Check for low stock items and send alerts
const checkLowStock = async () => {
  try {
    const lowStockItems = await InventoryItem.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStock'] }
    });
    
    if (lowStockItems.length > 0) {
      // Get admin emails
      const admins = await User.find({ 
        role: 'admin', 
        status: 'active',
        email: { $exists: true, $ne: '' }
      }).select('email');
      
      const adminEmails = admins.map(admin => admin.email);
      
      if (adminEmails.length > 0) {
        await sendLowStockAlert(lowStockItems, adminEmails);
        Logger.info('Low stock alert sent', { 
          itemCount: lowStockItems.length,
          adminCount: adminEmails.length 
        });
      }
    }
  } catch (error) {
    Logger.error('Failed to check low stock', { error: error.message });
  }
};

// Generate and send daily report
const generateDailyReport = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Get daily statistics
    const [bills, orders, sessions, costs] = await Promise.all([
      Bill.find({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
        status: { $in: ['partial', 'paid'] }
      }),
      Order.find({
        createdAt: { $gte: startOfDay, $lt: endOfDay }
      }),
      Session.find({
        startTime: { $gte: startOfDay, $lt: endOfDay }
      }),
      Cost.find({
        date: { $gte: startOfDay, $lt: endOfDay }
      })
    ]);
    
    // Calculate totals
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.paid, 0);
    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    
    // Get top products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lt: endOfDay },
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 }
    ]);
    
    const reportData = {
      date: today.toLocaleDateString('ar-EG'),
      totalRevenue,
      totalCosts,
      netProfit: totalRevenue - totalCosts,
      totalBills: bills.length,
      totalOrders: orders.length,
      totalSessions: sessions.length,
      topProducts: topProducts.map(p => ({ name: p._id, quantity: p.quantity }))
    };
    
    // Get admin emails
    const admins = await User.find({ 
      role: 'admin', 
      status: 'active',
      email: { $exists: true, $ne: '' }
    }).select('email');
    
    const adminEmails = admins.map(admin => admin.email);
    
    if (adminEmails.length > 0) {
      await sendDailyReport(reportData, adminEmails);
      Logger.info('Daily report sent', { adminCount: adminEmails.length });
    }
    
    Logger.info('Daily report generated', reportData);
  } catch (error) {
    Logger.error('Failed to generate daily report', { error: error.message });
  }
};

// Update overdue bills and costs
const updateOverdueItems = async () => {
  try {
    const now = new Date();
    
    // Update overdue bills
    const overdueBills = await Bill.updateMany(
      {
        dueDate: { $lt: now },
        status: { $in: ['draft', 'partial'] }
      },
      { status: 'overdue' }
    );
    
    // Update overdue costs
    const overdueCosts = await Cost.updateMany(
      {
        dueDate: { $lt: now },
        status: 'pending'
      },
      { status: 'overdue' }
    );
    
    if (overdueBills.modifiedCount > 0 || overdueCosts.modifiedCount > 0) {
      Logger.info('Updated overdue items', {
        bills: overdueBills.modifiedCount,
        costs: overdueCosts.modifiedCount
      });
    }
  } catch (error) {
    Logger.error('Failed to update overdue items', { error: error.message });
  }
};

// Create recurring costs
const createRecurringCosts = async () => {
  try {
    const now = new Date();
    
    const recurringCosts = await Cost.find({
      isRecurring: true,
      nextDueDate: { $lte: now }
    });
    
    for (const cost of recurringCosts) {
      // Create new cost entry
      const newCost = new Cost({
        category: cost.category,
        subcategory: cost.subcategory,
        description: cost.description,
        amount: cost.amount,
        currency: cost.currency,
        date: now,
        dueDate: cost.nextDueDate,
        status: 'pending',
        paymentMethod: cost.paymentMethod,
        vendor: cost.vendor,
        vendorContact: cost.vendorContact,
        isRecurring: false, // New entry is not recurring
        tags: cost.tags,
        notes: `تكلفة متكررة من: ${cost._id}`,
        createdBy: cost.createdBy
      });
      
      await newCost.save();
      
      // Update next due date for original recurring cost
      cost.calculateNextDueDate();
      await cost.save();
      
      Logger.info('Created recurring cost', {
        originalId: cost._id,
        newId: newCost._id,
        description: cost.description
      });
    }
  } catch (error) {
    Logger.error('Failed to create recurring costs', { error: error.message });
  }
};

// Initialize all scheduled tasks
export const initializeScheduler = () => {
  // Check low stock every hour
  cron.schedule('0 * * * *', checkLowStock);
  Logger.info('Scheduled: Low stock check every hour');
  
  // Generate daily report at 11:59 PM
  cron.schedule('59 23 * * *', generateDailyReport);
  Logger.info('Scheduled: Daily report at 11:59 PM');
  
  // Update overdue items every 6 hours
  cron.schedule('0 */6 * * *', updateOverdueItems);
  Logger.info('Scheduled: Overdue items check every 6 hours');
  
  // Create recurring costs daily at midnight
  cron.schedule('0 0 * * *', createRecurringCosts);
  Logger.info('Scheduled: Recurring costs check daily at midnight');
  
  // Create database backup weekly on Sunday at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    try {
      await createDatabaseBackup();
      Logger.info('Scheduled backup completed');
    } catch (error) {
      Logger.error('Scheduled backup failed', { error: error.message });
    }
  });
  Logger.info('Scheduled: Database backup weekly on Sunday at 2 AM');
  
  Logger.info('All scheduled tasks initialized');
};

// Manual task execution (for testing)
export const runTask = async (taskName) => {
  switch (taskName) {
    case 'lowStock':
      await checkLowStock();
      break;
    case 'dailyReport':
      await generateDailyReport();
      break;
    case 'updateOverdue':
      await updateOverdueItems();
      break;
    case 'recurringCosts':
      await createRecurringCosts();
      break;
    case 'backup':
      await createDatabaseBackup();
      break;
    default:
      throw new Error('Unknown task name');
  }
};