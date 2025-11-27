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
import Table from '../models/Table.js';

const debugMissingBills = async () => {
    try {
        console.log('🔍 بدء فحص الفواتير المفقودة...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // Get all bills
        const allBills = await Bill.find({})
            .populate('table')
            .populate('orders')
            .populate('sessions')
            .sort({ createdAt: -1 });

        console.log(`📊 إجمالي الفواتير في قاعدة البيانات: ${allBills.length}\n`);

        // Analyze each bill
        console.log('═'.repeat(80));
        console.log('تحليل تفصيلي لكل فاتورة:');
        console.log('═'.repeat(80));

        for (const bill of allBills) {
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasSessions = bill.sessions && bill.sessions.length > 0;
            const hasTable = bill.table != null;
            const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);

            // Check if this bill should be visible
            const shouldBeVisible = (hasOrders || hasSessions) && isUnpaid;

            console.log(`\n📋 الفاتورة: ${bill.billNumber}`);
            console.log(`   ID: ${bill._id}`);
            console.log(`   الحالة: ${bill.status}`);
            console.log(`   الإجمالي: ${bill.total} جنيه`);
            console.log(`   المدفوع: ${bill.paid} جنيه`);
            console.log(`   المتبقي: ${bill.remaining} جنيه`);
            console.log(`   نوع الفاتورة: ${bill.billType || 'غير محدد'}`);
            console.log(`   تاريخ الإنشاء: ${new Date(bill.createdAt).toLocaleString('ar-EG')}`);
            
            // Table info
            if (hasTable) {
                console.log(`   🪑 الطاولة: ${bill.table.number} (ID: ${bill.table._id})`);
            } else {
                console.log(`   ⚠️  الطاولة: غير مرتبطة`);
            }

            // Orders info
            if (hasOrders) {
                console.log(`   📦 الطلبات: ${bill.orders.length} طلب`);
                bill.orders.forEach((order, index) => {
                    console.log(`      ${index + 1}. ${order.orderNumber || order._id} - ${order.status}`);
                    if (order.table) {
                        const orderTableId = order.table._id || order.table.id || order.table;
                        console.log(`         الطاولة: ${order.table.number || orderTableId}`);
                    }
                });
            } else {
                console.log(`   📦 الطلبات: لا يوجد`);
            }

            // Sessions info
            if (hasSessions) {
                console.log(`   🎮 الجلسات: ${bill.sessions.length} جلسة`);
                bill.sessions.forEach((session, index) => {
                    console.log(`      ${index + 1}. ${session.deviceName} - ${session.status}`);
                });
            } else {
                console.log(`   🎮 الجلسات: لا يوجد`);
            }

            // Visibility analysis
            console.log(`\n   📊 تحليل الظهور:`);
            console.log(`      - يحتوي على طلبات: ${hasOrders ? '✓' : '✗'}`);
            console.log(`      - يحتوي على جلسات: ${hasSessions ? '✓' : '✗'}`);
            console.log(`      - مرتبط بطاولة: ${hasTable ? '✓' : '✗'}`);
            console.log(`      - غير مدفوع: ${isUnpaid ? '✓' : '✗'}`);
            console.log(`      - يجب أن يظهر: ${shouldBeVisible ? '✓ نعم' : '✗ لا'}`);

            // Reasons why it might not appear
            if (shouldBeVisible && !hasTable) {
                console.log(`\n   ⚠️  سبب عدم الظهور المحتمل: الفاتورة غير مرتبطة بطاولة`);
            }
            if (!hasOrders && !hasSessions) {
                console.log(`\n   ⚠️  سبب عدم الظهور: الفاتورة فارغة (لا طلبات ولا جلسات)`);
            }
            if (!isUnpaid) {
                console.log(`\n   ℹ️  الفاتورة مدفوعة أو ملغاة - لن تظهر في القائمة`);
            }

            console.log('─'.repeat(80));
        }

        // Summary of issues
        console.log('\n\n' + '═'.repeat(80));
        console.log('📊 ملخص المشاكل:');
        console.log('═'.repeat(80));

        const billsWithOrdersButNoTable = allBills.filter(b => 
            b.orders && b.orders.length > 0 && 
            !b.table &&
            ['draft', 'partial', 'overdue'].includes(b.status)
        );

        const billsWithSessionsButNoTable = allBills.filter(b => 
            b.sessions && b.sessions.length > 0 && 
            !b.table &&
            ['draft', 'partial', 'overdue'].includes(b.status)
        );

        const emptyUnpaidBills = allBills.filter(b => 
            (!b.orders || b.orders.length === 0) &&
            (!b.sessions || b.sessions.length === 0) &&
            ['draft', 'partial', 'overdue'].includes(b.status)
        );

        console.log(`\n❌ فواتير بها طلبات لكن بدون طاولة: ${billsWithOrdersButNoTable.length}`);
        if (billsWithOrdersButNoTable.length > 0) {
            billsWithOrdersButNoTable.forEach(b => {
                console.log(`   - ${b.billNumber} (${b.orders.length} طلب)`);
            });
        }

        console.log(`\n❌ فواتير بها جلسات لكن بدون طاولة: ${billsWithSessionsButNoTable.length}`);
        if (billsWithSessionsButNoTable.length > 0) {
            billsWithSessionsButNoTable.forEach(b => {
                console.log(`   - ${b.billNumber} (${b.sessions.length} جلسة)`);
            });
        }

        console.log(`\n⚠️  فواتير فارغة (بدون طلبات أو جلسات): ${emptyUnpaidBills.length}`);
        if (emptyUnpaidBills.length > 0) {
            emptyUnpaidBills.forEach(b => {
                console.log(`   - ${b.billNumber} (${b.status})`);
            });
        }

        // Check frontend filtering logic
        console.log('\n\n' + '═'.repeat(80));
        console.log('🖥️  محاكاة منطق الواجهة الأمامية:');
        console.log('═'.repeat(80));

        // Simulate frontend filtering (from Billing.tsx)
        const visibleBills = allBills.filter(bill => {
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasSessions = bill.sessions && bill.sessions.length > 0;
            
            if (!hasOrders && !hasSessions) {
                return false;
            }
            
            // Apply status filter (unpaid)
            const isUnpaid = bill.status === 'draft' || bill.status === 'partial' || bill.status === 'overdue';
            return isUnpaid;
        });

        console.log(`\n✓ الفواتير التي يجب أن تظهر في الواجهة: ${visibleBills.length}`);
        console.log(`✓ الفواتير الموجودة في قاعدة البيانات: ${allBills.length}`);
        console.log(`✗ الفواتير المفقودة: ${allBills.length - visibleBills.length}`);

        // List missing bills
        const missingBills = allBills.filter(b => !visibleBills.includes(b));
        if (missingBills.length > 0) {
            console.log(`\n📋 الفواتير التي لن تظهر في الواجهة:`);
            missingBills.forEach(b => {
                const hasOrders = b.orders && b.orders.length > 0;
                const hasSessions = b.sessions && b.sessions.length > 0;
                const reason = !hasOrders && !hasSessions ? 'فارغة' : 
                               b.status === 'paid' ? 'مدفوعة' :
                               b.status === 'cancelled' ? 'ملغاة' : 'غير معروف';
                console.log(`   - ${b.billNumber}: ${reason}`);
            });
        }

        console.log('\n' + '═'.repeat(80));
        console.log('💡 التوصيات:');
        console.log('═'.repeat(80));

        if (billsWithOrdersButNoTable.length > 0 || billsWithSessionsButNoTable.length > 0) {
            console.log('\n✅ قم بتشغيل script الإصلاح:');
            console.log('   node server/scripts/fixOrderBillLinking.js');
        }

        if (emptyUnpaidBills.length > 0) {
            console.log('\n⚠️  يوجد فواتير فارغة - يمكن حذفها أو إلغاؤها');
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
debugMissingBills();
