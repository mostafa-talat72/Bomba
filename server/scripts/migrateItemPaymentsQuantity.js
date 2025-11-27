import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration Script: Add paidQuantity field to itemPayments
 * 
 * This script migrates existing itemPayments data to support quantity-based partial payments.
 * 
 * Changes:
 * - Adds paidQuantity field (0 if unpaid, quantity if paid)
 * - Initializes empty paymentHistory array
 * - Preserves existing isPaid and paidAmount values
 */

async function migrateItemPaymentsQuantity() {
    try {
        console.log('🔄 Starting migration: Add paidQuantity to itemPayments...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');
        console.log('✅ Connected to MongoDB\n');

        // Find all bills with itemPayments
        const bills = await Bill.find({
            itemPayments: { $exists: true, $ne: [] }
        });

        console.log(`📊 Found ${bills.length} bills with itemPayments\n`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const bill of bills) {
            try {
                let needsUpdate = false;

                // Check each itemPayment
                for (const item of bill.itemPayments) {
                    // Check if paidQuantity already exists
                    if (item.paidQuantity === undefined) {
                        needsUpdate = true;

                        // Set paidQuantity based on isPaid
                        if (item.isPaid === true) {
                            item.paidQuantity = item.quantity || 0;
                        } else {
                            item.paidQuantity = 0;
                        }

                        // Initialize paymentHistory if it doesn't exist
                        if (!item.paymentHistory) {
                            item.paymentHistory = [];
                        }

                        // If item is paid and has no payment history, create one entry
                        if (item.isPaid && item.paymentHistory.length === 0 && item.paidBy) {
                            item.paymentHistory.push({
                                quantity: item.quantity || 0,
                                amount: item.paidAmount || 0,
                                paidAt: item.paidAt || new Date(),
                                paidBy: item.paidBy,
                                method: 'cash', // Default method for migrated data
                            });
                        }
                    }
                }

                if (needsUpdate) {
                    // Save the bill with updated itemPayments
                    await bill.save();
                    migratedCount++;
                    console.log(`✅ Migrated bill: ${bill.billNumber} (${bill.itemPayments.length} items)`);
                } else {
                    skippedCount++;
                    console.log(`⏭️  Skipped bill: ${bill.billNumber} (already migrated)`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Error migrating bill ${bill.billNumber}:`, error.message);
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   ✅ Migrated: ${migratedCount} bills`);
        console.log(`   ⏭️  Skipped: ${skippedCount} bills`);
        console.log(`   ❌ Errors: ${errorCount} bills`);
        console.log('\n✨ Migration completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run migration
migrateItemPaymentsQuantity()
    .then(() => {
        console.log('✅ Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration script failed:', error);
        process.exit(1);
    });
