import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import Bill from "../models/Bill.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import mongoose from "mongoose";

// دالة مساعدة لتحويل الوحدات
const convertQuantity = (quantity, fromUnit, toUnit) => {
    const conversions = {
        // تحويلات الحجم
        لتر: { مل: 1000, لتر: 1 },
        مل: { لتر: 0.001, مل: 1 },
        // تحويلات الوزن
        كيلو: { جرام: 1000, كيلو: 1 },
        جرام: { كيلو: 0.001, جرام: 1 },
        كيلوغرام: { جرام: 1000, كيلوغرام: 1, كيلو: 1 },
        غرام: { كيلوغرام: 0.001, غرام: 1, كيلو: 0.001 },
        // الوحدات الأخرى
        قطعة: { قطعة: 1 },
        علبة: { علبة: 1 },
        كيس: { كيس: 1 },
        زجاجة: { زجاجة: 1 },
        كوب: { كوب: 1 },
        حبة: { حبة: 1 },
        ملعقة: { ملعقة: 1 },
    };

    // إذا كانت الوحدات متطابقة، إرجاع الكمية كما هي
    if (fromUnit === toUnit) {
        return quantity;
    }

    const conversionRate = conversions[fromUnit]?.[toUnit];
    if (conversionRate) {
        console.log(
            `    Converting ${quantity} ${fromUnit} to ${
                quantity * conversionRate
            } ${toUnit}`
        );
        return quantity * conversionRate;
    } else {
        console.log(
            `    No conversion found from ${fromUnit} to ${toUnit}, returning original quantity`
        );
        return quantity;
    }
};

// دالة مساعدة لحساب المخزون المطلوب لجميع الأصناف
const calculateTotalInventoryNeeded = async (orderItems) => {
    const inventoryNeeded = new Map(); // Map<inventoryItemId, { quantity, unit }>

    console.log("=== STARTING INVENTORY CALCULATION ===");
    console.log("Input orderItems:", JSON.stringify(orderItems, null, 2));

    // تجميع جميع المكونات المطلوبة أولاً
    const allIngredients = [];

    for (const item of orderItems) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (menuItem && menuItem.ingredients) {
                for (const ingredient of menuItem.ingredients) {
                    allIngredients.push({
                        inventoryItemId: ingredient.item,
                        quantity: ingredient.quantity * item.quantity,
                        unit: ingredient.unit,
                        itemName: item.name,
                    });
                }
            }
        }
    }

    console.log(
        "All ingredients collected:",
        allIngredients.map(
            (i) =>
                `${i.itemName}: ${i.quantity} ${i.unit} of ${i.inventoryItemId}`
        )
    );

    for (const item of orderItems) {
        console.log(`\n--- Processing item: ${item.name || "Unknown"} ---`);
        console.log("Item data:", JSON.stringify(item, null, 2));

        if (item.menuItem) {
            console.log(`Looking up menuItem with ID: ${item.menuItem}`);
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem) {
                console.error(`Menu item not found: ${item.menuItem}`);
                throw new Error(`عنصر القائمة غير موجود: ${item.menuItem}`);
            }
            if (!menuItem.isAvailable) {
                console.error(`Menu item not available: ${menuItem.name}`);
                throw new Error(`العنصر غير متاح: ${menuItem.name}`);
            }

            console.log(`Found menu item: ${menuItem.name}`);
            console.log(
                `Menu item ingredients:`,
                JSON.stringify(menuItem.ingredients, null, 2)
            );

            if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const requiredQuantityForItem =
                        ingredient.quantity * item.quantity;

                    console.log(`  Processing ingredient: ${ingredient.item}`);
                    console.log(
                        `  Required quantity for this item: ${requiredQuantityForItem} ${ingredient.unit}`
                    );

                    if (inventoryNeeded.has(ingredient.item)) {
                        const prev = inventoryNeeded.get(ingredient.item);
                        console.log(
                            `    Previous quantity for ${ingredient.item}: ${prev.quantity} ${prev.unit}`
                        );

                        // تحويل الوحدات إلى نفس الوحدة للجمع
                        let totalQuantity;
                        let baseUnit = ingredient.unit;

                        if (prev.unit !== ingredient.unit) {
                            // تحويل الكمية السابقة إلى وحدة المكون الحالي
                            const prevConverted = convertQuantity(
                                prev.quantity,
                                prev.unit,
                                ingredient.unit
                            );
                            totalQuantity =
                                prevConverted + requiredQuantityForItem;
                            console.log(
                                `    Converting ${prev.quantity} ${prev.unit} to ${prevConverted} ${ingredient.unit}`
                            );
                            console.log(
                                `    Adding ${requiredQuantityForItem} ${ingredient.unit} = ${totalQuantity} ${ingredient.unit}`
                            );
                        } else {
                            totalQuantity =
                                prev.quantity + requiredQuantityForItem;
                            console.log(
                                `    Adding ${prev.quantity} + ${requiredQuantityForItem} = ${totalQuantity} ${ingredient.unit}`
                            );
                        }

                        inventoryNeeded.set(ingredient.item, {
                            quantity: totalQuantity,
                            unit: baseUnit,
                        });
                        console.log(
                            `    Updated total for ${ingredient.item}: ${totalQuantity} ${baseUnit}`
                        );
                    } else {
                        inventoryNeeded.set(ingredient.item, {
                            quantity: requiredQuantityForItem,
                            unit: ingredient.unit,
                        });
                        console.log(
                            `    First time for ${ingredient.item}: ${requiredQuantityForItem} ${ingredient.unit}`
                        );
                    }
                }
            } else {
                console.log(
                    `  No ingredients found for menu item: ${menuItem.name}`
                );
            }
        } else {
            console.log(`  Item has no menuItem field: ${item.name}`);
        }
    }

    // إعادة حساب المخزون المطلوب من جميع المكونات المجمعة
    const consolidatedInventory = new Map();

    for (const ingredient of allIngredients) {
        const { inventoryItemId, quantity, unit } = ingredient;

        if (consolidatedInventory.has(inventoryItemId)) {
            const existing = consolidatedInventory.get(inventoryItemId);
            console.log(
                `    Consolidating ${inventoryItemId}: existing ${existing.quantity} ${existing.unit} + new ${quantity} ${unit}`
            );

            let totalQuantity;
            let baseUnit = existing.unit;

            if (existing.unit !== unit) {
                const convertedQuantity = convertQuantity(
                    quantity,
                    unit,
                    existing.unit
                );
                totalQuantity = existing.quantity + convertedQuantity;
                console.log(
                    `    Converted ${quantity} ${unit} to ${convertedQuantity} ${existing.unit}`
                );
            } else {
                totalQuantity = existing.quantity + quantity;
            }

            consolidatedInventory.set(inventoryItemId, {
                quantity: totalQuantity,
                unit: baseUnit,
            });
            console.log(
                `    Updated total for ${inventoryItemId}: ${totalQuantity} ${baseUnit}`
            );
        } else {
            consolidatedInventory.set(inventoryItemId, { quantity, unit });
            console.log(
                `    First time for ${inventoryItemId}: ${quantity} ${unit}`
            );
        }
    }

    // استبدال النتيجة الأصلية بالنتيجة المجمعة
    inventoryNeeded.clear();
    for (const [id, data] of consolidatedInventory) {
        inventoryNeeded.set(id, data);
    }

    console.log("\n=== FINAL INVENTORY NEEDED ===");
    console.log(Array.from(inventoryNeeded.entries()));

    // التحقق من أن جميع المكونات المتشابهة تم جمعها بشكل صحيح
    const finalInventoryNeeded = new Map();
    const processedItems = new Set(); // لتتبع العناصر المعالجة

    for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
        if (processedItems.has(inventoryItemId.toString())) {
            console.log(
                `    Skipping duplicate ${inventoryItemId} - already processed`
            );
            continue;
        }

        // البحث عن جميع الإدخالات لهذا العنصر
        let totalQuantity = quantity;
        let baseUnit = unit;

        for (const [
            otherId,
            { quantity: otherQuantity, unit: otherUnit },
        ] of inventoryNeeded) {
            if (
                otherId.toString() === inventoryItemId.toString() &&
                otherId !== inventoryItemId
            ) {
                console.log(
                    `    Found duplicate for ${inventoryItemId}: ${otherQuantity} ${otherUnit}`
                );

                if (otherUnit !== baseUnit) {
                    const convertedQuantity = convertQuantity(
                        otherQuantity,
                        otherUnit,
                        baseUnit
                    );
                    totalQuantity += convertedQuantity;
                    console.log(
                        `    Converted ${otherQuantity} ${otherUnit} to ${convertedQuantity} ${baseUnit}`
                    );
                } else {
                    totalQuantity += otherQuantity;
                }
                console.log(
                    `    Updated total for ${inventoryItemId}: ${totalQuantity} ${baseUnit}`
                );
            }
        }

        finalInventoryNeeded.set(inventoryItemId, {
            quantity: totalQuantity,
            unit: baseUnit,
        });
        processedItems.add(inventoryItemId.toString());
        console.log(
            `    Final consolidated for ${inventoryItemId}: ${totalQuantity} ${baseUnit}`
        );
    }

    console.log("=== CONSOLIDATED INVENTORY NEEDED ===");
    console.log(Array.from(finalInventoryNeeded.entries()));
    console.log("=== END INVENTORY CALCULATION ===\n");

    return finalInventoryNeeded;
};

