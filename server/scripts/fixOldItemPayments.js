import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixOldItemPayments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // Find all bills with itemPayments where isPaid=true but paidQuantity=0
        const bills = await Bill.find({
            'itemPayments': { $exists: true, $ne: [] }
        });

        console.log(`\nFound ${bills.length} bills with itemPayments`);

        let updatedCount = 0;
        let itemsFixed = 0;

        for (const bill of bills) {
            let billModified = false;

            bill.itemPayments.forEach(item => {
                // If isPaid is true but paidQuantity is 0, update paidQuantity
                if (item.isPaid && (item.paidQuantity === 0 || item.paidQuantity === undefined || item.paidQuantity === null)) {
                    console.log(`\n  Fixing item: ${item.itemName}`);
                    console.log(`    Before: paidQuantity=${item.paidQuantity}, isPaid=${item.isPaid}, quantity=${item.quantity}`);
                    
                    item.paidQuantity = item.quantity;
                    item.paidAmount = item.quantity * (item.pricePerUnit || 0);
                    
                    console.log(`    After: paidQuantity=${item.paidQuantity}, paidAmount=${item.paidAmount}`);
                    
                    billModified = true;
                    itemsFixed++;
                }
            });

            if (billModified) {
                await bill.save();
                updatedCount++;
                console.log(`  ✓ Updated bill: ${bill.billNumber}`);
            }
        }

        console.log(`\n✓ Migration complete`);
        console.log(`  Bills updated: ${updatedCount}`);
        console.log(`  Items fixed: ${itemsFixed}`);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixOldItemPayments();
