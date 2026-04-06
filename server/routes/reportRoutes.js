import express from "express";
import {
    getDashboardStats,
    getSalesReport,
    getInventoryReport,
    getFinancialReport,
    getSessionsReport,
    getRecentActivity,
    exportReportToExcel,
    exportReportToPDF,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";
import Bill from "../models/Bill.js";
import Session from "../models/Session.js";
import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import Cost from "../models/Cost.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// All routes require reports permission
router.use(authorize("reports", "all"));

// Dashboard stats
router.get("/dashboard", getDashboardStats);

// Recent activity
router.get("/recent-activity", getRecentActivity);

// Export routes
router.get("/export/excel", exportReportToExcel);
router.get("/export/pdf", exportReportToPDF);

// Helper function to get date range
const getDateRange = (period) => {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case "today":
            start.setHours(0, 0, 0, 0);
            break;
        case "week":
            start.setDate(now.getDate() - 7);
            break;
        case "month":
            start.setMonth(now.getMonth() - 1);
            break;
        case "quarter":
            start.setMonth(now.getMonth() - 3);
            break;
        case "year":
            start.setFullYear(now.getFullYear() - 1);
            break;
        default:
            start.setHours(0, 0, 0, 0);
    }

    return { start, end: now };
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private (Reports permission)
router.get("/sales", getSalesReport);

// @desc    Get sessions report
// @route   GET /api/reports/sessions
// @access  Private (Reports permission)
router.get("/sessions", getSessionsReport);

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Reports permission)
router.get("/inventory", getInventoryReport);

// @desc    Get financial report
// @route   GET /api/reports/financial
// @access  Private (Reports permission)
router.get("/financial", getFinancialReport);

// @desc    Get sold items report (hierarchical: section -> category -> item)
// @route   GET /api/reports/sold-items
// @access  Private (SoldItems permission)
router.get("/sold-items", authorize("soldItems", "all"), async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = req.query;
        
        // Build date filter
        let dateQuery = {};
        if (dateFilter === 'custom' && startDate && endDate) {
            // Custom date range
            dateQuery = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            switch (dateFilter) {
                case 'today':
                    dateQuery = { createdAt: { $gte: today } };
                    break;
                case 'week':
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    dateQuery = { createdAt: { $gte: weekAgo } };
                    break;
                case 'month':
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    dateQuery = { createdAt: { $gte: monthAgo } };
                    break;
            }
        }
        
        // Get all orders (excluding cancelled) with populated data
        const orders = await Order.find({
            status: { $ne: 'cancelled' },
            items: { $exists: true, $ne: [], $type: 'array' },
            ...dateQuery
        })
        .populate({
            path: 'table',
            select: 'number section',
            populate: {
                path: 'section',
                select: 'name'
            }
        })
        .populate('bill', 'billNumber')
        .sort({ createdAt: -1 })
        .lean();
        
        
        // Get all menu items with their categories and sections
        const MenuItem = (await import('../models/MenuItem.js')).default;
        const MenuCategory = (await import('../models/MenuCategory.js')).default;
        const MenuSection = (await import('../models/MenuSection.js')).default;
        
        const menuItems = await MenuItem.find({ organization: req.user.organization })
            .populate({
                path: 'category',
                select: 'name section sortOrder',
                populate: {
                    path: 'section',
                    select: 'name sortOrder'
                }
            })
            .lean();
        
        // Create a map of item names to their menu structure
        const itemMenuMap = new Map();
        menuItems.forEach(item => {
            if (item.category && item.category.section) {
                itemMenuMap.set(item.name, {
                    sectionId: item.category.section._id.toString(),
                    sectionName: item.category.section.name,
                    sectionSortOrder: item.category.section.sortOrder || 0,
                    categoryId: item.category._id.toString(),
                    categoryName: item.category.name,
                    categorySortOrder: item.category.sortOrder || 0,
                    itemId: item._id.toString()
                });
            }
        });
        
        // Build hierarchical structure: sections -> categories -> items -> details
        const sectionsMap = new Map();
        
        orders.forEach(order => {
            if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
                return;
            }
            
            order.items.forEach(item => {
                if (!item || !item.name) return;
                
                const quantity = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                
                if (quantity <= 0 || price < 0) return;
                
                const itemName = item.name;
                const menuInfo = itemMenuMap.get(itemName);
                
                // If item not found in menu, skip it or put in "غير مصنف"
                const sectionId = menuInfo?.sectionId || 'uncategorized';
                const sectionName = menuInfo?.sectionName || 'غير مصنف';
                const sectionSortOrder = menuInfo?.sectionSortOrder || 999;
                const categoryId = menuInfo?.categoryId || 'uncategorized';
                const categoryName = menuInfo?.categoryName || 'غير مصنف';
                const categorySortOrder = menuInfo?.categorySortOrder || 999;
                
                // Get or create section
                if (!sectionsMap.has(sectionId)) {
                    sectionsMap.set(sectionId, {
                        sectionId,
                        sectionName,
                        sectionSortOrder,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        categories: new Map()
                    });
                }
                
                const section = sectionsMap.get(sectionId);
                section.totalQuantity += quantity;
                section.totalRevenue += price * quantity;
                
                // Get or create category
                if (!section.categories.has(categoryId)) {
                    section.categories.set(categoryId, {
                        categoryId,
                        categoryName,
                        categorySortOrder,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        items: new Map()
                    });
                }
                
                const category = section.categories.get(categoryId);
                category.totalQuantity += quantity;
                category.totalRevenue += price * quantity;
                
                // Get or create item
                if (!category.items.has(itemName)) {
                    category.items.set(itemName, {
                        itemName,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        details: []
                    });
                }
                
                const soldItem = category.items.get(itemName);
                soldItem.totalQuantity += quantity;
                soldItem.totalRevenue += price * quantity;
                soldItem.orderCount += 1;
                
                // Add detail
                soldItem.details.push({
                    orderId: order._id,
                    orderNumber: order.orderNumber || '',
                    billId: order.bill?._id || '',
                    billNumber: order.bill?.billNumber || '',
                    tableName: order.table?.number ? String(order.table.number) : '',
                    tableSection: order.table?.section?.name || '',
                    quantity: quantity,
                    price: price,
                    total: price * quantity,
                    orderDate: order.createdAt,
                    customerName: order.customerName || ''
                });
            });
        });
        
        // Convert maps to arrays and sort
        const sections = Array.from(sectionsMap.values()).map(section => ({
            ...section,
            categories: Array.from(section.categories.values()).map(category => ({
                ...category,
                items: Array.from(category.items.values())
            })).sort((a, b) => a.categorySortOrder - b.categorySortOrder)
        })).sort((a, b) => a.sectionSortOrder - b.sectionSortOrder);
        
        
        res.json({
            success: true,
            data: sections,
            count: sections.length
        });
        
    } catch (error) {
        console.error('Error fetching sold items:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات الأصناف المباعة',
            error: error.message
        });
    }
});

export default router;
