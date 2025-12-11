#!/usr/bin/env node

/**
 * Script to fix itemPayments initialization issue
 * Problem: Bills with paid=0 but itemPayments showing as fully paid
 * Solution: Remove itemPayments for bills that have no actual payments
 */

import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './server/.env' });

async function fixItemPaymentsInitialization() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find bills with problematic itemPayments
        const problematicBills = await Bill.find({
            // Bills that have itemPayments but no actual payments
            itemPayments: { $exists: true, $ne: [] },
            paid: 0,
            status: { $in: ['draft'] }
        });

        console.log(`🔍 Found ${problematicBills.length} bills with problematic itemPayments`);

        let fixedCount = 0;

        for (const bill of problematicBills) {
            console.log(`\n🔧 Fixing bill: ${bill.billNumber}`);
            console.log(`   Current status: ${bill.status}, paid: ${bill.paid}, total: ${bill.total}`);
            console.log(`   ItemPayments count: ${bill.itemPayments.length}`);

            // Check if all itemPayments have paidQuantity = 0 and paidAmount = 0
            const allUnpaid = bill.itemPayments.every(item => 
                (item.paidQuantity || 0) === 0 && (item.paidAmount || 0) === 0
            );

            if (allUnpaid && bill.paid === 0) {
                // Remove itemPayments for bills with no actual payments
                bill.itemPayments = [];
                await bill.save();
                
                console.log(`   ✅ Removed empty itemPayments`);
                fixedCount++;
            } else {
                console.log(`   ⚠️  Bill has actual payments, skipping`);
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} bills`);
        console.log('🎉 ItemPayments initialization fix completed!');

    } catch (error) {
        console.error('❌ Error fixing itemPayments:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run the script
fixItemPaymentsInitialization();