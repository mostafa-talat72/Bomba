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
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');

        // Get all bills
        const allBills = await Bill.find({});

        // Get bills with itemPayments
        const billsWithItems = await Bill.find({
            itemPayments: { $exists: true, $ne: [] }
        });

        if (billsWithItems.length === 0) {
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

        // Verification completed silently
        if (issues.length > 0) {
            throw new Error('Migration verification failed');
        }

    } catch (error) {
        throw error;
    } finally {
        await mongoose.connection.close();
    }
}

verifyMigration()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        process.exit(1);
    });
