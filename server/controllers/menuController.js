import MenuItem from "../models/MenuItem.js";
import MenuCategory from "../models/MenuCategory.js";
import {
    validateRequest,
    validateRequestData,
} from "../middleware/validation.js";

// Get all menu items with optional filtering
export const getAllMenuItems = async (req, res) => {
    try {
        const {
            category,
            search,
            isAvailable,
            sortBy = "name",
            sortOrder = "asc",
            page = 1,
            limit = 0, // Set to 0 to return all items
            checkStock, // معامل جديد للتحقق من توفر المخزون
        } = req.query;

        // تحقق من وجود المستخدم والمنشأة
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message:
                    "يجب تسجيل الدخول للوصول إلى عناصر المنيو أو لا توجد منشأة مرتبطة بالمستخدم.",
            });
        }
        // Build filter object
        const filter = {};
        if (category && category !== "all") {
            filter.category = category;
        }
        if (isAvailable !== undefined) {
            filter.isAvailable = isAvailable === "true";
        }
        if (search) {
            filter.$text = { $search: search };
        }
        filter.organization = req.user.organization;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const menuItems = await MenuItem.find({
            organization: req.user.organization,
            ...filter,
        })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate("category", "name section")
            .populate("category.section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        // Get total count for pagination
        const total = await MenuItem.countDocuments(filter);

        // التحقق من توفر المخزون فقط إذا كان معامل checkStock موجود
        if (checkStock === "true") {
            // دالة للتحقق من توفر المخزون لعنصر القائمة
            const checkMenuItemStockAvailability = async (menuItem) => {
                if (
                    !menuItem.ingredients ||
                    menuItem.ingredients.length === 0
                ) {
                    return true; // إذا لم تكن هناك خامات، يعتبر متاح
                }

                const InventoryItem = (
                    await import("../models/InventoryItem.js")
                ).default;

                // دالة لتحويل الوحدات
                const convertQuantity = (quantity, fromUnit, toUnit) => {
                    const conversions = {
                        // تحويلات الحجم
                        لتر: { مل: 1000, لتر: 1 },
                        مل: { لتر: 0.001, مل: 1 },
                        // تحويلات الوزن
                        كيلو: { جرام: 1000, كيلو: 1 },
                        جرام: { كيلو: 0.001, جرام: 1 },
                        // الوحدات الأخرى
                        قطعة: { قطعة: 1 },
                        علبة: { علبة: 1 },
                        كيس: { كيس: 1 },
                        زجاجة: { زجاجة: 1 },
                    };

                    const conversionRate = conversions[fromUnit]?.[toUnit];
                    return conversionRate
                        ? quantity * conversionRate
                        : quantity;
                };

                for (const ingredient of menuItem.ingredients) {
                    const inventoryItem = await InventoryItem.findById(
                        ingredient.item
                    );
                    if (!inventoryItem) {
                        return false; // إذا لم توجد الخامة، غير متاح
                    }

                    // تحويل الكمية المطلوبة إلى وحدة المخزون
                    const requiredQuantityInStockUnit = convertQuantity(
                        ingredient.quantity,
                        ingredient.unit,
                        inventoryItem.unit
                    );

                    // التحقق من توفر المخزون بعد التحويل
                    if (
                        inventoryItem.currentStock < requiredQuantityInStockUnit
                    ) {
                        return false; // المخزون غير كافي
                    }
                }

                return true; // جميع الخامات متوفرة
            };

            // التحقق من توفر المخزون لكل عنصر
            const availableMenuItems = [];
            for (const menuItem of menuItems) {
                const isStockAvailable = await checkMenuItemStockAvailability(
                    menuItem
                );
                if (isStockAvailable) {
                    availableMenuItems.push(menuItem);
                }
            }

            res.json({
                success: true,
                count: availableMenuItems.length,
                total: availableMenuItems.length,
                data: availableMenuItems,
            });
        } else {
            // إرجاع جميع العناصر بدون التحقق من المخزون
            res.json({
                success: true,
                count: menuItems.length,
                total,
                data: menuItems,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit)),
                },
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب عناصر القائمة",
            error: error.message,
        });
    }
};

// Get menu item by ID
export const getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const menuItem = await MenuItem.findOne({
            _id: id,
            organization: req.user.organization,
        })
            .populate("category", "name section")
            .populate("category.section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "العنصر غير موجود",
                error: "MenuItem not found",
            });
        }

        res.json({
            success: true,
            data: menuItem,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب العنصر",
            error: err.message,
        });
    }
};

// Create new menu item
// Helper function to sync menu category to inventory categories
const syncCategoryToInventory = async (categoryId) => {
    try {
        if (!categoryId) return;
        
        const category = await MenuCategory.findById(categoryId);
        if (!category) return;
        
        // Category name is now automatically available for inventory items
        // No need to update enum since we removed it
    } catch (error) {
        console.error('Error syncing category:', error);
        // Don't throw error - this is not critical
    }
};

export const createMenuItem = async (req, res) => {
    try {
        const validation = validateRequestData(req);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "بيانات الطلب غير صحيحة",
                errors: validation.errors,
            });
        }

        const menuItemData = {
            ...req.body,
            createdBy: req.user.id,
            organization: req.user.organization,
        };

        const menuItem = new MenuItem(menuItemData);
        await menuItem.save();
        
        // Sync category to inventory
        await syncCategoryToInventory(menuItem.category);

        res.status(201).json({
            success: true,
            message: "تم إنشاء عنصر القائمة بنجاح",
            data: menuItem,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "عنصر القائمة موجود بالفعل",
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء عنصر القائمة",
            error: error.message,
        });
    }
};

