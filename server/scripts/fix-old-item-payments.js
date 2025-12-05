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
 * Script to fix itemPayments for existing bills
 * This will populate itemPayments for bills that don't have them or have incomplete data
 */
async function fixOldItemPayments() {
    try {
        console.log('🔄 جاري الاتصال بقاعدة البيانات...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

        // Find all bills that have orders
        const bills = await Bill.find({ 
            orders: { $exists: true, $ne: [] }
        }).populate('orders');

        console.log(`📋 تم العثور على ${bills.length} فاتورة تحتوي على طلبات\n`);

        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const bill of bills) {
            try {
                console.log(`\n📄 معالجة الفاتورة: ${bill.billNumber}`);
                console.log(`   - عدد الطلبات: ${bill.orders.length}`);
                console.log(`   - itemPayments الحالية: ${bill.itemPayments?.length || 0}`);

                // Get existing order IDs in itemPayments
                const existingOrderIds = new Set(
                    (bill.itemPayments || []).map(ip => ip.orderId?.toString()).filter(Boolean)
                );

                let addedItems = 0;
                let needsUpdate = false;

                // Process each order
                for (const order of bill.orders) {
                    const orderIdStr = order._id.toString();

                    // Skip if order already has itemPayments
                    if (existingOrderIds.has(orderIdStr)) {
                        console.log(`   ⏭️  الطلب ${order.orderNumber} موجود بالفعل في itemPayments`);
                        continue;
                    }

                    if (!order.items || order.items.length === 0) {
                        console.log(`   ⚠️  الطلب ${order.orderNumber} لا يحتوي على عناصر`);
                        continue;
                    }

                    console.log(`   ✓ إضافة ${order.items.length} عنصر من الطلب ${order.orderNumber}`);

                    // Initialize itemPayments if not exists
                    if (!bill.itemPayments) {
                        bill.itemPayments = [];
                    }

                    // Add items from this order
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

                        addedItems++;
                        needsUpdate = true;
                    });
                }

                if (needsUpdate) {
                    // Mark itemPayments as modified
                    bill.markModified('itemPayments');
                    
                    // Save without triggering the pre-save hook again
                    await bill.save({ validateBeforeSave: false });
                    
                    console.log(`   ✅ تم إضافة ${addedItems} عنصر جديد`);
                    fixedCount++;
                } else {
                    console.log(`   ⏭️  لا توجد تحديثات مطلوبة`);
                    skippedCount++;
                }

            } catch (error) {
                console.error(`   ❌ خطأ في معالجة الفاتورة ${bill.billNumber}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 ملخص العملية:');
        console.log(`   ✅ تم إصلاح: ${fixedCount} فاتورة`);
        console.log(`   ⏭️  تم تخطي: ${skippedCount} فاتورة`);
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

// Run the script
fixOldItemPayments();