// دالة مساعدة للتحقق من توفر المخزون
const validateInventoryAvailability = async (inventoryNeeded) => {
    const validationErrors = [];

    console.log("=== STARTING INVENTORY VALIDATION ===");
    console.log("Inventory needed:", Array.from(inventoryNeeded.entries()));

    for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
        console.log(`\n--- Validating inventory item: ${inventoryItemId} ---`);
        console.log(`Required: ${quantity} ${unit}`);

        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (!inventoryItem) {
            console.error(`Inventory item not found: ${inventoryItemId}`);
            validationErrors.push(
                `الخامة ${inventoryItemId} غير موجودة في المخزون`
            );
            continue;
        }

        console.log(`Found inventory item: ${inventoryItem.name}`);
        console.log(`Inventory item unit: ${inventoryItem.unit}`);
        console.log(
            `Available stock: ${inventoryItem.currentStock} ${inventoryItem.unit}`
        );

        // تحويل الكمية المطلوبة من وحدة المكون إلى وحدة المخزون
        const convertedQuantityNeeded = convertQuantity(
            quantity,
            unit,
            inventoryItem.unit
        );

        console.log(
            `Converted required quantity: ${convertedQuantityNeeded} ${inventoryItem.unit}`
        );
        console.log(
            `Available: ${inventoryItem.currentStock} ${inventoryItem.unit}`
        );
        console.log(
            `Is sufficient: ${
                inventoryItem.currentStock >= convertedQuantityNeeded
            }`
        );

        if (inventoryItem.currentStock < convertedQuantityNeeded) {
            const errorMsg = `${inventoryItem.name}: المطلوب ${convertedQuantityNeeded} ${inventoryItem.unit}، المتوفر ${inventoryItem.currentStock} ${inventoryItem.unit}`;
            console.error(`INSUFFICIENT STOCK: ${errorMsg}`);
            validationErrors.push(errorMsg);
        } else {
            console.log(`✓ Sufficient stock for ${inventoryItem.name}`);
        }
    }

    console.log("\n=== VALIDATION ERRORS ===");
    console.log(validationErrors);
    console.log("=== END INVENTORY VALIDATION ===\n");

    return validationErrors;
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
    try {
        const { status, tableNumber, page = 1, limit = 10, date } = req.query;

        const query = {};
        if (status) query.status = status;
        if (tableNumber) query.tableNumber = tableNumber;
        query.organization = req.user.organization;

        // Filter by date if provided
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);

            query.createdAt = {
                $gte: startDate,
                $lt: endDate,
            };
        }

        const orders = await Order.find(query)
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .populate("bill")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            count: orders.length,
            total,
            data: orders,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلبات",
            error: error.message,
        });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        })
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .populate("bill");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلب",
            error: error.message,
        });
    }
};

