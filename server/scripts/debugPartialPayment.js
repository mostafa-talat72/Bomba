import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugPartialPayment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // احصل على الفواتير التي لها دفعات جزئية (status = partial)
        const bills = await Bill.find({
            status: 'partial'
        })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('orders');

        if (!bills || bills.length === 0) {
            console.log('❌ No bills with partial payments found');
            return;
        }

        console.log(`\nFound ${bills.length} bills with partial payments\n`);

        for (const bill of bills) {

        console.log('\n📋 Bill:', bill.billNumber);
        console.log('Status:', bill.status);
        console.log('Total:', bill.total);
        console.log('Paid:', bill.paid);
        console.log('Remaining:', bill.remaining);

        console.log('\n📦 Item Payments:');
        bill.itemPayments.forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.itemName}`);
            console.log(`   ID: ${item._id}`);
            console.log(`   Order ID: ${item.orderId}`);
            console.log(`   Price per unit: ${item.pricePerUnit}`);
            console.log(`   Total quantity: ${item.quantity}`);
            console.log(`   Paid quantity: ${item.paidQuantity}`);
            console.log(`   Remaining: ${item.quantity - item.paidQuantity}`);
            console.log(`   Is paid: ${item.isPaid}`);
            console.log(`   Paid amount: ${item.paidAmount}`);
            
            if (item.paymentHistory && item.paymentHistory.length > 0) {
                console.log('   Payment history:');
                item.paymentHistory.forEach((payment, i) => {
                    console.log(`     ${i + 1}. Quantity: ${payment.quantity}, Amount: ${payment.amount}, Date: ${payment.paidAt}`);
                });
            }
        });

        }

        console.log('\n✓ Debug complete');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugPartialPayment();
