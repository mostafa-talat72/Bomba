import MenuItem from "../models/MenuItem.js";
import MenuCategory from "../models/MenuCategory.js";
import { writeToAtlas } from "../utils/atlasWrite.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import { validateRequestData } from "../middleware/validation.js";

// Helper to normalize variants/price for create (requires at least one)
function normalizeMenuItemForCreate(body) {
    let variants = body.variants;
    let price = body.price;
    const hasVariants = variants != null && Array.isArray(variants) && variants.length > 0;
    const hasPrice = price != null && price !== "" && !isNaN(Number(price));
    if (hasVariants) {
        if (variants.length === 0) {
            throw new Error("يجب إضافة حجم واحد على الأقل");
        }
        variants = variants.map((v, idx) => {
            if (!v.size || String(v.size).trim() === "") throw new Error(`حجم ${idx + 1}: اسم الحجم مطلوب`);
            if (v.price == null || v.price === "" || isNaN(Number(v.price)) || Number(v.price) < 0) throw new Error(`حجم ${v.size || idx + 1}: السعر يجب أن يكون رقم موجب`);
            return {
                size: String(v.size).trim(),
                price: Number(v.price),
                sku: v.sku != null && String(v.sku).trim() !== "" ? String(v.sku).trim() : null,
                barcode: v.barcode != null && String(v.barcode).trim() !== "" ? String(v.barcode).trim() : null,
            };
        });
        price = variants[0].price;
    } else if (hasPrice) {
        price = Number(price);
        if (isNaN(price) || price < 0) throw new Error("السعر يجب أن يكون رقم موجب");
        variants = [{ size: "عادي", price }];
    } else {
        throw new Error("السعر مطلوب أو يجب إضافة حجم واحد على الأقل");
    }
    body.variants = variants;
    body.price = price;
    return body;
}