// دالة لحساب التكلفة الإجمالية للطلب
const calculateOrderTotalCost = async (orderItems) => {
    let totalCost = 0;
    const InventoryItem = (await import("../models/InventoryItem.js")).default;

    console.log("💰 === حساب التكلفة الإجمالية ===");
    console.log("عناصر الطلب المدخلة:", JSON.stringify(orderItems, null, 2));

    // استخدام نفس منطق جمع المكونات المتشابهة
    const inventoryNeeded = await calculateTotalInventoryNeeded(orderItems);

    console.log("المكونات المطلوبة:", Array.from(inventoryNeeded.entries()));

    if (inventoryNeeded.size === 0) {
        console.log("⚠️ تحذير: لا توجد مكونات مطلوبة!");
        return totalCost;
    }

    for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (inventoryItem) {
            // تحويل الكمية المطلوبة من وحدة المكون إلى وحدة المخزون
            const convertedQuantityNeeded = convertQuantity(
                quantity,
                unit,
                inventoryItem.unit
            );

            // حساب التكلفة لهذا المكون
            const ingredientCost =
                (inventoryItem.cost || 0) * convertedQuantityNeeded;
            totalCost += ingredientCost;

            console.log(
                `    ${inventoryItem.name}: ${convertedQuantityNeeded} ${
                    inventoryItem.unit
                } × ${inventoryItem.cost || 0} = ${ingredientCost}`
            );

            // تحقق من قيمة التكلفة
            if (
                inventoryItem.cost === undefined ||
                inventoryItem.cost === null ||
                inventoryItem.cost === 0
            ) {
                console.log(
                    `    ⚠️ تحذير: ${inventoryItem.name} لا يحتوي على قيمة تكلفة صحيحة (${inventoryItem.cost})`
                );
            }
        } else {
            console.log(
                `    ❌ خطأ: لم يتم العثور على عنصر المخزون ${inventoryItemId}`
            );
        }
    }

    console.log(`💰 التكلفة الإجمالية: ${totalCost}`);
    console.log("=== نهاية حساب التكلفة ===\n");

    return totalCost;
};

// دالة مساعدة للتحقق من قيم التكلفة في عناصر المخزون
const checkInventoryCosts = async () => {
    const InventoryItem = (await import("../models/InventoryItem.js")).default;
    const items = await InventoryItem.find({});

    console.log("🔍 === فحص قيم التكلفة في عناصر المخزون ===");
    let itemsWithoutCost = 0;
    let totalItems = items.length;

    console.log(`📊 إجمالي عناصر المخزون: ${totalItems}`);

    for (const item of items) {
        if (item.cost === undefined || item.cost === null || item.cost === 0) {
            console.log(
                `    ⚠️ ${item.name}: لا يحتوي على قيمة تكلفة (${item.cost})`
            );
            itemsWithoutCost++;
        } else {
            console.log(`    ✅ ${item.name}: تكلفة = ${item.cost}`);
        }
    }

    console.log(
        `📊 إجمالي العناصر بدون تكلفة: ${itemsWithoutCost} من ${totalItems}`
    );
    
    if (itemsWithoutCost > 0) {
        console.log("🚨 تحذير: يجب تحديث قيم التكلفة في عناصر المخزون!");
    }
    
    console.log("=== نهاية فحص التكلفة ===\n");

    return itemsWithoutCost;
};

// دالة مشتركة لمعالجة عناصر الطلب (إنشاء وتعديل)
const processOrderItems = async (items, operation = 'create') => {
    try {
        console.log(`🔄 === بداية معالجة عناصر الطلب (${operation}) ===`);
        console.log("📦 عدد العناصر:", items.length);
        console.log("📦 العناصر:", JSON.stringify(items, null, 2));

        // حساب المخزون المطلوب لجميع الأصناف
        console.log("🧮 بداية حساب المخزون المطلوب...");
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);

        // حساب التكلفة الإجمالية
        console.log("💰 بداية حساب التكلفة الإجمالية...");
        const totalCost = await calculateOrderTotalCost(items);

        // التحقق من توفر المخزون
        console.log("✅ بداية التحقق من توفر المخزون...");
        const validationErrors = await validateInventoryAvailability(
            inventoryNeeded
        );

        console.log(`📊 === نتائج فحص المخزون في ${operation} الطلب ===`);
        console.log("عدد أخطاء التحقق:", validationErrors.length);
        console.log("أخطاء التحقق:", validationErrors);
        console.log("التكلفة الإجمالية:", totalCost);

        if (validationErrors.length > 0) {
            console.error(`❌ فشل فحص المخزون - تم منع ${operation} الطلب`);
            console.error("أخطاء التحقق:", validationErrors);
            return {
                success: false,
                status: 400,
                data: {
                    success: false,
                    message: `المخزون غير كافي ل${operation} الطلب - راجع التفاصيل أدناه`,
                    errors: validationErrors,
                    details: validationErrors.join(" | "),
                    inventoryErrors: validationErrors,
                }
            };
        }

        console.log(`✅ نجح فحص المخزون - متابعة ${operation} الطلب`);

        // معالجة العناصر وحساب المجاميع
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            if (item.menuItem) {
                const menuItem = await MenuItem.findById(item.menuItem);
                if (!menuItem) {
                    return {
                        success: false,
                        status: 400,
                        data: {
                            success: false,
                            message: `عنصر القائمة غير موجود: ${item.menuItem}`,
                        }
                    };
                }
                if (!menuItem.isAvailable) {
                    return {
                        success: false,
                        status: 400,
                        data: {
                            success: false,
                            message: `العنصر غير متاح: ${menuItem.name}`,
                        }
                    };
                }

                // Calculate item total
                const itemTotal = menuItem.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    menuItem: menuItem._id,
                    name: menuItem.name,
                    arabicName: menuItem.arabicName || menuItem.name,
                    price: menuItem.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: menuItem.preparationTime,
                });
            } else {
                // إذا لم يوجد menuItem، استخدم بيانات العنصر كما هي
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: item.preparationTime || 0,
                });
            }
        }

        return {
            success: true,
            data: {
                processedItems,
                subtotal,
                totalCost,
                inventoryNeeded
            }
        };

    } catch (error) {
        console.error(`❌ خطأ في معالجة عناصر الطلب (${operation}):`, error);
        return {
            success: false,
            status: 500,
            data: {
                success: false,
                message: `خطأ في ${operation} الطلب`,
                error: error.message,
            }
        };
    }
};

