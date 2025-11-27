import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Verification Script: Check migration results
 * 
 * This script verifies that the migration was successful by checking:
 * 1. All itemPayments have paidQuantity field
 * 2. paidQuantity values are correct based on isPaid
 * 3. paymentHistory is initialized
 */

async function verifyMigration() {
    try {
        console.log('🔍 Verifying migration results...\n');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');
        console.log('✅ Connected to MongoDB\n');

        // Get all bills
        const allBills = await Bill.find({});
        console.log(`📊 Total bills in database: ${allBills.length}`);

        // Get bills with itemPayments
        const billsWithItems = await Bill.find({
            itemPayments: { $exists: true, $ne: [] }
        });
        console.log(`📦 Bills with itemPayments: ${billsWithItems.length}\n`);

        if (billsWithItems.length === 0) {
            console.log('ℹ️  No bills with itemPayments found. This is normal for a fresh database.\n');
            console.log('✅ Migration verification complete (no data to verify)\n');
            return;
        }

        let totalItems = 0;
        let itemsWithPaidQuantity = 0;
        let itemsWithPaymentHistory = 0;
        let correctPaidQuantity = 0;
        let issues = [];

        for (const bill of billsWithItems) {
            for (const item of bill.itemPayments) {
                totalItems++;

                // Check if paidQuantity exists
                if (item.paidQuantity !== undefined) {
                    itemsWithPaidQuantity++;

                    // Verify paidQuantity is correct
                    if (item.isPaid && item.paidQuantity === item.quantity) {
                        correctPaidQuantity++;
                    } else if (!item.isPaid && item.paidQuantity === 0) {
                        correctPaidQuantity++;
                    } else {
                        issues.push({
                            billNumber: bill.billNumber,
                            itemName: item.itemName,
                            issue: `Incorrect paidQuantity: isPaid=${item.isPaid}, paidQuantity=${item.paidQuantity}, quantity=${item.quantity}`
                        });
                    }
                } else {
                    issues.push({
                        billNumber: bill.billNumber,
                        itemName: item.itemName,
                        issue: 'Missing paidQuantity field'
                    });
                }

                // Check if paymentHistory exists
                if (item.paymentHistory !== undefined) {
                    itemsWithPaymentHistory++;
                } else {
                    issues.push({
                        billNumber: bill.billNumber,
                        itemName: item.itemName,
                        issue: 'Missing paymentHistory field'
                    });
                }
            }
        }

        console.log('📈 Verification Results:');
        console.log(`   📦 Total items: ${totalItems}`);
        console.log(`   ✅ Items with paidQuantity: ${itemsWithPaidQuantity}/${totalItems}`);
        console.log(`   ✅ Items with paymentHistory: ${itemsWithPaymentHistory}/${totalItems}`);
        console.log(`   ✅ Items with correct paidQuantity: ${correctPaidQuantity}/${totalItems}\n`);

        if (issues.length > 0) {
            console.log('⚠️  Issues found:');
            issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. Bill ${issue.billNumber} - ${issue.itemName}: ${issue.issue}`);
            });
            console.log('');
        } else {
            console.log('✅ No issues found! Migration was successful.\n');
        }

        // Sample data check
        if (billsWithItems.length > 0) {
            console.log('📋 Sample bill data:');
            const sampleBill = billsWithItems[0];
            console.log(`   Bill Number: ${sampleBill.billNumber}`);
            console.log(`   Status: ${sampleBill.status}`);
            console.log(`   Items: ${sampleBill.itemPayments.length}`);
            if (sampleBill.itemPayments.length > 0) {
                const sampleItem = sampleBill.itemPayments[0];
                console.log(`   Sample Item:`);
                console.log(`     - Name: ${sampleItem.itemName}`);
                console.log(`     - Quantity: ${sampleItem.quantity}`);
                console.log(`     - PaidQuantity: ${sampleItem.paidQuantity}`);
                console.log(`     - IsPaid: ${sampleItem.isPaid}`);
                console.log(`     - PaymentHistory entries: ${sampleItem.paymentHistory?.length || 0}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

verifyMigration()
    .then(() => {
        console.log('✅ Verification script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Verification script failed:', error);
        process.exit(1);
    });
