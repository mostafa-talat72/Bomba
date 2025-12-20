import MenuItem from "../models/MenuItem.js";
import InventoryItem from "../models/InventoryItem.js";

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
        return quantity * conversionRate;
    } else {
        return quantity;
    }
};

// دالة مساعدة لحساب المخزون المطلوب لجميع الأصناف
const calculateTotalInventoryNeeded = async (orderItems) => {
    const inventoryNeeded = new Map(); // Map<inventoryItemId, { quantity, unit }>

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

    for (const item of orderItems) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem) {
                throw new Error(`عنصر القائمة غير موجود: ${item.menuItem}`);
            }
            if (!menuItem.isAvailable) {
                throw new Error(`العنصر غير متاح: ${menuItem.name}`);
            }

            if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const requiredQuantityForItem =
                        ingredient.quantity * item.quantity;
                    const existing = inventoryNeeded.get(ingredient.item);
                    if (existing) {
                        let totalQuantity;
                        if (existing.unit !== ingredient.unit) {
                            const existingConverted = convertQuantity(
                                existing.quantity,
                                existing.unit,
                                ingredient.unit
                            );
                            totalQuantity =
                                existingConverted + requiredQuantityForItem;
                        } else {
                            totalQuantity =
                                existing.quantity + requiredQuantityForItem;
                        }

                        inventoryNeeded.set(ingredient.item, {
                            quantity: totalQuantity,
                            unit: ingredient.unit,
                        });
                    } else {
                        inventoryNeeded.set(ingredient.item, {
                            quantity: requiredQuantityForItem,
                            unit: ingredient.unit,
                        });
                    }
                }
            }
        }
    }

    // تجميع العناصر المتشابهة مع وحدات مختلفة
    const consolidatedInventory = new Map();

    for (const [id, data] of inventoryNeeded) {
        const key = id.toString();
        if (consolidatedInventory.has(key)) {
            const existing = consolidatedInventory.get(key);

            let totalQuantity;
            if (existing.unit !== data.unit) {
                const converted = convertQuantity(
                    data.quantity,
                    data.unit,
                    existing.unit
                );
                totalQuantity = existing.quantity + converted;
            } else {
                totalQuantity = existing.quantity + data.quantity;
            }

            consolidatedInventory.set(key, {
                quantity: totalQuantity,
                unit: existing.unit,
            });
        } else {
            consolidatedInventory.set(key, data);
        }
    }

    // استبدال النتيجة الأصلية بالنتيجة المجمعة
    inventoryNeeded.clear();
    for (const [id, data] of consolidatedInventory) {
        inventoryNeeded.set(id, data);
    }

    // التحقق من أن جميع المكونات المتشابهة تم جمعها بشكل صحيح
    const finalInventoryNeeded = new Map();
    const processedItems = new Set(); // لتتبع العناصر المعالجة

    for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
        if (processedItems.has(inventoryItemId.toString())) {
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
                if (otherUnit !== baseUnit) {
                    const convertedQuantity = convertQuantity(
                        otherQuantity,
                        otherUnit,
                        baseUnit
                    );
                    totalQuantity += convertedQuantity;
                } else {
                    totalQuantity += otherQuantity;
                }
            }
        }

        finalInventoryNeeded.set(inventoryItemId, {
            quantity: totalQuantity,
            unit: baseUnit,
        });
        processedItems.add(inventoryItemId.toString());
    }

    return finalInventoryNeeded;
};

// دالة مساعدة للتحقق من توفر المخزون
const validateInventoryAvailability = async (inventoryNeeded) => {
    const validationErrors = [];
    const details = [];

    for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (!inventoryItem) {
            validationErrors.push(
                `الخامة ${inventoryItemId} غير موجودة في المخزون`
            );
            details.push({
                name: inventoryItemId,
                required: quantity,
                available: 0,
                unit,
            });
            continue;
        }

        // تحويل الكمية المطلوبة من وحدة المكون إلى وحدة المخزون
        const convertedQuantityNeeded = convertQuantity(
            quantity,
            unit,
            inventoryItem.unit
        );

        if (inventoryItem.currentStock < convertedQuantityNeeded) {
            const errorMsg = `${inventoryItem.name}: المطلوب ${convertedQuantityNeeded} ${inventoryItem.unit}، المتوفر ${inventoryItem.currentStock} ${inventoryItem.unit}`;
            validationErrors.push(errorMsg);
            details.push({
                name: inventoryItem.name,
                required: convertedQuantityNeeded,
                available: inventoryItem.currentStock,
                unit: inventoryItem.unit,
            });
        } else {
        }
    }

    return { errors: validationErrors, details };
};