// @desc    Calculate inventory requirements and total cost for order items
// @route   POST /api/orders/calculate
// @access  Private
export const calculateOrderRequirements = async (req, res) => {
    try {
        const { items } = req.body;

        console.log("🔍 === بداية حساب متطلبات الطلب ===");
        console.log("بيانات الطلب المرسلة:", JSON.stringify(req.body, null, 2));

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error("❌ مصفوفة العناصر غير صحيحة");
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
        }

        console.log("📦 عدد العناصر:", items.length);
        console.log("📦 العناصر:", JSON.stringify(items, null, 2));

        // حساب المخزون المطلوب والتكلفة
        console.log("🧮 بداية حساب المخزون المطلوب...");
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);
        console.log("💰 بداية حساب التكلفة الإجمالية...");
        const totalCost = await calculateOrderTotalCost(items);

        // التحقق من توفر المخزون
        console.log("✅ بداية التحقق من توفر المخزون...");
        const validationErrors = await validateInventoryAvailability(
            inventoryNeeded
        );

        console.log("📊 عدد أخطاء التحقق:", validationErrors.length);
        console.log("📊 أخطاء التحقق:", validationErrors);

        // جلب تفاصيل المخزون المطلوب
        const InventoryItem = (await import("../models/InventoryItem.js"))
            .default;
        const inventoryDetails = [];

        for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
            const inventoryItem = await InventoryItem.findById(inventoryItemId);
            if (inventoryItem) {
                // تحويل الكمية المطلوبة من وحدة المكون إلى وحدة المخزون
                const convertedQuantityNeeded = convertQuantity(
                    quantity,
                    unit,
                    inventoryItem.unit
                );

                inventoryDetails.push({
                    inventoryItem: {
                        _id: inventoryItem._id,
                        name: inventoryItem.name,
                        unit: inventoryItem.unit,
                        currentStock: inventoryItem.currentStock,
                        cost: inventoryItem.cost,
                    },
                    requiredQuantity: convertedQuantityNeeded,
                    isAvailable:
                        inventoryItem.currentStock >= convertedQuantityNeeded,
                    cost: (inventoryItem.cost || 0) * convertedQuantityNeeded,
                });
            }
        }

        // حساب الإحصائيات
        const totalRevenue = items.reduce((sum, item) => {
            if (item.menuItem) {
                return sum + (item.price || 0) * item.quantity;
            }
            return sum + (item.price || 0) * item.quantity;
        }, 0);

        const profit = totalRevenue - totalCost;
        const profitMargin =
            totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        const response = {
            success: true,
            data: {
                inventoryRequirements: inventoryDetails,
                totalCost,
                totalRevenue,
                profit,
                profitMargin,
                isInventoryAvailable: inventoryDetails.every(
                    (item) => item.isAvailable
                ),
                validationErrors: validationErrors,
            },
        };

        console.log("📤 === بيانات الاستجابة ===");
        console.log("النجاح:", response.success);
        console.log("المخزون متوفر:", response.data.isInventoryAvailable);
        console.log("عدد أخطاء التحقق:", response.data.validationErrors.length);
        console.log("التكلفة الإجمالية:", response.data.totalCost);
        console.log("الإيرادات الإجمالية:", response.data.totalRevenue);
        console.log("الربح:", response.data.profit);
        console.log("=== نهاية حساب متطلبات الطلب ===\n");

        res.json(response);
    } catch (error) {
        console.error("Error in calculateOrderRequirements:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في حساب متطلبات الطلب",
            error: error.message,
        });
    }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
    try {
        const { tableNumber, customerName, customerPhone, items, notes, bill } =
            req.body;

        console.log("🚀 === بداية إنشاء الطلب ===");
        console.log("بيانات الطلب المرسلة:", JSON.stringify(req.body, null, 2));

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error("❌ مصفوفة العناصر غير صحيحة");
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
        }

        console.log("📦 عدد العناصر:", items.length);
        console.log("📦 العناصر:", JSON.stringify(items, null, 2));

        // حساب المخزون المطلوب لجميع الأصناف
        console.log("🧮 === بداية فحص المخزون في إنشاء الطلب ===");
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);

        // التحقق من توفر المخزون
        console.log("✅ بداية التحقق من توفر المخزون...");
        const validationErrors = await validateInventoryAvailability(
            inventoryNeeded
        );

        console.log("📊 === نتائج فحص المخزون في إنشاء الطلب ===");
        console.log("عدد أخطاء التحقق:", validationErrors.length);
        console.log("أخطاء التحقق:", validationErrors);

        if (validationErrors.length > 0) {
            console.error("❌ فشل فحص المخزون - تم منع إنشاء الطلب");
            console.error("أخطاء التحقق:", validationErrors);
            return res.status(400).json({
                success: false,
                message: "المخزون غير كافي لإنشاء الطلب - راجع التفاصيل أدناه",
                errors: validationErrors,
                details: validationErrors.join(" | "),
                inventoryErrors: validationErrors,
            });
        }

        console.log("✅ نجح فحص المخزون - متابعة إنشاء الطلب");

        // Process items and calculate totals
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            if (item.menuItem) {
                const menuItem = await MenuItem.findById(item.menuItem);
                if (!menuItem) {
                    return res.status(400).json({
                        success: false,
                        message: `عنصر القائمة غير موجود: ${item.menuItem}`,
                    });
                }
                if (!menuItem.isAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `العنصر غير متاح: ${menuItem.name}`,
                    });
                }

                // Calculate item total
                const itemTotal = menuItem.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    menuItem: menuItem._id,
                    name: menuItem.name,
                    arabicName: menuItem.arabicName || menuItem.name,
                    price: menuItem.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: menuItem.preparationTime,
                });
            } else {
                // إذا لم يوجد menuItem، استخدم بيانات العنصر كما هي
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: item.preparationTime || 0,
                });
            }
        }

        // Create order
        const orderData = {
            tableNumber,
            customerName,
            customerPhone,
            items: processedItems,
            subtotal,
            finalAmount: subtotal, // No discount initially
            notes,
            bill,
            createdBy: req.user.id,
            organization: req.user.organization,
        };

        // حساب التكلفة الإجمالية للطلب
        const totalCost = await calculateOrderTotalCost(items);
        orderData.totalCost = totalCost;

        // Manual calculation as fallback
        orderData.finalAmount = orderData.subtotal - (orderData.discount || 0);

        // Generate order number manually
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await Order.countDocuments({
            createdAt: {
                $gte: new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                ),
                $lt: new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate() + 1
                ),
            },
        });
        orderData.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(
            3,
            "0"
        )}`;

        console.log("=== CREATING ORDER WITH DATA ===");
        console.log("Order data:", JSON.stringify(orderData, null, 2));

        const order = new Order(orderData);

        await order.save();

        console.log("✅ ORDER CREATED SUCCESSFULLY");
        console.log("Order ID:", order._id);

        // Populate the order with related data for response
        const populatedOrder = await Order.findById(order._id)
            .populate("createdBy", "name")
            .populate("bill")
            .populate("items.menuItem");

        // Add order to bill if bill exists
        if (bill) {
            try {
                const billDoc = await Bill.findById(bill);
                if (billDoc) {
                    billDoc.orders.push(order._id);
                    await billDoc.save();

                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                }
            } catch (error) {
                //
            }
        }

        // Create notification for new order
        try {
            await NotificationService.createOrderNotification(
                "created",
                populatedOrder,
                req.user._id
            );
        } catch (notificationError) {
            //
        }

        console.log("✅ تم إنشاء الطلب بنجاح - معرف الطلب:", order._id);

        res.status(201).json({
            success: true,
            message: "تم إنشاء الطلب بنجاح",
            data: populatedOrder,
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: "بيانات الطلب غير صحيحة",
                errors,
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الطلب",
            error: error.message,
        });
    }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = async (req, res) => {
    try {
        const { status, notes, preparedBy, deliveredBy, items } = req.body;

        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // إذا تم تحديث العناصر، تحقق من المخزون
        let calculatedTotalCost = 0; // متغير لتخزين التكلفة المحسوبة

        // فحص قيم التكلفة في عناصر المخزون للتشخيص
        await checkInventoryCosts();

        // حساب التكلفة الإجمالية دائماً (حتى لو لم يتم تمرير items)
        if (items && Array.isArray(items) && items.length > 0) {
            console.log("🔄 === بداية فحص المخزون في تعديل الطلب ===");
            console.log("العناصر المحدثة:", JSON.stringify(items, null, 2));

            // حساب المخزون المطلوب لجميع الأصناف
            const inventoryNeeded = await calculateTotalInventoryNeeded(items);

            // حساب التكلفة الإجمالية
            console.log("💰 بداية حساب التكلفة الإجمالية...");
            calculatedTotalCost = await calculateOrderTotalCost(items);

            // التحقق من توفر المخزون
            console.log("✅ بداية التحقق من توفر المخزون...");
            const validationErrors = await validateInventoryAvailability(
                inventoryNeeded
            );

            console.log("📊 === نتائج فحص المخزون في تعديل الطلب ===");
            console.log("عدد أخطاء التحقق:", validationErrors.length);
            console.log("أخطاء التحقق:", validationErrors);
            console.log("التكلفة الإجمالية:", calculatedTotalCost);

            if (validationErrors.length > 0) {
                console.error("❌ فشل فحص المخزون - تم منع تعديل الطلب");
                console.error("أخطاء التحقق:", validationErrors);
                return res.status(400).json({
                    success: false,
                    message:
                        "المخزون غير كافي لتعديل الطلب - راجع التفاصيل أدناه",
                    errors: validationErrors,
                    details: validationErrors.join(" | "),
                    inventoryErrors: validationErrors,
                });
            }

            console.log("✅ نجح فحص المخزون - متابعة تعديل الطلب");
        } else {
            // حساب التكلفة من عناصر الطلب الحالية إذا لم يتم تمرير items
            console.log("💰 === حساب التكلفة من عناصر الطلب الحالية ===");
            console.log(
                "عناصر الطلب الحالية:",
                JSON.stringify(order.items, null, 2)
            );

            const currentItems = order.items.map((item) => ({
                menuItem: item.menuItem,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                notes: item.notes,
            }));

            console.log(
                "عناصر الطلب المحولة:",
                JSON.stringify(currentItems, null, 2)
            );

            calculatedTotalCost = await calculateOrderTotalCost(currentItems);
            console.log(
                "💰 التكلفة المحسوبة من العناصر الحالية:",
                calculatedTotalCost
            );
        }

        // Update fields
        if (status) {
            order.status = status;
            if (status === "preparing" && preparedBy) {
                order.preparedBy = preparedBy;
            } else if (status === "delivered" && deliveredBy) {
                order.deliveredBy = deliveredBy;
            }
        }

        if (notes !== undefined) order.notes = notes;

        // تحديث أصناف الطلب بالكامل (إضافة/تعديل/حذف)
        if (Array.isArray(items)) {
            // 1. تحديث أو إضافة الأصناف
            for (let i = 0; i < items.length; i++) {
                const updatedItem = items[i];
                let orderItem = null;
                if (updatedItem.menuItem) {
                    orderItem = order.items.find(
                        (item) =>
                            item.menuItem?.toString() ===
                            updatedItem.menuItem.toString()
                    );
                } else {
                    orderItem = order.items.find(
                        (item) => item.name === updatedItem.name
                    );
                }
                if (orderItem) {
                    // تحديث الكمية والملاحظات
                    const newQuantity = Math.max(
                        updatedItem.quantity,
                        orderItem.preparedCount || 0
                    );
                    orderItem.quantity = newQuantity;
                    orderItem.notes =
                        updatedItem.notes !== undefined
                            ? updatedItem.notes
                            : orderItem.notes;
                    orderItem.price = updatedItem.price;
                    orderItem.name = updatedItem.name;
                    orderItem.menuItem = updatedItem.menuItem;
                    // أعد حساب itemTotal
                    orderItem.itemTotal = orderItem.price * orderItem.quantity;
                } else {
                    // إضافة صنف جديد
                    if (updatedItem.menuItem) {
                        const menuItem = await MenuItem.findById(
                            updatedItem.menuItem
                        );
                        if (!menuItem) {
                            return res.status(400).json({
                                success: false,
                                message: `عنصر القائمة غير موجود: ${updatedItem.menuItem}`,
                            });
                        }
                        if (!menuItem.isAvailable) {
                            return res.status(400).json({
                                success: false,
                                message: `العنصر غير متاح: ${menuItem.name}`,
                            });
                        }

                        const itemTotal = menuItem.price * updatedItem.quantity;
                        order.items.push({
                            menuItem: menuItem._id,
                            name: menuItem.name,
                            arabicName: menuItem.arabicName || menuItem.name,
                            price: menuItem.price,
                            quantity: updatedItem.quantity,
                            itemTotal,
                            notes: updatedItem.notes,
                            preparationTime: menuItem.preparationTime,
                        });
                    } else {
                        const itemTotal =
                            updatedItem.price * updatedItem.quantity;
                        order.items.push({
                            name: updatedItem.name,
                            price: updatedItem.price,
                            quantity: updatedItem.quantity,
                            itemTotal,
                            notes: updatedItem.notes,
                            preparationTime: updatedItem.preparationTime || 0,
                        });
                    }
                }
            }

            // 2. إعادة حساب المجموع
            order.subtotal = order.items.reduce(
                (sum, item) => sum + item.itemTotal,
                0
            );
            order.finalAmount = order.subtotal - (order.discount || 0);

            // حساب التكلفة الإجمالية للطلب
            if (calculatedTotalCost > 0) {
                order.totalCost = calculatedTotalCost;
                console.log(
                    "💰 تم تحديث التكلفة الإجمالية في الطلب:",
                    calculatedTotalCost
                );
            } else if (items && Array.isArray(items) && items.length > 0) {
                const totalCost = await calculateOrderTotalCost(items);
                order.totalCost = totalCost;
                console.log("💰 تم حساب التكلفة الإجمالية للطلب:", totalCost);
            } else {
                // حساب التكلفة من عناصر الطلب الحالية
                const currentItems = order.items.map((item) => ({
                    menuItem: item.menuItem,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    notes: item.notes,
                }));
                const totalCost = await calculateOrderTotalCost(currentItems);
                order.totalCost = totalCost;
                console.log(
                    "💰 تم حساب التكلفة الإجمالية من عناصر الطلب الحالية:",
                    totalCost
                );
            }
        }

        await order.save();

        console.log("💰 التكلفة النهائية المحفوظة في الطلب:", order.totalCost);

        // Populate the order with related data for response
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        console.log("💰 التكلفة في الطلب المحدث:", updatedOrder.totalCost);

        // Update bill totals if order is linked to a bill
        if (order.bill) {
            try {
                const billDoc = await Bill.findById(order.bill);
                if (billDoc) {
                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                }
            } catch (error) {
                //
            }
        }

        res.json({
            success: true,
            message: "تم تحديث الطلب بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الطلب",
            error: error.message,
        });
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // Only allow deletion if order is pending
        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف طلب تم البدء في تحضيره",
            });
        }

        // استرداد المخزون إذا كان الطلب يحتوي على عناصر مجهزة
        try {
            const MenuItem = (await import("../models/MenuItem.js")).default;
            const InventoryItem = (await import("../models/InventoryItem.js"))
                .default;

            // دالة لتحويل الوحدات

            for (const item of order.items) {
                if (
                    item.preparedCount &&
                    item.preparedCount > 0 &&
                    item.menuItem
                ) {
                    const menuItem = await MenuItem.findById(item.menuItem);
                    if (
                        menuItem &&
                        menuItem.ingredients &&
                        menuItem.ingredients.length > 0
                    ) {
                        for (const ingredient of menuItem.ingredients) {
                            const inventoryItem = await InventoryItem.findById(
                                ingredient.item
                            );
                            if (inventoryItem) {
                                // حساب الكمية المستردة مع التحويل
                                const quantityToRestore =
                                    convertQuantity(
                                        ingredient.quantity,
                                        ingredient.unit,
                                        inventoryItem.unit
                                    ) * item.preparedCount;

                                // استرداد المخزون
                                await inventoryItem.addStockMovement(
                                    "in",
                                    quantityToRestore,
                                    `استرداد من حذف طلب رقم ${order.orderNumber}`,
                                    req.user._id,
                                    order._id.toString()
                                );
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error restoring inventory:", error);
            // لا نوقف عملية الحذف إذا فشل استرداد المخزون
        }

        // Remove order from bill.orders if linked to a bill
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const orderIdStr = order._id.toString();
            let billDoc = await Bill.findById(order.bill); // بدون populate
            if (billDoc) {
                billDoc.orders = billDoc.orders.filter(
                    (id) => id.toString() !== orderIdStr
                );
                await billDoc.save();
            }
        }

        await order.deleteOne();

        res.json({
            success: true,
            message: "تم حذف الطلب بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الطلب",
            error: error.message,
        });
    }
};

// @desc    Get pending orders
// @route   GET /api/orders/pending
// @access  Private
export const getPendingOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $in: ["pending", "preparing"] },
            organization: req.user.organization,
        })
            .populate("items.menuItem", "name arabicName preparationTime")
            .populate("bill", "billNumber customerName tableNumber")
            .populate("createdBy", "name")
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            data: orders,
            count: orders.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلبات المعلقة",
            error: error.message,
        });
    }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
export const getOrderStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const filter = {};
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" },
                },
            },
        ]);

        const totalOrders = await Order.countDocuments(filter);
        const totalAmount = await Order.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]);

        res.json({
            success: true,
            data: {
                stats,
                totalOrders,
                totalAmount: totalAmount[0]?.total || 0,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات الطلبات",
            error: error.message,
        });
    }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (order.status === "delivered") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إلغاء طلب مسلم",
            });
        }

        order.status = "cancelled";
        if (reason) {
            order.notes = order.notes
                ? `${order.notes}\nسبب الإلغاء: ${reason}`
                : `سبب الإلغاء: ${reason}`;
        }
        // إزالة ربط الطلب من الفاتورة وتحديث الفاتورة
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const billDoc = await Bill.findById(order.bill); // بدون populate
            if (billDoc) {
                await Bill.updateOne(
                    { _id: order.bill },
                    { $pull: { orders: order._id } }
                );
                const billDocAfter = await Bill.findById(order.bill);
                if (billDocAfter) {
                    await billDocAfter.calculateSubtotal();
                    await billDocAfter.save();
                }
                order.bill = undefined;
            }
        }
        await order.save();

        res.json({
            success: true,
            message: "تم إلغاء الطلب بنجاح",
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إلغاء الطلب",
            error: error.message,
        });
    }
};

// @desc    Update order item status
// @route   PATCH /api/orders/:id/items/:itemIndex/status
// @access  Private
export const updateOrderItemStatus = async (req, res) => {
    try {
        const { id, itemIndex } = req.params;
        const { isReady } = req.body;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (itemIndex < 0 || itemIndex >= order.items.length) {
            return res.status(400).json({
                success: false,
                message: "فهرس العنصر غير صحيح",
            });
        }

        order.items[itemIndex].isReady = isReady;
        if (isReady) {
            order.items[itemIndex].readyTime = new Date();
        }

        // Check if all items are ready
        const allItemsReady = order.items.every((item) => item.isReady);
        if (allItemsReady && order.status === "preparing") {
            order.status = "ready";
            order.actualReadyTime = new Date();
        }

        await order.save();

        res.json({
            success: true,
            message: "تم تحديث حالة العنصر بنجاح",
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة العنصر",
            error: error.message,
        });
    }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "حالة الطلب مطلوبة",
            });
        }

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // تحقق قبل السماح بتغيير الحالة إلى delivered
        if (status === "delivered") {
            // يجب أن تكون كل الأصناف تم تجهيزها بالكامل (preparedCount === quantity)
            const allItemsReady = order.items.every(
                (item) => (item.preparedCount || 0) >= (item.quantity || 0)
            );
            if (!allItemsReady) {
                return res.status(400).json({
                    success: false,
                    message:
                        "لا يمكن تسليم الطلب إلا بعد تجهيز جميع الأصناف بالكامل.",
                });
            }
        }

        const updateData = { status };

        // Set preparedBy when status changes to preparing
        if (status === "preparing" && order.status === "pending") {
            updateData.preparedBy = req.user.id;
        }

        // Set deliveredBy when status changes to delivered
        if (status === "delivered" && order.status !== "delivered") {
            updateData.deliveredBy = req.user.id;
            updateData.deliveredTime = new Date();
        }

        // استرداد المخزون عند إلغاء الطلب
        if (status === "cancelled" && order.status !== "cancelled") {
            try {
                const MenuItem = (await import("../models/MenuItem.js"))
                    .default;
                const InventoryItem = (
                    await import("../models/InventoryItem.js")
                ).default;

                // دالة لتحويل الوحدات

                for (const item of order.items) {
                    if (
                        item.preparedCount &&
                        item.preparedCount > 0 &&
                        item.menuItem
                    ) {
                        const menuItem = await MenuItem.findById(item.menuItem);
                        if (
                            menuItem &&
                            menuItem.ingredients &&
                            menuItem.ingredients.length > 0
                        ) {
                            for (const ingredient of menuItem.ingredients) {
                                const inventoryItem =
                                    await InventoryItem.findById(
                                        ingredient.item
                                    );
                                if (inventoryItem) {
                                    // حساب الكمية المستردة مع التحويل
                                    const quantityToRestore =
                                        convertQuantity(
                                            ingredient.quantity,
                                            ingredient.unit,
                                            inventoryItem.unit
                                        ) * item.preparedCount;

                                    // استرداد المخزون
                                    await inventoryItem.addStockMovement(
                                        "in",
                                        quantityToRestore,
                                        `استرداد من إلغاء طلب رقم ${order.orderNumber}`,
                                        req.user._id,
                                        order._id.toString()
                                    );
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(
                    "Error restoring inventory on cancellation:",
                    error
                );
                // لا نوقف عملية الإلغاء إذا فشل استرداد المخزون
            }
        }

        const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // التحقق من أن الأصناف تم تحديثها بشكل صحيح
        if (status === "delivered" && updatedOrder) {
        }

        // Create notification for order status change
        try {
            if (status === "ready") {
                await NotificationService.createOrderNotification(
                    "ready",
                    updatedOrder,
                    req.user._id
                );
            } else if (status === "cancelled") {
                await NotificationService.createOrderNotification(
                    "cancelled",
                    updatedOrder,
                    req.user._id
                );
            }
        } catch (notificationError) {
            //
        }

        res.json({
            success: true,
            message: "تم تحديث حالة الطلب بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة الطلب",
            error: error.message,
        });
    }
};

// @desc    Update preparedCount for an item in an order
// @route   PUT /api/orders/:orderId/item/:itemIndex/prepared
// @access  Private
export const updateOrderItemPrepared = async (req, res) => {
    try {
        const { orderId, itemIndex } = req.params;
        const { preparedCount } = req.body;

        const order = await Order.findOne({
            _id: orderId,
            organization: req.user.organization,
        });
        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "الطلب غير موجود" });
        }

        if (!order.items[itemIndex]) {
            return res
                .status(404)
                .json({ success: false, message: "العنصر غير موجود في الطلب" });
        }

        const currentItem = order.items[itemIndex];
        const previousPreparedCount = currentItem.preparedCount || 0;
        const newPreparedCount = Math.max(
            0,
            Math.min(preparedCount, currentItem.quantity)
        );

        // حساب الكمية المضافة (الفرق بين الجديد والقديم)
        const addedQuantity = newPreparedCount - previousPreparedCount;

        // خصم المخزون إذا تم إضافة كمية جديدة
        if (addedQuantity > 0 && currentItem.menuItem) {
            try {
                const MenuItem = (await import("../models/MenuItem.js"))
                    .default;
                const InventoryItem = (
                    await import("../models/InventoryItem.js")
                ).default;

                // دالة لتحويل الوحدات

                const menuItem = await MenuItem.findById(currentItem.menuItem);

                if (
                    menuItem &&
                    menuItem.ingredients &&
                    menuItem.ingredients.length > 0
                ) {
                    for (const ingredient of menuItem.ingredients) {
                        const inventoryItem = await InventoryItem.findById(
                            ingredient.item
                        );

                        if (inventoryItem) {
                            // حساب الكمية المطلوبة خصمها مع التحويل
                            const quantityToDeduct =
                                convertQuantity(
                                    ingredient.quantity,
                                    ingredient.unit,
                                    inventoryItem.unit
                                ) * addedQuantity;

                            // التحقق من توفر المخزون
                            if (inventoryItem.currentStock < quantityToDeduct) {
                                return res.status(400).json({
                                    success: false,
                                    message: `المخزون غير كافي لـ ${inventoryItem.name}. المطلوب: ${quantityToDeduct} ${inventoryItem.unit}، المتوفر: ${inventoryItem.currentStock} ${inventoryItem.unit}`,
                                });
                            }

                            // خصم المخزون
                            await inventoryItem.addStockMovement(
                                "out",
                                quantityToDeduct,
                                `استهلاك لتحضير ${currentItem.name} - طلب رقم ${order.orderNumber}`,
                                req.user._id,
                                order._id.toString()
                            );
                        }
                    }
                }
            } catch (error) {
                console.error("Error deducting inventory:", error);
                return res.status(500).json({
                    success: false,
                    message: "خطأ في خصم المخزون",
                    error: error.message,
                });
            }
        }

        // تحديث العدد الجاهز مع التأكد من عدم تجاوز الكمية المطلوبة
        order.items[itemIndex].preparedCount = newPreparedCount;

        // تحديث isReady و wasEverReady تلقائياً
        if (newPreparedCount >= order.items[itemIndex].quantity) {
            order.items[itemIndex].isReady = true;
            order.items[itemIndex].wasEverReady = true;
        }

        // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
        const allItemsReady = order.items.every((item) => item.isReady);
        const anyItemsPrepared = order.items.some(
            (item) => item.preparedCount > 0
        );

        if (allItemsReady && order.status !== "ready") {
            order.status = "ready";
            order.preparedAt = new Date();
            order.preparedBy = req.user._id;
        } else if (anyItemsPrepared && order.status === "pending") {
            order.status = "preparing";
            if (!order.preparedBy) {
                order.preparedBy = req.user._id;
            }
        }

        await order.save();

        // Populate the order with related data for response
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // Create notification for order status change
        try {
            if (order.status === "ready") {
                await NotificationService.createOrderNotification(
                    "ready",
                    updatedOrder,
                    req.user._id
                );
            }
        } catch (notificationError) {
            //
        }

        res.json({
            success: true,
            message: "تم تحديث عدد الأصناف الجاهزة بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث عدد الأصناف الجاهزة",
            error: error.message,
        });
    }
};

// @desc    Get today's orders statistics
// @route   GET /api/orders/today-stats
// @access  Private
export const getTodayOrdersStats = async (req, res) => {
    try {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
        const endOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
        );

        // Get all orders created today
        const todayOrders = await Order.find({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            organization: req.user.organization,
        }).select("finalAmount totalAmount status createdAt");

        // Calculate statistics
        const totalOrders = todayOrders.length;
        const totalSales = todayOrders
            .filter((order) => order.status !== "cancelled")
            .reduce(
                (sum, order) =>
                    sum + (order.finalAmount || order.totalAmount || 0),
                0
            );

        // Group by status
        const ordersByStatus = todayOrders.reduce((acc, order) => {
            const status = order.status;
            if (!acc[status]) {
                acc[status] = { count: 0, amount: 0 };
            }
            acc[status].count++;
            acc[status].amount += order.finalAmount || order.totalAmount || 0;
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                totalOrders,
                totalSales,
                ordersByStatus,
                date: today.toISOString().split("T")[0],
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات طلبات اليوم",
            error: error.message,
        });
    }
};

// @desc    Deliver specific item in order
// @route   PUT /api/orders/:id/deliver-item/:itemIndex
// @access  Private
export const deliverItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIndex } = req.params;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (!order.items || !order.items[itemIndex]) {
            return res.status(404).json({
                success: false,
                message: "الصنف غير موجود في الطلب",
            });
        }

        const item = order.items[itemIndex];
        const currentPreparedCount = item.preparedCount || 0;
        const requiredQuantity = item.quantity || 0;

        // حساب العدد المطلوب إضافته للوصول للكمية الكاملة
        const remainingToDeliver = requiredQuantity - currentPreparedCount;

        if (remainingToDeliver <= 0) {
            return res.status(400).json({
                success: false,
                message: `${item.name} تم تسليمه بالكامل بالفعل`,
            });
        }

        // تحديث preparedCount للصنف إلى الكمية الكاملة (تم تسليمه)
        item.preparedCount = requiredQuantity;

        // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
        const allItemsReady = order.items.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );

        if (allItemsReady && order.status !== "delivered") {
            // إذا تم تسليم جميع الأصناف، الطلب أصبح delivered
            order.status = "delivered";
            order.deliveredTime = new Date();
            order.deliveredBy = req.user.id;

            // تحديث الفاتورة المرتبطة إذا وجدت
            if (order.bill) {
                try {
                    const bill = await Bill.findById(order.bill);
                    if (bill) {
                        // إعادة حساب إجمالي الفاتورة
                        await bill.calculateSubtotal();
                    }
                } catch (error) {
                    //
                }
            }
        }

        await order.save();

        // Populate the order for response
        await order.populate(
            ["createdBy", "preparedBy", "deliveredBy"],
            "name"
        );

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyOrderUpdate("item-delivered", order);
        }

        res.json({
            success: true,
            message: `تم تسليم ${item.name} بنجاح (${remainingToDeliver} من ${requiredQuantity})`,
            data: order,
            deliveredItem: {
                name: item.name,
                previousCount: currentPreparedCount,
                newCount: requiredQuantity,
                deliveredAmount: remainingToDeliver,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تسليم الصنف",
            error: error.message,
        });
    }
};
