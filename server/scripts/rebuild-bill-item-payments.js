import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Script to rebuild itemPayments for a specific bill or all bills
 * Usage: node rebuild-bill-item-payments.js [billId]
 */
async function rebuildBillItemPayments(billId = null) {
    try {
        console.log('🔄 جاري الاتصال بقاعدة البيانات...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

        let bills;
        if (billId) {
            // Rebuild specific bill
            const bill = await Bill.findById(billId).populate('orders');
            if (!bill) {
                console.error(`❌ لم يتم العثور على الفاتورة: ${billId}`);
                process.exit(1);
            }
            bills = [bill];
            console.log(`📋 إعادة بناء itemPayments للفاتورة: ${bill.billNumber}\n`);
        } else {
            // Rebuild all bills
            bills = await Bill.find({ orders: { $exists: true, $ne: [] } }).populate('orders');
            console.log(`📋 إعادة بناء itemPayments لـ ${bills.length} فاتورة\n`);
        }

        let fixedCount = 0;
        let errorCount = 0;

        for (const bill of bills) {
            try {
                console.log(`\n📄 معالجة الفاتورة: ${bill.billNumber}`);
                console.log(`   - عدد الطلبات: ${bill.orders.length}`);

                // Clear existing itemPayments
                const oldItemPaymentsCount = bill.itemPayments?.length || 0;
                bill.itemPayments = [];

                // Rebuild itemPayments from orders
                let newItemsCount = 0;
                for (const order of bill.orders) {
                    if (!order.items || order.items.length === 0) {
                        console.log(`   ⚠️  الطلب ${order.orderNumber} لا يحتوي على عناصر`);
                        continue;
                    }

                    console.log(`   ✓ إضافة ${order.items.length} عنصر من الطلب ${order.orderNumber}`);

                    order.items.forEach((item, index) => {
                        const itemName = item.name || item.menuItem?.name || item.menuItem?.arabicName || "Unknown";
                        const price = item.price || 0;
                        const quantity = item.quantity || 1;
                        const addons = item.addons || [];

                        console.log(`     - ${itemName} (${price} جنيه × ${quantity})`);

                        bill.itemPayments.push({
                            orderId: order._id,
                            itemId: `${order._id}-${index}`,
                            itemName,
                            quantity,
                            paidQuantity: 0,
                            pricePerUnit: price,
                            totalPrice: price * quantity,
                            paidAmount: 0,
                            isPaid: false,
                            addons: addons,
                            paymentHistory: [],
                        });

                        newItemsCount++;
                    });
                }

                // Mark as modified and save
                bill.markModified('itemPayments');
                await bill.save({ validateBeforeSave: false });

                console.log(`   ✅ تم إعادة بناء itemPayments: ${oldItemPaymentsCount} → ${newItemsCount}`);
                fixedCount++;

            } catch (error) {
                console.error(`   ❌ خطأ في معالجة الفاتورة ${bill.billNumber}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 ملخص العملية:');
        console.log(`   ✅ تم إعادة البناء: ${fixedCount} فاتورة`);
        console.log(`   ❌ أخطاء: ${errorCount} فاتورة`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ خطأ في تنفيذ السكريبت:', error);
    } finally {
        await mongoose.connection.close();
        console.log('👋 تم إغلاق الاتصال بقاعدة البيانات');
        process.exit(0);
    }
}

// Get billId from command line arguments
const billId = process.argv[2];
rebuildBillItemPayments(billId);
