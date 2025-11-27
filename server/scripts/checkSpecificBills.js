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

const checkSpecificBills = async () => {
    try {
        console.log('🔍 فحص الفواتير غير المدفوعة المرتبطة بطاولات...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات\n');

        // Find unpaid bills with tables
        const unpaidBillsWithTables = await Bill.find({
            table: { $exists: true, $ne: null },
            status: { $in: ['draft', 'partial', 'overdue'] }
        })
        .populate('table')
        .populate('orders')
        .populate('sessions')
        .sort({ createdAt: -1 });

        console.log(`📊 عدد الفواتير غير المدفوعة المرتبطة بطاولات: ${unpaidBillsWithTables.length}\n`);

        if (unpaidBillsWithTables.length === 0) {
            console.log('⚠️  لا توجد فواتير غير مدفوعة مرتبطة بطاولات!');
            console.log('   هذا يعني أن المشكلة قد تكون في:');
            console.log('   1. الفواتير غير مرتبطة بطاولات في قاعدة البيانات');
            console.log('   2. حالة الفواتير ليست draft/partial/overdue');
            return;
        }

        console.log('═'.repeat(80));
        
        for (const bill of unpaidBillsWithTables) {
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasSessions = bill.sessions && bill.sessions.length > 0;
            const hasContent = hasOrders || hasSessions;

            console.log(`\n📋 الفاتورة: ${bill.billNumber}`);
            console.log(`   ID: ${bill._id}`);
            console.log(`   الحالة: ${bill.status}`);
            console.log(`   الإجمالي: ${bill.total} جنيه`);
            console.log(`   المتبقي: ${bill.remaining} جنيه`);
            console.log(`   نوع الفاتورة: ${bill.billType || 'غير محدد'}`);
            
            // Table info - DETAILED
            if (bill.table) {
                console.log(`\n   🪑 معلومات الطاولة:`);
                console.log(`      - الرقم: ${bill.table.number}`);
                console.log(`      - ID: ${bill.table._id}`);
                console.log(`      - الاسم: ${bill.table.name || 'غير محدد'}`);
                console.log(`      - القسم: ${bill.table.section || 'غير محدد'}`);
                console.log(`      - نشطة: ${bill.table.isActive ? 'نعم' : 'لا'}`);
            }

            // Content check
            console.log(`\n   📦 المحتوى:`);
            console.log(`      - الطلبات: ${hasOrders ? `${bill.orders.length} طلب` : 'لا يوجد'}`);
            console.log(`      - الجلسات: ${hasSessions ? `${bill.sessions.length} جلسة` : 'لا يوجد'}`);
            console.log(`      - يحتوي على محتوى: ${hasContent ? '✓ نعم' : '✗ لا'}`);

            // Visibility check
            console.log(`\n   👁️  فحص الظهور:`);
            const shouldAppearInFrontend = hasContent;
            console.log(`      - يجب أن تظهر في الواجهة: ${shouldAppearInFrontend ? '✓ نعم' : '✗ لا'}`);

            if (!hasContent) {
                console.log(`\n   ⚠️  المشكلة: الفاتورة فارغة (لا طلبات ولا جلسات)`);
                console.log(`      الحل: احذف هذه الفاتورة أو أضف محتوى لها`);
            }

            // Check if table is populated correctly
            if (bill.table && typeof bill.table === 'object' && bill.table._id) {
                console.log(`\n   ✅ الطاولة مربوطة بشكل صحيح (populated)`);
            } else if (bill.table) {
                console.log(`\n   ⚠️  الطاولة مربوطة لكن غير populated بشكل صحيح`);
                console.log(`      القيمة: ${JSON.stringify(bill.table)}`);
            }

            console.log('\n' + '─'.repeat(80));
        }

        // Check for bills without content
        const emptyBills = unpaidBillsWithTables.filter(b => 
            (!b.orders || b.orders.length === 0) && 
            (!b.sessions || b.sessions.length === 0)
        );

        if (emptyBills.length > 0) {
            console.log(`\n\n⚠️  تحذير: يوجد ${emptyBills.length} فاتورة فارغة (بدون طلبات أو جلسات):`);
            emptyBills.forEach(b => {
                console.log(`   - ${b.billNumber} (الطاولة: ${b.table?.number})`);
            });
            console.log(`\n   💡 هذه الفواتير لن تظهر في الواجهة لأنها فارغة`);
            console.log(`   الحل: احذف هذه الفواتير أو ألغها`);
        }

        // Summary
        console.log(`\n\n${'═'.repeat(80)}`);
        console.log('📊 الملخص:');
        console.log('═'.repeat(80));
        
        const billsWithContent = unpaidBillsWithTables.filter(b => 
            (b.orders && b.orders.length > 0) || (b.sessions && b.sessions.length > 0)
        );

        console.log(`\n✓ فواتير غير مدفوعة مع طاولات: ${unpaidBillsWithTables.length}`);
        console.log(`✓ فواتير بها محتوى (يجب أن تظهر): ${billsWithContent.length}`);
        console.log(`✗ فواتير فارغة (لن تظهر): ${emptyBills.length}`);

        if (billsWithContent.length > 0) {
            console.log(`\n📋 الفواتير التي يجب أن تظهر في الواجهة:`);
            billsWithContent.forEach(b => {
                const ordersCount = b.orders?.length || 0;
                const sessionsCount = b.sessions?.length || 0;
                console.log(`   - ${b.billNumber} (الطاولة ${b.table?.number}): ${ordersCount} طلب، ${sessionsCount} جلسة`);
            });
        }

        console.log(`\n\n💡 إذا كانت هذه الفواتير لا تظهر في الواجهة:`);
        console.log(`   1. تأكد من تحديث الصفحة (F5)`);
        console.log(`   2. افتح console المتصفح (F12) وابحث عن أخطاء`);
        console.log(`   3. تحقق من أن الفواتير تُجلب بشكل صحيح:`);
        console.log(`      - افتح console المتصفح`);
        console.log(`      - اكتب: console.log(bills)`);
        console.log(`      - تحقق من أن الفواتير موجودة في المصفوفة`);

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
};

// Run the script
checkSpecificBills();
