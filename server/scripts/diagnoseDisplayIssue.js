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
import Table from '../models/Table.js';

const diagnoseDisplayIssue = async () => {
    try {
        console.log('🔍 تشخيص مشكلة عرض الفواتير والطاولات...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // Get all unpaid bills with tables
        const unpaidBills = await Bill.find({
            status: { $in: ['draft', 'partial', 'overdue'] }
        })
        .populate('table')
        .populate('orders')
        .populate('sessions')
        .lean();

        console.log(`📊 إجمالي الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

        // Simulate frontend filtering (from Billing.tsx)
        const billsWithContent = unpaidBills.filter(bill => {
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasSessions = bill.sessions && bill.sessions.length > 0;
            return hasOrders || hasSessions;
        });

        console.log(`✓ فواتير بها محتوى (يجب أن تظهر): ${billsWithContent.length}`);

        // Group by table
        const billsByTable = new Map();
        billsWithContent.forEach(bill => {
            if (bill.table) {
                const tableId = bill.table._id.toString();
                if (!billsByTable.has(tableId)) {
                    billsByTable.set(tableId, []);
                }
                billsByTable.get(tableId).push(bill);
            }
        });

        console.log(`✓ عدد الطاولات المحجوزة: ${billsByTable.size}\n`);

        // Get all occupied tables from database
        const occupiedTables = await Table.find({
            status: 'occupied'
        }).lean();

        console.log(`✓ طاولات محجوزة في قاعدة البيانات: ${occupiedTables.length}\n`);

        console.log('═'.repeat(80));
        console.log('📊 تحليل الطاولات المحجوزة:');
        console.log('═'.repeat(80));

        for (const table of occupiedTables) {
            const tableId = table._id.toString();
            const tableBills = billsByTable.get(tableId) || [];
            
            console.log(`\n🪑 الطاولة ${table.number}:`);
            console.log(`   ID: ${tableId}`);
            console.log(`   الحالة في DB: ${table.status}`);
            console.log(`   عدد الفواتير غير المدفوعة: ${tableBills.length}`);

            if (tableBills.length === 0) {
                console.log(`   ⚠️  المشكلة: لا توجد فواتير غير مدفوعة لهذه الطاولة!`);
                console.log(`   💡 الحل: تحديث حالة الطاولة إلى 'empty'`);
            } else {
                console.log(`   ✅ يجب أن تظهر محجوزة في الواجهة`);
                tableBills.forEach((bill, index) => {
                    console.log(`   ${index + 1}. ${bill.billNumber}:`);
                    console.log(`      - الطلبات: ${bill.orders?.length || 0}`);
                    console.log(`      - الجلسات: ${bill.sessions?.length || 0}`);
                    console.log(`      - الإجمالي: ${bill.total} جنيه`);
                });
            }
        }

        // Check for bills with tables that should show
        console.log('\n\n' + '═'.repeat(80));
        console.log('📋 الفواتير التي يجب أن تظهر في الواجهة:');
        console.log('═'.repeat(80));

        const billsWithTables = billsWithContent.filter(b => b.table);
        const billsWithoutTables = billsWithContent.filter(b => !b.table);

        console.log(`\n✓ فواتير مع طاولات: ${billsWithTables.length}`);
        console.log(`✓ فواتير بدون طاولات: ${billsWithoutTables.length}\n`);

        if (billsWithTables.length > 0) {
            console.log('📋 قائمة الفواتير مع الطاولات:');
            billsWithTables.forEach(bill => {
                console.log(`   - ${bill.billNumber} (الطاولة ${bill.table.number}):`);
                console.log(`     الطلبات: ${bill.orders?.length || 0}, الجلسات: ${bill.sessions?.length || 0}`);
                console.log(`     table._id: ${bill.table._id}`);
                console.log(`     table.number: ${bill.table.number}`);
            });
        }

        // Check for mismatches
        console.log('\n\n' + '═'.repeat(80));
        console.log('⚠️  فحص التناقضات:');
        console.log('═'.repeat(80));

        let mismatchCount = 0;

        for (const table of occupiedTables) {
            const tableId = table._id.toString();
            const tableBills = billsByTable.get(tableId) || [];
            
            if (tableBills.length === 0) {
                console.log(`\n❌ تناقض: الطاولة ${table.number} محجوزة لكن لا توجد فواتير!`);
                mismatchCount++;
            }
        }

        if (mismatchCount === 0) {
            console.log('\n✅ لا توجد تناقضات في قاعدة البيانات!');
        } else {
            console.log(`\n⚠️  يوجد ${mismatchCount} تناقض`);
        }

        // Frontend simulation
        console.log('\n\n' + '═'.repeat(80));
        console.log('🖥️  محاكاة الواجهة الأمامية:');
        console.log('═'.repeat(80));

        // Simulate fetchAllTableStatuses from Cafe.tsx
        const tableStatuses = {};
        
        unpaidBills.forEach(bill => {
            if (bill.table && bill.table.number) {
                const hasOrders = bill.orders && bill.orders.length > 0;
                const hasSessions = bill.sessions && bill.sessions.length > 0;
                
                if (hasOrders || hasSessions) {
                    if (!tableStatuses[bill.table.number]) {
                        tableStatuses[bill.table.number] = {
                            hasUnpaid: true,
                            bills: []
                        };
                    }
                    tableStatuses[bill.table.number].bills.push(bill.billNumber);
                }
            }
        });

        console.log(`\n✓ الطاولات التي يجب أن تظهر محجوزة: ${Object.keys(tableStatuses).length}`);
        
        if (Object.keys(tableStatuses).length > 0) {
            console.log('\n📋 قائمة الطاولات المحجوزة (حسب الواجهة):');
            Object.entries(tableStatuses).forEach(([tableNumber, status]) => {
                console.log(`   - الطاولة ${tableNumber}: ${status.bills.join(', ')}`);
            });
        }

        // Final recommendations
        console.log('\n\n' + '═'.repeat(80));
        console.log('💡 التوصيات:');
        console.log('═'.repeat(80));

        if (mismatchCount > 0) {
            console.log('\n1️⃣ قم بتحديث حالات الطاولات:');
            console.log('   node server/scripts/fixOrderBillLinking.js');
        }

        console.log('\n2️⃣ في المتصفح:');
        console.log('   - افتح console (F12)');
        console.log('   - اكتب: console.log(bills)');
        console.log('   - تحقق من أن الفواتير موجودة');
        console.log('   - اكتب: console.log(tableStatuses)');
        console.log('   - تحقق من حالات الطاولات');

        console.log('\n3️⃣ حدّث الصفحة:');
        console.log('   - اضغط Ctrl+Shift+R (hard refresh)');
        console.log('   - أو امسح cache المتصفح');

        console.log('\n4️⃣ تحقق من Socket.IO:');
        console.log('   - في console المتصفح، ابحث عن "Socket.IO connected"');
        console.log('   - إذا لم يكن متصل، أعد تشغيل الـ server');

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
diagnoseDisplayIssue();
