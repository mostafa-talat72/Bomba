import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Order from '../models/Order.js';
import Bill from '../models/Bill.js';
import Table from '../models/Table.js';

const checkOrderBillLinking = async () => {
    try {
        console.log('🔍 بدء فحص ربط الطلبات بالفواتير...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // 1. Check orders with bill reference
        console.log('📊 فحص الطلبات المرتبطة بفواتير:');
        console.log('═'.repeat(60));
        
        const ordersWithBill = await Order.find({ bill: { $exists: true, $ne: null } })
            .populate('bill')
            .populate('table');
        
        console.log(`\n✓ إجمالي الطلبات المرتبطة بفواتير: ${ordersWithBill.length}`);

        let correctlyLinked = 0;
        let missingInBillArray = 0;
        let missingBill = 0;

        for (const order of ordersWithBill) {
            if (!order.bill) {
                console.log(`\n⚠️  الطلب ${order.orderNumber}:`);
                console.log(`   - مرتبط بفاتورة غير موجودة`);
                console.log(`   - الطاولة: ${order.table?.number || 'غير محدد'}`);
                missingBill++;
                continue;
            }

            const bill = await Bill.findById(order.bill._id || order.bill);
            
            if (!bill) {
                console.log(`\n⚠️  الطلب ${order.orderNumber}:`);
                console.log(`   - مرتبط بفاتورة غير موجودة (${order.bill})`);
                console.log(`   - الطاولة: ${order.table?.number || 'غير محدد'}`);
                missingBill++;
                continue;
            }

            // Check if order is in bill.orders array
            const orderIdStr = order._id.toString();
            const isLinked = bill.orders.some(orderId => orderId.toString() === orderIdStr);

            if (!isLinked) {
                console.log(`\n❌ الطلب ${order.orderNumber}:`);
                console.log(`   - مرتبط بالفاتورة ${bill.billNumber}`);
                console.log(`   - لكن غير موجود في مصفوفة orders الخاصة بالفاتورة`);
                console.log(`   - الطاولة: ${order.table?.number || 'غير محدد'}`);
                console.log(`   - حالة الفاتورة: ${bill.status}`);
                missingInBillArray++;
            } else {
                correctlyLinked++;
            }
        }

        console.log('\n' + '═'.repeat(60));
        console.log('📈 ملخص الطلبات المرتبطة بفواتير:');
        console.log(`   ✅ مرتبطة بشكل صحيح: ${correctlyLinked}`);
        console.log(`   ❌ مرتبطة لكن غير موجودة في مصفوفة الفاتورة: ${missingInBillArray}`);
        console.log(`   ⚠️  مرتبطة بفواتير مفقودة: ${missingBill}`);

        // 2. Check orders without bill
        console.log('\n\n📊 فحص الطلبات بدون فاتورة:');
        console.log('═'.repeat(60));
        
        const ordersWithoutBill = await Order.find({
            $or: [
                { bill: { $exists: false } },
                { bill: null }
            ]
        }).populate('table');

        console.log(`\n✓ إجمالي الطلبات بدون فاتورة: ${ordersWithoutBill.length}`);

        let withTable = 0;
        let withoutTable = 0;

        for (const order of ordersWithoutBill) {
            if (order.table) {
                console.log(`\n⚠️  الطلب ${order.orderNumber}:`);
                console.log(`   - بدون فاتورة`);
                console.log(`   - الطاولة: ${order.table.number}`);
                console.log(`   - حالة الطلب: ${order.status}`);
                console.log(`   - تاريخ الإنشاء: ${new Date(order.createdAt).toLocaleString('ar-EG')}`);
                withTable++;
            } else {
                withoutTable++;
            }
        }

        console.log('\n' + '═'.repeat(60));
        console.log('📈 ملخص الطلبات بدون فاتورة:');
        console.log(`   ⚠️  مع طاولة (يجب إصلاحها): ${withTable}`);
        console.log(`   ℹ️  بدون طاولة: ${withoutTable}`);

        // 3. Check bills
        console.log('\n\n📊 فحص الفواتير:');
        console.log('═'.repeat(60));
        
        const allBills = await Bill.find({}).populate('table').populate('orders');
        
        console.log(`\n✓ إجمالي الفواتير: ${allBills.length}`);

        let billsWithOrders = 0;
        let billsWithoutOrders = 0;
        let billsWithTable = 0;
        let billsWithoutTable = 0;
        let unpaidBills = 0;
        let unpaidBillsWithOrders = 0;
        let unpaidBillsWithTable = 0;

        for (const bill of allBills) {
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasSessions = bill.sessions && bill.sessions.length > 0;
            const hasTable = bill.table != null;
            const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);

            if (hasOrders) billsWithOrders++;
            if (!hasOrders && !hasSessions) {
                console.log(`\n⚠️  الفاتورة ${bill.billNumber}:`);
                console.log(`   - بدون طلبات أو جلسات`);
                console.log(`   - الطاولة: ${bill.table?.number || 'غير محدد'}`);
                console.log(`   - الحالة: ${bill.status}`);
                billsWithoutOrders++;
            }
            
            if (hasTable) billsWithTable++;
            else billsWithoutTable++;
            
            if (isUnpaid) {
                unpaidBills++;
                if (hasOrders) unpaidBillsWithOrders++;
                if (hasTable) unpaidBillsWithTable++;
                
                // Log unpaid bills with orders but no table
                if (hasOrders && !hasTable) {
                    console.log(`\n❌ الفاتورة ${bill.billNumber}:`);
                    console.log(`   - غير مدفوعة (${bill.status})`);
                    console.log(`   - تحتوي على ${bill.orders.length} طلب`);
                    console.log(`   - لكن غير مرتبطة بطاولة!`);
                    console.log(`   - الإجمالي: ${bill.total}`);
                }
            }
        }

        console.log('\n' + '═'.repeat(60));
        console.log('📈 ملخص الفواتير:');
        console.log(`   ✅ فواتير مع طلبات: ${billsWithOrders}`);
        console.log(`   ⚠️  فواتير بدون طلبات أو جلسات: ${billsWithoutOrders}`);
        console.log(`   🪑 فواتير مرتبطة بطاولة: ${billsWithTable}`);
        console.log(`   📋 فواتير غير مرتبطة بطاولة: ${billsWithoutTable}`);
        console.log(`   💰 فواتير غير مدفوعة: ${unpaidBills}`);
        console.log(`   💰🪑 فواتير غير مدفوعة مع طاولة: ${unpaidBillsWithTable}`);
        console.log(`   💰📋 فواتير غير مدفوعة مع طلبات: ${unpaidBillsWithOrders}`);

        // 4. Check tables
        console.log('\n\n📊 فحص الطاولات:');
        console.log('═'.repeat(60));
        
        const tables = await Table.find({});
        
        let occupiedTables = 0;
        let emptyTables = 0;
        let incorrectStatus = 0;

        for (const table of tables) {
            // Check if table has any unpaid bills
            const unpaidBillsCount = await Bill.countDocuments({
                table: table._id,
                status: { $in: ['draft', 'partial', 'overdue'] }
            });

            const shouldBeOccupied = unpaidBillsCount > 0;
            const currentStatus = table.status || 'empty';
            const isOccupied = currentStatus === 'occupied';

            if (isOccupied) occupiedTables++;
            else emptyTables++;

            if (shouldBeOccupied && !isOccupied) {
                console.log(`\n❌ الطاولة ${table.number}:`);
                console.log(`   - الحالة الحالية: ${currentStatus}`);
                console.log(`   - الحالة المتوقعة: occupied`);
                console.log(`   - عدد الفواتير غير المدفوعة: ${unpaidBillsCount}`);
                incorrectStatus++;
            } else if (!shouldBeOccupied && isOccupied) {
                console.log(`\n❌ الطاولة ${table.number}:`);
                console.log(`   - الحالة الحالية: ${currentStatus}`);
                console.log(`   - الحالة المتوقعة: empty`);
                console.log(`   - عدد الفواتير غير المدفوعة: ${unpaidBillsCount}`);
                incorrectStatus++;
            }
        }

        console.log('\n' + '═'.repeat(60));
        console.log('📈 ملخص الطاولات:');
        console.log(`   ✓ إجمالي الطاولات: ${tables.length}`);
        console.log(`   🔴 طاولات محجوزة: ${occupiedTables}`);
        console.log(`   ⚪ طاولات فارغة: ${emptyTables}`);
        console.log(`   ❌ طاولات بحالة غير صحيحة: ${incorrectStatus}`);

        // Summary
        console.log('\n\n' + '═'.repeat(60));
        console.log('📊 الملخص النهائي:');
        console.log('═'.repeat(60));
        
        const totalIssues = missingInBillArray + missingBill + withTable + billsWithoutOrders + incorrectStatus;
        
        if (totalIssues === 0) {
            console.log('\n✅ لا توجد مشاكل! جميع البيانات متسقة.');
        } else {
            console.log(`\n⚠️  تم العثور على ${totalIssues} مشكلة تحتاج إلى إصلاح:`);
            if (missingInBillArray > 0) {
                console.log(`   - ${missingInBillArray} طلب مرتبط بفاتورة لكن غير موجود في مصفوفة الفاتورة`);
            }
            if (missingBill > 0) {
                console.log(`   - ${missingBill} طلب مرتبط بفاتورة مفقودة`);
            }
            if (withTable > 0) {
                console.log(`   - ${withTable} طلب بدون فاتورة لكن مرتبط بطاولة`);
            }
            if (billsWithoutOrders > 0) {
                console.log(`   - ${billsWithoutOrders} فاتورة بدون طلبات أو جلسات`);
            }
            if (incorrectStatus > 0) {
                console.log(`   - ${incorrectStatus} طاولة بحالة غير صحيحة`);
            }
            
            console.log('\n💡 لإصلاح هذه المشاكل، قم بتشغيل:');
            console.log('   node server/scripts/fixOrderBillLinking.js');
        }

        console.log('\n' + '═'.repeat(60));

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
checkOrderBillLinking();
