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
                    console.log(
                        `\n--- Processing ingredient: ${ingredient.item} ---`
                    );
                    console.log(
                        `Ingredient data: ${ingredient.quantity} ${ingredient.unit}`
                    );

                    const requiredQuantityForItem =
                        ingredient.quantity * item.quantity;
                    console.log(
                        `Required quantity for this item: ${requiredQuantityForItem} ${ingredient.unit}`
                    );

                    const existing = inventoryNeeded.get(ingredient.item);
                    if (existing) {
                        console.log(
                            `Found existing entry for ${ingredient.item}: ${existing.quantity} ${existing.unit}`
                        );

                        let totalQuantity;
                        if (existing.unit !== ingredient.unit) {
                            const existingConverted = convertQuantity(
                                existing.quantity,
                                existing.unit,
                                ingredient.unit
                            );
                            totalQuantity =
                                existingConverted + requiredQuantityForItem;
                            console.log(
                                `    Converting ${existing.quantity} ${existing.unit} to ${existingConverted} ${ingredient.unit}`
                            );
                            console.log(
                                `    Adding ${requiredQuantityForItem} ${ingredient.unit} = ${totalQuantity} ${ingredient.unit}`
                            );
                        } else {
                            totalQuantity =
                                existing.quantity + requiredQuantityForItem;
                            console.log(
                                `    Adding ${existing.quantity} + ${requiredQuantityForItem} = ${totalQuantity} ${ingredient.unit}`
                            );
                        }

                        inventoryNeeded.set(ingredient.item, {
                            quantity: totalQuantity,
                            unit: ingredient.unit,
                        });
                        console.log(
                            `    Updated total for ${ingredient.item}: ${totalQuantity} ${ingredient.unit}`
                        );
                    } else {
                        console.log(
                            `No existing entry for ${ingredient.item}, creating new entry`
                        );
                        inventoryNeeded.set(ingredient.item, {
                            quantity: requiredQuantityForItem,
                            unit: ingredient.unit,
                        });
                        console.log(
                            `    Created new entry for ${ingredient.item}: ${requiredQuantityForItem} ${ingredient.unit}`
                        );
                    }
                }
            } else {
                console.log(
                    `No ingredients found for menu item: ${menuItem.name}`
                );
            }
        } else {
            console.log(
                `Item ${item.name} has no menuItem, skipping inventory calculation`
            );
        }
    }

    // تجميع العناصر المتشابهة مع وحدات مختلفة
    console.log("\n=== CONSOLIDATING SIMILAR ITEMS ===");
    const consolidatedInventory = new Map();

    for (const [id, data] of inventoryNeeded) {
        const key = id.toString();
        if (consolidatedInventory.has(key)) {
            const existing = consolidatedInventory.get(key);
            console.log(
                `Found duplicate for ${key}: existing ${existing.quantity} ${existing.unit}, new ${data.quantity} ${data.unit}`
            );

            let totalQuantity;
            if (existing.unit !== data.unit) {
                const converted = convertQuantity(
                    data.quantity,
                    data.unit,
                    existing.unit
                );
                totalQuantity = existing.quantity + converted;
                console.log(
                    `    Converting ${data.quantity} ${data.unit} to ${converted} ${existing.unit}`
                );
                console.log(
                    `    Total: ${existing.quantity} + ${converted} = ${totalQuantity} ${existing.unit}`
                );
            } else {
                totalQuantity = existing.quantity + data.quantity;
                console.log(
                    `    Total: ${existing.quantity} + ${data.quantity} = ${totalQuantity} ${existing.unit}`
                );
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
    const details = [];

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
            details.push({
                name: inventoryItemId,
                required: quantity,
                available: 0,
                unit,
            });
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
            details.push({
                name: inventoryItem.name,
                required: convertedQuantityNeeded,
                available: inventoryItem.currentStock,
                unit: inventoryItem.unit,
            });
        } else {
            console.log(`✓ Sufficient stock for ${inventoryItem.name}`);
        }
    }

    console.log("\n=== VALIDATION ERRORS ===");
    console.log(validationErrors);
    console.log("=== END INVENTORY VALIDATION ===\n");

    return { errors: validationErrors, details };
};

// دالة مساعدة لحساب التكلفة الإجمالية للطلب
const calculateOrderTotalCost = async (orderItems) => {
    let totalCost = 0;

    console.log("=== STARTING TOTAL COST CALCULATION ===");
    console.log("Order items:", JSON.stringify(orderItems, null, 2));

    for (const item of orderItems) {
        console.log(`\n--- Processing item: ${item.name || "Unknown"} ---`);

        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem) {
                console.error(`Menu item not found: ${item.menuItem}`);
                continue;
            }

            console.log(`Found menu item: ${menuItem.name}`);
            console.log(
                `Menu item ingredients:`,
                JSON.stringify(menuItem.ingredients, null, 2)
            );

            if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    console.log(
                        `\n--- Processing ingredient: ${ingredient.item} ---`
                    );

                    const inventoryItem = await InventoryItem.findById(
                        ingredient.item
                    );
                    if (!inventoryItem) {
                        console.error(
                            `Inventory item not found: ${ingredient.item}`
                        );
                        continue;
                    }

                    console.log(`Found inventory item: ${inventoryItem.name}`);
                    console.log(
                        `Inventory item cost: ${inventoryItem.cost} per ${inventoryItem.unit}`
                    );

                    // حساب التكلفة لهذا المكون
                    const ingredientCost =
                        inventoryItem.cost *
                        ingredient.quantity *
                        item.quantity;
                    console.log(
                        `Ingredient cost: ${inventoryItem.cost} × ${ingredient.quantity} × ${item.quantity} = ${ingredientCost}`
                    );

                    totalCost += ingredientCost;
                    console.log(`Updated total cost: ${totalCost}`);
                }
            } else {
                console.log(
                    `No ingredients found for menu item: ${menuItem.name}`
                );
            }
        } else {
            console.log(
                `Item ${item.name} has no menuItem, skipping cost calculation`
            );
        }
    }

    console.log("=== FINAL TOTAL COST ===");
    console.log(`Total cost: ${totalCost}`);
    console.log("=== END TOTAL COST CALCULATION ===\n");

    return totalCost;
};

// دالة مساعدة لفحص قيم التكلفة في عناصر المخزون
const checkInventoryCosts = async () => {
    console.log("=== CHECKING INVENTORY COSTS ===");

    const inventoryItems = await InventoryItem.find({});
    console.log(`Found ${inventoryItems.length} inventory items`);

    for (const item of inventoryItems) {
        console.log(
            `${item.name}: ${item.cost} per ${item.unit} (Current stock: ${item.currentStock} ${item.unit})`
        );
    }

    console.log("=== END INVENTORY COSTS CHECK ===\n");
};

// دالة مساعدة لمعالجة عناصر الطلب
const processOrderItems = async (items, operation = "create") => {
    try {
        console.log(`=== STARTING ORDER ITEMS PROCESSING (${operation}) ===`);
        console.log("Items:", JSON.stringify(items, null, 2));

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

        console.log("=== PROCESSING RESULTS ===");
        console.log(
            "Processed items:",
            JSON.stringify(processedItems, null, 2)
        );
        console.log("Subtotal:", subtotal);
        console.log("Total cost:", totalCost);
        console.log("=== END ORDER ITEMS PROCESSING ===\n");

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
        console.error("Error in processOrderItems:", error);
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
