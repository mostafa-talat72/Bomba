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

const fixOrderBillLinking = async () => {
    try {
        console.log('🔍 بدء فحص وإصلاح ربط الطلبات بالفواتير...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // 1. Find all orders with bill reference
        const ordersWithBill = await Order.find({ bill: { $exists: true, $ne: null } })
            .populate('bill')
            .populate('table');
        
        console.log(`📊 عدد الطلبات المرتبطة بفواتير: ${ordersWithBill.length}\n`);

        let fixedCount = 0;
        let alreadyLinkedCount = 0;
        let missingBillCount = 0;

        for (const order of ordersWithBill) {
            if (!order.bill) {
                console.log(`⚠️  الطلب ${order.orderNumber} مرتبط بفاتورة غير موجودة`);
                missingBillCount++;
                continue;
            }

            const bill = await Bill.findById(order.bill._id || order.bill);
            
            if (!bill) {
                console.log(`⚠️  الطلب ${order.orderNumber} مرتبط بفاتورة غير موجودة (${order.bill})`);
                missingBillCount++;
                continue;
            }

            // Check if order is in bill.orders array
            const orderIdStr = order._id.toString();
            const isLinked = bill.orders.some(orderId => orderId.toString() === orderIdStr);

            if (!isLinked) {
                console.log(`🔧 إصلاح: إضافة الطلب ${order.orderNumber} إلى الفاتورة ${bill.billNumber}`);
                bill.orders.push(order._id);
                await bill.save();
                
                // Recalculate bill totals
                await bill.calculateSubtotal();
                
                fixedCount++;
            } else {
                alreadyLinkedCount++;
            }
        }

        console.log('\n📈 النتائج:');
        console.log(`✅ طلبات تم إصلاحها: ${fixedCount}`);
        console.log(`✓  طلبات مرتبطة بشكل صحيح: ${alreadyLinkedCount}`);
        console.log(`⚠️  طلبات بفواتير مفقودة: ${missingBillCount}`);

        // 2. Find orders without bill but with table
        console.log('\n🔍 البحث عن طلبات بدون فاتورة ولكن مرتبطة بطاولة...');
        
        const ordersWithoutBill = await Order.find({
            $or: [
                { bill: { $exists: false } },
                { bill: null }
            ],
            table: { $exists: true, $ne: null }
        }).populate('table');

        console.log(`📊 عدد الطلبات بدون فاتورة: ${ordersWithoutBill.length}\n`);

        let createdBillsCount = 0;
        let linkedToExistingBillCount = 0;

        for (const order of ordersWithoutBill) {
            if (!order.table) continue;

            // Try to find an existing unpaid bill for this table
            const existingBill = await Bill.findOne({
                table: order.table._id || order.table,
                organization: order.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 });

            if (existingBill) {
                console.log(`🔗 ربط الطلب ${order.orderNumber} بالفاتورة الموجودة ${existingBill.billNumber}`);
                
                // Link order to existing bill
                order.bill = existingBill._id;
                await order.save();

                // Add order to bill if not already there
                const orderIdStr = order._id.toString();
                const isLinked = existingBill.orders.some(orderId => orderId.toString() === orderIdStr);
                
                if (!isLinked) {
                    existingBill.orders.push(order._id);
                    await existingBill.save();
                    await existingBill.calculateSubtotal();
                }

                linkedToExistingBillCount++;
            } else {
                // Create new bill for this order
                console.log(`📝 إنشاء فاتورة جديدة للطلب ${order.orderNumber}`);
                
                const tableDoc = await Table.findById(order.table._id || order.table);
                const newBill = await Bill.create({
                    table: order.table._id || order.table,
                    customerName: order.customerName || `طاولة ${tableDoc?.number || ''}`,
                    customerPhone: order.customerPhone || null,
                    orders: [order._id],
                    sessions: [],
                    subtotal: 0,
                    total: 0,
                    discount: 0,
                    tax: 0,
                    paid: 0,
                    remaining: 0,
                    status: 'draft',
                    paymentMethod: 'cash',
                    billType: 'cafe',
                    createdBy: order.createdBy,
                    organization: order.organization,
                });

                // Link order to new bill
                order.bill = newBill._id;
                await order.save();

                // Recalculate bill totals
                await newBill.calculateSubtotal();

                // Update table status
                if (tableDoc) {
                    tableDoc.status = 'occupied';
                    await tableDoc.save();
                }

                createdBillsCount++;
            }
        }

        console.log('\n📈 النتائج:');
        console.log(`✅ فواتير جديدة تم إنشاؤها: ${createdBillsCount}`);
        console.log(`🔗 طلبات تم ربطها بفواتير موجودة: ${linkedToExistingBillCount}`);

        // 4. Fix bills with orders but no table
        console.log('\n🔍 البحث عن فواتير بها طلبات لكن بدون طاولة...');
        
        const billsWithOrdersButNoTable = await Bill.find({
            $or: [
                { table: { $exists: false } },
                { table: null }
            ],
            orders: { $exists: true, $ne: [] },
            status: { $in: ['draft', 'partial', 'overdue'] }
        }).populate('orders');

        console.log(`📊 عدد الفواتير بها طلبات لكن بدون طاولة: ${billsWithOrdersButNoTable.length}\n`);

        let billsLinkedToTable = 0;

        for (const bill of billsWithOrdersButNoTable) {
            // Get the table from the first order
            if (bill.orders && bill.orders.length > 0) {
                const firstOrder = await Order.findById(bill.orders[0]._id || bill.orders[0]).populate('table');
                
                if (firstOrder && firstOrder.table) {
                    console.log(`🔗 ربط الفاتورة ${bill.billNumber} بالطاولة ${firstOrder.table.number}`);
                    
                    bill.table = firstOrder.table._id || firstOrder.table;
                    await bill.save();
                    
                    // Update table status
                    const tableDoc = await Table.findById(bill.table);
                    if (tableDoc) {
                        tableDoc.status = 'occupied';
                        await tableDoc.save();
                    }
                    
                    billsLinkedToTable++;
                }
            }
        }

        console.log(`\n✅ تم ربط ${billsLinkedToTable} فاتورة بطاولات`);

        // 3. Update table statuses
        console.log('\n🔍 تحديث حالات الطاولات...');
        
        const tables = await Table.find({});
        let tablesUpdated = 0;

        for (const table of tables) {
            // Check if table has any unpaid bills
            const unpaidBills = await Bill.countDocuments({
                table: table._id,
                status: { $in: ['draft', 'partial', 'overdue'] }
            });

            const shouldBeOccupied = unpaidBills > 0;
            const currentStatus = table.status || 'empty';

            if (shouldBeOccupied && currentStatus !== 'occupied') {
                console.log(`🔧 تحديث حالة الطاولة ${table.number} إلى محجوزة`);
                table.status = 'occupied';
                await table.save();
                tablesUpdated++;
            } else if (!shouldBeOccupied && currentStatus === 'occupied') {
                console.log(`🔧 تحديث حالة الطاولة ${table.number} إلى فارغة`);
                table.status = 'empty';
                await table.save();
                tablesUpdated++;
            }
        }

        console.log(`\n✅ تم تحديث ${tablesUpdated} طاولة\n`);

        console.log('✅ تم الانتهاء من إصلاح ربط الطلبات بالفواتير بنجاح!\n');

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
fixOrderBillLinking();