// دالة مساعدة لحساب التكلفة الإجمالية للطلب
const calculateOrderTotalCost = async (orderItems) => {
    let totalCost = 0;

    for (const item of orderItems) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem) {
                continue;
            }

            if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const inventoryItem = await InventoryItem.findById(
                        ingredient.item
                    );
                    if (!inventoryItem) {
                        continue;
                    }

                    // حساب التكلفة لهذا المكون
                    const ingredientCost =
                        inventoryItem.cost *
                        ingredient.quantity *
                        item.quantity;

                    totalCost += ingredientCost;
                }
            }
        }
    }

    return totalCost;
};

// دالة مساعدة لفحص قيم التكلفة في عناصر المخزون
const checkInventoryCosts = async () => {
    const inventoryItems = await InventoryItem.find({});
};

// دالة مساعدة لمعالجة عناصر الطلب
const processOrderItems = async (items, operation = "create") => {
    try {
        // التحقق من صحة العناصر
        if (!items || !Array.isArray(items) || items.length === 0) {
            return {
                success: false,
                status: 400,
                data: {
                    success: false,
                    message: "يجب إضافة عنصر واحد على الأقل للطلب",
                },
            };
        }

        // حساب المخزون المطلوب
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);

        // التحقق من توفر المخزون
        const validationResult = await validateInventoryAvailability(
            inventoryNeeded
        );

        if (validationResult.errors.length > 0) {
            const errorMessage =
                operation === "create"
                    ? "المخزون غير كافي لإنشاء الطلب - راجع التفاصيل أدناه"
                    : "المخزون غير كافي لتحديث الطلب - راجع التفاصيل أدناه";

            return {
                success: false,
                status: 400,
                data: {
                    success: false,
                    message: errorMessage,
                    errors: validationResult.errors,
                    details: validationResult.details,
                    inventoryErrors: validationResult.errors,
                },
            };
        }

        // حساب التكلفة الإجمالية
        const totalCost = await calculateOrderTotalCost(items);

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
                        },
                    };
                }
                if (!menuItem.isAvailable) {
                    return {
                        success: false,
                        status: 400,
                        data: {
                            success: false,
                            message: `العنصر غير متاح: ${menuItem.name}`,
                        },
                    };
                }

                // حساب تكلفة العنصر
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
                inventoryNeeded,
            },
        };
    } catch (error) {
        return {
            success: false,
            status: 500,
            data: {
                success: false,
                message: "خطأ في معالجة عناصر الطلب",
                error: error.message,
            },
        };
    }
};

// رسائل الخطأ الموحدة
const createOrderErrorMessages = {
    invalidItems: "يجب إضافة عنصر واحد على الأقل للطلب",
    menuItemNotFound: (id) => `عنصر القائمة غير موجود: ${id}`,
    menuItemNotAvailable: (name) => `العنصر غير متاح: ${name}`,
    orderNotFound: "الطلب غير موجود",
    inventoryInsufficient: (errors) =>
        `المخزون غير كافي لإنشاء الطلب - راجع التفاصيل أدناه`,
    updateInventoryInsufficient: (errors) =>
        `المخزون غير كافي لتحديث الطلب - راجع التفاصيل أدناه`,
    createOrderError: "خطأ في إنشاء الطلب",
    updateOrderError: "خطأ في تحديث الطلب",
    validationError: "بيانات الطلب غير صحيحة",
};

// رسائل النجاح الموحدة
const createOrderSuccessMessages = {
    orderCreated: "تم إنشاء الطلب بنجاح",
    orderUpdated: "تم تحديث الطلب بنجاح",
};

export {
    convertQuantity,
    calculateTotalInventoryNeeded,
    validateInventoryAvailability,
    calculateOrderTotalCost,
    checkInventoryCosts,
    processOrderItems,
    createOrderErrorMessages,
    createOrderSuccessMessages,
};
