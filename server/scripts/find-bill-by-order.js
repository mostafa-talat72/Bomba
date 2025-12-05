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

async function findBillByOrder(orderId) {
    try {
        console.log('🔄 جاري الاتصال بقاعدة البيانات...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

        const order = await Order.findById(orderId);
        if (!order) {
            console.error(`❌ لم يتم العثور على الطلب: ${orderId}`);
            process.exit(1);
        }

        console.log(`📦 الطلب: ${order.orderNumber}`);
        console.log(`📄 الفاتورة: ${order.bill}`);
        console.log(`📋 العناصر:`);
        order.items.forEach(item => {
            console.log(`   - ${item.name} (${item.price} جنيه × ${item.quantity})`);
        });

        if (order.bill) {
            const bill = await Bill.findById(order.bill).populate('orders');
            console.log(`\n💰 تفاصيل الفاتورة: ${bill.billNumber}`);
            console.log(`   - عدد الطلبات: ${bill.orders.length}`);
            console.log(`   - عدد itemPayments: ${bill.itemPayments?.length || 0}`);
            
            console.log(`\n📋 itemPayments الحالية:`);
            bill.itemPayments?.forEach(ip => {
                console.log(`   - ${ip.itemName} (${ip.pricePerUnit} جنيه × ${ip.quantity})`);
            });

            console.log(`\n\n🔧 لإعادة بناء itemPayments لهذه الفاتورة، قم بتشغيل:`);
            console.log(`   node server/scripts/rebuild-bill-item-payments.js ${bill._id}`);
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 تم إغلاق الاتصال بقاعدة البيانات');
        process.exit(0);
    }
}

const orderId = process.argv[2] || '693346a3c024a24bac21bb96';
findBillByOrder(orderId);