// Update menu item
export const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const validation = validateRequestData(req);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "بيانات الطلب غير صحيحة",
                errors: validation.errors,
            });
        }

        const updateData = {
            ...req.body,
            updatedBy: req.user.id,
        };

        const menuItem = await MenuItem.findByIdAndUpdate(
            { _id: id, organization: req.user.organization },
            updateData,
            {
                new: true,
                runValidators: true,
            }
        )
            .populate("category", "name section")
            .populate("category.section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "عنصر القائمة غير موجود",
            });
        }
        
        // Sync category to inventory if category was updated
        if (updateData.category) {
            await syncCategoryToInventory(updateData.category);
        }

        res.json({
            success: true,
            message: "تم تحديث عنصر القائمة بنجاح",
            data: menuItem,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "عنصر القائمة موجود بالفعل",
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في تحديث عنصر القائمة",
            error: error.message,
        });
    }
};

// Delete menu item
export const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;

        const menuItem = await MenuItem.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "عنصر القائمة غير موجود",
            });
        }

        res.json({
            success: true,
            message: "تم حذف عنصر القائمة بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف عنصر القائمة",
            error: error.message,
        });
    }
};

// Get menu items by category
export const getItemsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const menuItems = await MenuItem.getByCategory(category);

        res.json({
            success: true,
            data: menuItems,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب العناصر حسب الفئة",
            error: err.message,
        });
    }
};

// Get popular items
export const getPopularItems = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const menuItems = await MenuItem.getPopularItems(parseInt(limit));

        res.json({
            success: true,
            data: menuItems,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب العناصر الشائعة",
            error: err.message,
        });
    }
};

// Get menu statistics
export const getMenuStats = async (req, res) => {
    try {
        const stats = await MenuItem.aggregate([
            {
                $group: {
                    _id: null,
                    totalItems: { $sum: 1 },
                    availableItems: {
                        $sum: {
                            $cond: [{ $eq: ["$isAvailable", true] }, 1, 0],
                        },
                    },
                    unavailableItems: {
                        $sum: {
                            $cond: [{ $eq: ["$isAvailable", false] }, 1, 0],
                        },
                    },
                    totalOrders: { $sum: "$orderCount" },
                    averagePrice: { $avg: "$price" },
                },
            },
        ]);

        const categoryStats = await MenuItem.aggregate([
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 },
                    totalOrders: { $sum: "$orderCount" },
                    averagePrice: { $avg: "$price" },
                },
            },
            { $sort: { count: -1 } },
        ]);

        const result = {
            total: stats[0]?.totalItems || 0,
            available: stats[0]?.availableItems || 0,
            unavailable: stats[0]?.unavailableItems || 0,
            totalOrders: stats[0]?.totalOrders || 0,
            averagePrice: stats[0]?.averagePrice || 0,
            byCategory: categoryStats,
        };

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات المنيو",
            error: err.message,
        });
    }
};

// Increment order count for an item
export const incrementOrderCount = async (req, res) => {
    try {
        const { id } = req.params;
        const menuItem = await MenuItem.findById(id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "العنصر غير موجود",
                error: "MenuItem not found",
            });
        }

        await menuItem.incrementOrderCount();

        res.json({
            success: true,
            message: "تم تحديث عدد الطلبات",
            data: { orderCount: menuItem.orderCount + 1 },
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: "خطأ في تحديث عدد الطلبات",
            error: err.message,
        });
    }
};

// Toggle menu item availability
export const toggleMenuItemAvailability = async (req, res) => {
    try {
        const { id } = req.params;

        const menuItem = await MenuItem.findById(id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "عنصر القائمة غير موجود",
            });
        }

        menuItem.isAvailable = !menuItem.isAvailable;
        menuItem.updatedBy = req.user.id;
        await menuItem.save();

        res.json({
            success: true,
            message: `تم ${
                menuItem.isAvailable ? "تفعيل" : "إلغاء تفعيل"
            } عنصر القائمة بنجاح`,
            data: menuItem,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تغيير حالة عنصر القائمة",
            error: error.message,
        });
    }
};

// Get menu categories (deprecated - kept for backward compatibility)
// This should return category IDs from MenuCategory model
export const getMenuCategories = async (req, res) => {
    try {
        // Get categories from MenuCategory model instead of MenuItem
        const MenuCategory = (await import("../models/MenuCategory.js")).default;
        const categories = await MenuCategory.find({
            organization: req.user?.organization || null,
        })
            .populate("section", "name")
            .sort({ sortOrder: 1, name: 1 });

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب فئات المنيو",
            error: error.message,
        });
    }
};

// Get popular menu items
export const getPopularMenuItems = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const popularItems = await MenuItem.find({
            isPopular: true,
            isAvailable: true,
            organization: req.user?.organization,
        })
            .sort({ sortOrder: 1, name: 1 })
            .limit(parseInt(limit))
            .populate("category", "name section")
            .populate("category.section", "name");

        res.json({
            success: true,
            data: popularItems,
            count: popularItems.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب العناصر الشائعة",
            error: error.message,
        });
    }
};

// Bulk update menu items order
export const updateMenuItemsOrder = async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: "قائمة العناصر مطلوبة",
            });
        }

        const updatePromises = items.map((item) =>
            MenuItem.findByIdAndUpdate(item.id, {
                sortOrder: item.sortOrder,
                updatedBy: req.user.id,
            })
        );

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: "تم تحديث ترتيب العناصر بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث ترتيب العناصر",
            error: error.message,
        });
    }
};
