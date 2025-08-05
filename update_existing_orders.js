import mongoose from "mongoose";
import Order from "./server/models/Order.js";
import MenuItem from "./server/models/MenuItem.js";
import InventoryItem from "./server/models/InventoryItem.js";

// دالة لحساب التكلفة الإجمالية للطلب
const calculateOrderTotalCost = async (orderItems) => {
    let totalCost = 0;

    for (const item of orderItems) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (!menuItem) {
                console.error(`Menu item not found: ${item.menuItem}`);
                continue;
            }

            if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const inventoryItem = await InventoryItem.findById(
                        ingredient.item
                    );
                    if (!inventoryItem) {
                        console.error(
                            `Inventory item not found: ${ingredient.item}`
                        );
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

// دالة لتحديث الطلبات الموجودة
const updateExistingOrders = async () => {
    try {
        console.log("بداية تحديث الطلبات الموجودة...");

        // جلب جميع الطلبات التي لا تحتوي على totalCost أو totalCost = 0
        const orders = await Order.find({
            $or: [{ totalCost: { $exists: false } }, { totalCost: 0 }],
        });

        console.log(`تم العثور على ${orders.length} طلب للتحديث`);

        for (const order of orders) {
            console.log(`تحديث الطلب: ${order.orderNumber}`);

            // حساب التكلفة الإجمالية
            const totalCost = await calculateOrderTotalCost(order.items);

            // تحديث الطلب
            order.totalCost = totalCost;
            await order.save();

            console.log(
                `تم تحديث الطلب ${order.orderNumber} - التكلفة الإجمالية: ${totalCost}`
            );
        }

        console.log("تم تحديث جميع الطلبات بنجاح");
    } catch (error) {
        console.error("خطأ في تحديث الطلبات:", error);
    }
};

// تشغيل السكريبت
const runScript = async () => {
    try {
        // الاتصال بقاعدة البيانات
        await mongoose.connect("mongodb://localhost:27017/cafe_management", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("تم الاتصال بقاعدة البيانات");

        // تحديث الطلبات
        await updateExistingOrders();

        console.log("تم الانتهاء من السكريبت");
        process.exit(0);
    } catch (error) {
        console.error("خطأ في تشغيل السكريبت:", error);
        process.exit(1);
    }
};

runScript();
