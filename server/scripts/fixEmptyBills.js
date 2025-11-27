import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Session from '../models/Session.js';
import Table from '../models/Table.js';
import Logger from '../middleware/logger.js';

const fixEmptyBills = async () => {
    try {
        console.log('🔧 بدء إصلاح الفواتير الفارغة...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // Find unpaid bills with tables but no orders/sessions
        const emptyBills = await Bill.find({
            table: { $exists: true, $ne: null },
            status: { $in: ['draft', 'partial', 'overdue'] },
            $or: [
                { orders: { $exists: false } },
                { orders: { $size: 0 } },
                { orders: null }
            ]
        }).populate('table');

        console.log(`📊 عدد الفواتير الفارغة المرتبطة بطاولات: ${emptyBills.length}\n`);

        if (emptyBills.length === 0) {
            console.log('✅ لا توجد فواتير فارغة تحتاج إلى إصلاح!');
            return;
        }

        console.log('═'.repeat(80));
        console.log('🔍 فحص الفواتير الفارغة:');
        console.log('═'.repeat(80));

        let fixedCount = 0;
        let deletedCount = 0;

        for (const bill of emptyBills) {
            console.log(`\n📋 الفاتورة: ${bill.billNumber}`);
            console.log(`   الطاولة: ${bill.table?.number}`);
            console.log(`   الحالة: ${bill.status}`);

            // Search for orders that should belong to this bill
            // 1. Orders with the same table
            const ordersWithSameTable = await Order.find({
                table: bill.table._id,
                organization: bill.organization,
                $or: [
                    { bill: { $exists: false } },
                    { bill: null },
                    { bill: bill._id }
                ]
            });

            console.log(`   🔍 طلبات بنفس الطاولة: ${ordersWithSameTable.length}`);

            if (ordersWithSameTable.length > 0) {
                console.log(`   🔧 ربط ${ordersWithSameTable.length} طلب بالفاتورة...`);
                
                // Link orders to bill
                for (const order of ordersWithSameTable) {
                    order.bill = bill._id;
                    await order.save();
                    
                    // Add order to bill.orders if not already there
                    if (!bill.orders) {
                        bill.orders = [];
                    }
                    if (!bill.orders.includes(order._id)) {
                        bill.orders.push(order._id);
                    }
                }

                await bill.save();
                
                // Recalculate bill totals
                await bill.calculateSubtotal();
                
                console.log(`   ✅ تم ربط الطلبات وإعادة حساب الإجمالي`);
                console.log(`   💰 الإجمالي الجديد: ${bill.total} جنيه`);
                
                fixedCount++;
            } else {
                // No orders found - check for sessions
                const sessionsWithSameTable = await Session.find({
                    table: bill.table._id,
                    organization: bill.organization,
                    $or: [
                        { bill: { $exists: false } },
                        { bill: null },
                        { bill: bill._id }
                    ]
                });

                console.log(`   🔍 جلسات بنفس الطاولة: ${sessionsWithSameTable.length}`);

                if (sessionsWithSameTable.length > 0) {
                    console.log(`   🔧 ربط ${sessionsWithSameTable.length} جلسة بالفاتورة...`);
                    
                    // Link sessions to bill
                    for (const session of sessionsWithSameTable) {
                        session.bill = bill._id;
                        await session.save();
                        
                        // Add session to bill.sessions if not already there
                        if (!bill.sessions) {
                            bill.sessions = [];
                        }
                        if (!bill.sessions.includes(session._id)) {
                            bill.sessions.push(session._id);
                        }
                    }

                    await bill.save();
                    
                    // Recalculate bill totals
                    await bill.calculateSubtotal();
                    
                    console.log(`   ✅ تم ربط الجلسات وإعادة حساب الإجمالي`);
                    console.log(`   💰 الإجمالي الجديد: ${bill.total} جنيه`);
                    
                    fixedCount++;
                } else {
                    // No orders or sessions found - delete or cancel the bill
                    console.log(`   ⚠️  لم يتم العثور على طلبات أو جلسات`);
                    console.log(`   🗑️  حذف الفاتورة الفارغة...`);
                    
                    // Update table status if this was the only bill
                    const otherBills = await Bill.countDocuments({
                        table: bill.table._id,
                        _id: { $ne: bill._id },
                        status: { $in: ['draft', 'partial', 'overdue'] }
                    });

                    if (otherBills === 0) {
                        const tableDoc = await Table.findById(bill.table._id);
                        if (tableDoc) {
                            tableDoc.status = 'empty';
                            await tableDoc.save();
                            console.log(`   ✅ تم تحديث حالة الطاولة إلى فارغة`);
                        }
                    }

                    await Bill.findByIdAndDelete(bill._id);
                    console.log(`   ✅ تم حذف الفاتورة`);
                    
                    deletedCount++;
                }
            }

            console.log('─'.repeat(80));
        }

        // Summary
        console.log(`\n\n${'═'.repeat(80)}`);
        console.log('📊 النتائج:');
        console.log('═'.repeat(80));
        console.log(`\n✅ فواتير تم إصلاحها (ربط بطلبات/جلسات): ${fixedCount}`);
        console.log(`🗑️  فواتير تم حذفها (فارغة تماماً): ${deletedCount}`);
        console.log(`📋 إجمالي الفواتير المعالجة: ${emptyBills.length}`);

        if (fixedCount > 0) {
            console.log(`\n✅ تم إصلاح ${fixedCount} فاتورة بنجاح!`);
            console.log(`💡 الآن يجب أن تظهر الطاولات كمحجوزة في الواجهة`);
            console.log(`💡 حدّث الصفحة (F5) لرؤية التغييرات`);
        }

        if (deletedCount > 0) {
            console.log(`\n🗑️  تم حذف ${deletedCount} فاتورة فارغة`);
            console.log(`💡 الطاولات المرتبطة بها أصبحت فارغة الآن`);
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
fixEmptyBills();
