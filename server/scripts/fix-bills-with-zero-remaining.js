import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Script to fix bills with remaining = 0 but status is not 'paid'
 * These bills should be marked as 'paid'
 */
async function fixBillsWithZeroRemaining() {
    try {
        console.log('🔄 جاري الاتصال بقاعدة البيانات...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

        // Find all bills with remaining = 0 but status is not 'paid'
        const bills = await Bill.find({
            remaining: 0,
            status: { $ne: 'paid' }
        });

        console.log(`📋 تم العثور على ${bills.length} فاتورة بمتبقي = 0 وحالة غير مدفوعة\n`);

        let fixedCount = 0;
        let errorCount = 0;

        for (const bill of bills) {
            try {
                console.log(`\n📄 معالجة الفاتورة: ${bill.billNumber}`);
                console.log(`   - الحالة الحالية: ${bill.status}`);
                console.log(`   - المتبقي: ${bill.remaining}`);
                console.log(`   - المدفوع: ${bill.paid}`);
                console.log(`   - الإجمالي: ${bill.total}`);

                // Check if all items are paid
                let allItemsPaid = true;
                if (bill.itemPayments && bill.itemPayments.length > 0) {
                    for (const item of bill.itemPayments) {
                        const paidQty = item.paidQuantity || 0;
                        const totalQty = item.quantity || 0;
                        if (paidQty < totalQty) {
                            allItemsPaid = false;
                            console.log(`   ⚠️  العنصر "${item.itemName}" غير مدفوع بالكامل (${paidQty}/${totalQty})`);
                        }
                    }
                }

                // Check if all sessions are paid
                let allSessionsPaid = true;
                if (bill.sessionPayments && bill.sessionPayments.length > 0) {
                    for (const session of bill.sessionPayments) {
                        if (!session.isPaid) {
                            allSessionsPaid = false;
                            console.log(`   ⚠️  الجلسة غير مدفوعة`);
                        }
                    }
                }

                // If remaining is 0 and paid >= total, mark as paid
                if (bill.remaining === 0 || bill.paid >= bill.total) {
                    bill.status = 'paid';
                    
                    // Mark all items as paid if not already
                    if (bill.itemPayments && bill.itemPayments.length > 0) {
                        bill.itemPayments.forEach(item => {
                            if (item.paidQuantity < item.quantity) {
                                console.log(`   ✓ تحديث العنصر "${item.itemName}" ليصبح مدفوع بالكامل`);
                                item.paidQuantity = item.quantity;
                                item.paidAmount = item.totalPrice;
                                item.isPaid = true;
                            }
                        });
                    }

                    // Mark all sessions as paid if not already
                    if (bill.sessionPayments && bill.sessionPayments.length > 0) {
                        bill.sessionPayments.forEach(session => {
                            if (!session.isPaid) {
                                console.log(`   ✓ تحديث الجلسة لتصبح مدفوعة بالكامل`);
                                session.isPaid = true;
                                session.paidAmount = session.totalPrice;
                            }
                        });
                    }

                    // Mark modified fields
                    bill.markModified('itemPayments');
                    bill.markModified('sessionPayments');
                    bill.markModified('status');

                    // Save
                    await bill.save({ validateBeforeSave: false });
                    
                    console.log(`   ✅ تم تحديث الحالة إلى: paid`);
                    fixedCount++;
                } else {
                    console.log(`   ⏭️  الفاتورة لا تحتاج إلى تحديث`);
                }

            } catch (error) {
                console.error(`   ❌ خطأ في معالجة الفاتورة ${bill.billNumber}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 ملخص العملية:');
        console.log(`   ✅ تم إصلاح: ${fixedCount} فاتورة`);
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
fixBillsWithZeroRemaining();
