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

/**
 * Script to fix paid bills
 * If bill status is 'paid', set paid = total and remaining = 0
 */

async function fixPaidBills() {
    try {
        console.log('🔧 Starting paid bills fix...');
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get all bills with status 'paid'
        const paidBills = await Bill.find({ status: 'paid' });
        
        console.log(`📊 Found ${paidBills.length} paid bills to process`);

        let fixedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;
        const errors = [];
        const changes = [];

        for (const bill of paidBills) {
            try {
                const oldPaid = bill.paid;
                const oldRemaining = bill.remaining;
                const total = bill.total;

                // Check if needs fixing
                const needsFix = (Math.abs(bill.paid - bill.total) > 0.01) || (bill.remaining > 0.01);

                if (needsFix) {
                    console.log(`\n🔄 Fixing Bill ${bill.billNumber}:`);
                    console.log(`   Total: ${total}`);
                    console.log(`   Paid: ${oldPaid} → ${total}`);
                    console.log(`   Remaining: ${oldRemaining} → 0`);
                    
                    changes.push({
                        billNumber: bill.billNumber,
                        oldPaid,
                        newPaid: total,
                        oldRemaining,
                        newRemaining: 0,
                        total
                    });
                    
                    // Update directly using updateOne to bypass hooks
                    await Bill.updateOne(
                        { _id: bill._id },
                        {
                            $set: {
                                paid: total,
                                remaining: 0
                            }
                        }
                    );
                    
                    fixedCount++;
                } else {
                    unchangedCount++;
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    billNumber: bill.billNumber,
                    error: error.message
                });
                console.error(`❌ Error fixing bill ${bill.billNumber}:`, error.message);
            }
        }

        console.log('\n═══════════════════════════════════════');
        console.log('📈 Summary:');
        console.log(`   Total paid bills processed: ${paidBills.length}`);
        console.log(`   Bills fixed: ${fixedCount}`);
        console.log(`   Bills unchanged: ${unchangedCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log('═══════════════════════════════════════');

        if (changes.length > 0 && changes.length <= 20) {
            console.log('\n📋 Changes made:');
            changes.forEach(change => {
                console.log(`\n   ${change.billNumber}:`);
                console.log(`      Total: ${change.total}`);
                console.log(`      Paid: ${change.oldPaid} → ${change.newPaid}`);
                console.log(`      Remaining: ${change.oldRemaining} → ${change.newRemaining}`);
            });
        } else if (changes.length > 20) {
            console.log(`\n📋 ${changes.length} bills were fixed (too many to display)`);
        }

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(err => {
                console.log(`   - ${err.billNumber}: ${err.error}`);
            });
        }

        console.log('\n✅ Paid bills fix completed!');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
fixPaidBills();
