import express from 'express';
import {
  getDashboardStats,
  getSalesReport,
  getInventoryReport,
  getFinancialReport,
  getSessionsReport,
  getRecentActivity
} from '../controllers/reportController.js';
import { protect, authorize, adminOnly } from '../middleware/auth.js';
import Bill from '../models/Bill.js';
import Session from '../models/Session.js';
import Order from '../models/Order.js';
import InventoryItem from '../models/InventoryItem.js';
import Cost from '../models/Cost.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// All routes require admin role
router.use(adminOnly);

router.get('/dashboard', authorize('dashboard', 'reports', 'all'), getDashboardStats);
router.get('/recent-activity', authorize('dashboard', 'reports', 'all'), getRecentActivity);

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }

  return { start, end: now };
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private (Admin)
router.get('/sales', async (req, res) => {
  try {
    const { period = 'today', groupBy = 'day' } = req.query;
    const { start, end } = getDateRange(period);

    // Get bills in date range
    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['paid', 'partial'] }
    }).populate('orders sessions');

    // Calculate total revenue
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalOrders = bills.reduce((sum, bill) => sum + bill.orders.length, 0);

    // Revenue by type
    const revenueByType = {
      playstation: 0,
      computer: 0,
      cafe: 0
    };

    bills.forEach(bill => {
      if (bill.billType === 'playstation') {
        revenueByType.playstation += bill.total;
      } else if (bill.billType === 'computer') {
        revenueByType.computer += bill.total;
      } else if (bill.billType === 'cafe') {
        revenueByType.cafe += bill.total;
      }
    });

    // Top products
    const productSales = {};
    bills.forEach(bill => {
      bill.orders.forEach(order => {
        order.items.forEach(item => {
          if (!productSales[item.name]) {
            productSales[item.name] = { quantity: 0, revenue: 0 };
          }
          productSales[item.name].quantity += item.quantity;
          productSales[item.name].revenue += item.price * item.quantity;
        });
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        revenueByType,
        topProducts,
        period,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب تقرير المبيعات',
      error: error.message
    });
  }
});

// @desc    Get sessions report
// @route   GET /api/reports/sessions
// @access  Private (Admin)
router.get('/sessions', async (req, res) => {
  try {
    const { period = 'today', device } = req.query;
    const { start, end } = getDateRange(period);

    const query = {
      startTime: { $gte: start, $lte: end },
      status: 'completed'
    };

    if (device) {
      query.deviceType = device;
    }

    const sessions = await Session.find(query);

    // Calculate statistics
    const totalSessions = sessions.length;
    const totalRevenue = sessions.reduce((sum, session) => sum + session.finalCost, 0);
    const totalHours = sessions.reduce((sum, session) => {
      const duration = (session.endTime - session.startTime) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    const avgSessionDuration = totalSessions > 0 ? totalHours / totalSessions : 0;

    // Most used device
    const deviceUsage = {};
    sessions.forEach(session => {
      if (!deviceUsage[session.deviceName]) {
        deviceUsage[session.deviceName] = 0;
      }
      deviceUsage[session.deviceName]++;
    });

    const mostUsedDevice = Object.entries(deviceUsage)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'غير متوفر';

    // Usage rate (assuming 12 hours operation per day)
    const daysInPeriod = (end - start) / (1000 * 60 * 60 * 24);
    const maxPossibleHours = daysInPeriod * 12; // 12 hours per day
    const usageRate = maxPossibleHours > 0 ? (totalHours / maxPossibleHours) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalSessions,
        totalRevenue,
        totalHours,
        avgSessionDuration,
        mostUsedDevice,
        usageRate,
        period,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب تقرير الجلسات',
      error: error.message
    });
  }
});

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Admin)
router.get('/inventory', async (req, res) => {
  try {
    const { category } = req.query;

    const query = {};
    if (category) {
      query.category = category;
    }

    const items = await InventoryItem.find(query);

    // Calculate statistics
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock * item.price), 0);
    const lowStockItems = items.filter(item => item.isLowStock).length;
    const outOfStockItems = items.filter(item => item.isOutOfStock).length;

    // Items by category
    const itemsByCategory = {};
    items.forEach(item => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = { count: 0, value: 0 };
      }
      itemsByCategory[item.category].count++;
      itemsByCategory[item.category].value += item.currentStock * item.price;
    });

    res.json({
      success: true,
      data: {
        totalItems,
        totalValue,
        lowStockItems,
        outOfStockItems,
        itemsByCategory,
        items: items.slice(0, 20) // Limit to first 20 items
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب تقرير المخزون',
      error: error.message
    });
  }
});

// @desc    Get financial report
// @route   GET /api/reports/financial
// @access  Private (Admin)
router.get('/financial', async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const { start, end } = getDateRange(period);

    // Get revenue from bills
    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['paid', 'partial'] }
    });

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);

    // Get costs
    const costs = await Cost.find({
      date: { $gte: start, $lte: end },
      status: 'paid'
    });

    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Total transactions
    const totalTransactions = bills.length + costs.length;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCosts,
        grossProfit,
        profitMargin,
        totalTransactions,
        period,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب التقرير المالي',
      error: error.message
    });
  }
});

export default router;