function normalizeMenuItemForUpdate(body) {
    const hasVariantsField = Object.prototype.hasOwnProperty.call(body, 'variants');
    const hasPriceField = Object.prototype.hasOwnProperty.call(body, 'price');
    // If neither provided, leave as is (no change to price/variants)
    if (!hasVariantsField && !hasPriceField) return body;
    let variants = body.variants;
    let price = body.price;
    const hasVariants = variants != null && Array.isArray(variants);
    const hasPrice = price != null && price !== "" && !isNaN(Number(price));
    if (hasVariants) {
        if (variants.length === 0) {
            if (hasPrice) {
                price = Number(price);
                variants = [{ size: "عادي", price }];
            } else {
                throw new Error("يجب إضافة حجم واحد على الأقل");
            }
        } else {
            variants = variants.map((v, idx) => {
                if (!v.size || String(v.size).trim() === "") throw new Error(`حجم ${idx + 1}: اسم الحجم مطلوب`);
                if (v.price == null || v.price === "" || isNaN(Number(v.price)) || Number(v.price) < 0) throw new Error(`حجم ${v.size || idx + 1}: السعر يجب أن يكون رقم موجب`);
                return {
                    size: String(v.size).trim(),
                    price: Number(v.price),
                    sku: v.sku != null && String(v.sku).trim() !== "" ? String(v.sku).trim() : null,
                    barcode: v.barcode != null && String(v.barcode).trim() !== "" ? String(v.barcode).trim() : null,
                };
            });
            price = variants[0].price;
        }
        body.variants = variants;
        body.price = price;
    } else if (hasPrice) {
        price = Number(price);
        if (isNaN(price) || price < 0) throw new Error("السعر يجب أن يكون رقم موجب");
        // If variants not provided but price provided, check if we should keep existing variants or replace with single
        // For update, if variants field not present but price present, create single variant only if caller explicitly wants to replace?
        // We treat price-only update as wanting single variant 'عادي'
        // But to keep backward compat, we will create single variant if no variants field
        // However if client sends price without variants, we create single variant
        body.variants = [{ size: "عادي", price }];
        body.price = price;
    }
    return body;
}

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

        // التحقق من توفر المخزون — مجمع بلا حلقات تسلسلية (يجلب كل الخامات مرة واحدة بلا limit)
        if (checkStock === "true") {
            const InventoryItem = (await import("../models/InventoryItem.js")).default;

            const convertQuantity = (quantity, fromUnit, toUnit) => {
                const conversions = {
                    لتر: { مل: 1000, لتر: 1 },
                    مل: { لتر: 0.001, مل: 1 },
                    كيلو: { جرام: 1000, كيلو: 1 },
                    جرام: { كيلو: 0.001, جرام: 1 },
                    قطعة: { قطعة: 1 },
                    علبة: { علبة: 1 },
                    كيس: { كيس: 1 },
                    زجاجة: { زجاجة: 1 },
                };
                const rate = conversions[fromUnit]?.[toUnit];
                return rate ? quantity * rate : quantity;
            };

            // جلب كل الخامات المطلوبة مرة واحدة
            const allIds = [...new Set(menuItems.flatMap(mi => (mi.ingredients || []).map(ing => String(ing.item)).filter(Boolean)))];
            const inventoryMap = new Map();
            if (allIds.length > 0) {
                const docs = await InventoryItem.find({ _id: { $in: allIds } }).lean();
                docs.forEach(d => inventoryMap.set(String(d._id), d));
            }

            const isAvailable = (menuItem) => {
                if (!menuItem.ingredients || menuItem.ingredients.length === 0) return true;
                for (const ing of menuItem.ingredients) {
                    const doc = inventoryMap.get(String(ing.item));
                    if (!doc) return false;
                    const need = convertQuantity(ing.quantity, ing.unit, doc.unit);
                    if (doc.currentStock < need) return false;
                }
                return true;
            };

            const availableMenuItems = menuItems.filter(isAvailable);

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

        // Normalize variants/price before creation
        try {
            normalizeMenuItemForCreate(req.body);
        } catch (normErr) {
            return res.status(400).json({
                success: false,
                message: normErr.message,
                errors: [{ field: "variants", message: normErr.message }],
            });
        }

        // Additional manual validation for variants if provided
        if (req.body.variants) {
            if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "يجب إضافة حجم واحد على الأقل",
                    errors: [{ field: "variants", message: "يجب إضافة حجم واحد على الأقل" }],
                });
            }
            for (let i = 0; i < req.body.variants.length; i++) {
                const v = req.body.variants[i];
                if (!v.size || String(v.size).trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: `حجم ${i + 1}: اسم الحجم مطلوب`,
                        errors: [{ field: `variants[${i}].size`, message: "اسم الحجم مطلوب" }],
                    });
                }
                if (v.price == null || isNaN(Number(v.price)) || Number(v.price) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: `حجم ${v.size}: السعر يجب أن يكون رقم موجب`,
                        errors: [{ field: `variants[${i}].price`, message: "السعر يجب أن يكون رقم موجب" }],
                    });
                }
            }
        }

        const menuItemData = {
            ...req.body,
            createdBy: req.user.id,
            organization: req.user.organization,
        };

        const menuItem = new MenuItem(menuItemData);
        await menuItem.save();

        // Fire-and-forget Atlas write
        writeToAtlas('menuitems', 'upsert', menuItem.toObject ? menuItem.toObject() : menuItem, { _id: menuItem._id });

        // Sync category to inventory
        await syncCategoryToInventory(menuItem.category);

        // Prepare minimal response data
        const responseData = {
            _id: menuItem._id,
            name: menuItem.name,
            price: menuItem.price,
            variants: menuItem.variants,
            category: menuItem.category,
            isAvailable: menuItem.isAvailable,
            createdAt: menuItem.createdAt,
        };

        // Return response IMMEDIATELY
        res.status(201).json({
            success: true,
            message: "تم إنشاء عنصر القائمة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                if (req.io) {
                    try { req.io.notifyMenuUpdate("created", menuItem, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for createMenuItem:', bgError);
            }
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

        // Normalize variants/price if provided
        try {
            normalizeMenuItemForUpdate(req.body);
        } catch (normErr) {
            return res.status(400).json({
                success: false,
                message: normErr.message,
                errors: [{ field: "variants", message: normErr.message }],
            });
        }

        if (req.body.variants) {
            if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "يجب إضافة حجم واحد على الأقل",
                    errors: [{ field: "variants", message: "يجب إضافة حجم واحد على الأقل" }],
                });
            }
            for (let i = 0; i < req.body.variants.length; i++) {
                const v = req.body.variants[i];
                if (!v.size || String(v.size).trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: `حجم ${i + 1}: اسم الحجم مطلوب`,
                        errors: [{ field: `variants[${i}].size`, message: "اسم الحجم مطلوب" }],
                    });
                }
                if (v.price == null || isNaN(Number(v.price)) || Number(v.price) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: `حجم ${v.size}: السعر يجب أن يكون رقم موجب`,
                        errors: [{ field: `variants[${i}].price`, message: "السعر يجب أن يكون رقم موجب" }],
                    });
                }
            }
        }

        const updateData = {
            ...req.body,
            updatedBy: req.user.id,
        };

        const menuItem = await MenuItem.findOneAndUpdate(
            { _id: id, organization: req.user.organization },
            updateData,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "عنصر القائمة غير موجود",
            });
        }

        // Fire-and-forget Atlas write
        writeToAtlas('menuitems', 'upsert', menuItem.toObject ? menuItem.toObject() : menuItem, { _id: menuItem._id });

        // Sync category to inventory if category was updated
        if (updateData.category) {
            await syncCategoryToInventory(updateData.category);
        }

        // Prepare minimal response data
        const responseData = {
            _id: menuItem._id,
            name: menuItem.name,
            price: menuItem.price,
            variants: menuItem.variants,
            category: menuItem.category,
            isAvailable: menuItem.isAvailable,
            updatedAt: menuItem.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم تحديث عنصر القائمة بنجاح",
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                await menuItem.populate("category", "name section");
                await menuItem.populate("category.section", "name");
                await menuItem.populate("createdBy", "name");
                await menuItem.populate("updatedBy", "name");

                if (req.io) {
                    try { req.io.notifyMenuUpdate("updated", menuItem, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for updateMenuItem:', bgError);
            }
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

        const menuItem = await MenuItem.findOne({
            _id: id,
            organization: req.user.organization,
        });

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "عنصر القائمة غير موجود",
            });
        }

        const menuItemId = menuItem._id;
        await menuItem.deleteOne();

        // Fire-and-forget Atlas write for delete
        writeToAtlas('menuitems', 'delete', null, { _id: menuItemId });

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: "تم حذف عنصر القائمة بنجاح",
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                if (req.io) {
                    try { req.io.notifyMenuUpdate("deleted", { _id: id }, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for deleteMenuItem:', bgError);
            }
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

        // Fire-and-forget Atlas write
        writeToAtlas('menuitems', 'upsert', menuItem.toObject ? menuItem.toObject() : menuItem, { _id: menuItem._id });

        // Prepare minimal response data
        const responseData = {
            _id: menuItem._id,
            name: menuItem.name,
            isAvailable: menuItem.isAvailable,
            updatedAt: menuItem.updatedAt,
        };

        // Return response IMMEDIATELY
        res.json({
            success: true,
            message: `تم ${
                menuItem.isAvailable ? "تفعيل" : "إلغاء تفعيل"
            } عنصر القائمة بنجاح`,
            data: responseData,
        });

        // All background work in setImmediate - non-blocking
        setImmediate(async () => {
            try {
                if (req.io) {
                    try { req.io.notifyMenuUpdate("updated", menuItem, req.user.organization); } catch (e) {}
                }
            } catch (bgError) {
                Logger.error('Background tasks failed for toggleMenuItemAvailability:', bgError);
            }
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

        if (req.io) {
            try { req.io.notifyMenuUpdate("updated", null, req.user.organization); } catch (e) {}
        }

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


