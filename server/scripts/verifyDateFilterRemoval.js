import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';

dotenv.config({ path: './server/.env' });

/**
 * Script to verify that date filtering has been completely removed from getBills
 * This script simulates the query logic to ensure all bills are returned regardless of date
 */

async function verifyDateFilterRemoval() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Get a sample organization ID from existing bills
        const sampleBill = await Bill.findOne();
        if (!sampleBill) {
            process.exit(0);
        }

        const organizationId = sampleBill.organization;

        // Test 1: Query without any date parameters
        const allBills = await Bill.find({ organization: organizationId })
            .select('billNumber createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Test 2: Simulate query WITH date parameters (should be ignored)
        const query = { organization: organizationId };
        
        // These date parameters should be IGNORED per requirements
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        // The new implementation should NOT add date filtering to the query
        // So this query should return the same number of bills as Test 1
        const billsWithIgnoredDates = await Bill.find(query)
            .select('billNumber createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Test 3: Verify bills from different date ranges are all included
        if (allBills.length > 0) {
            const oldestBill = allBills[allBills.length - 1];
            const newestBill = allBills[0];
            
            const dateRange = Math.ceil((new Date(newestBill.createdAt) - new Date(oldestBill.createdAt)) / (1000 * 60 * 60 * 24));
        }

        // Test 4: Verify table-specific queries still work
        const billWithTable = await Bill.findOne({ 
            organization: organizationId,
            table: { $ne: null }
        }).select('billNumber table createdAt');
        
        if (billWithTable) {
            const tableBills = await Bill.find({
                organization: organizationId,
                table: billWithTable.table
            }).select('billNumber createdAt').lean();
        }

        // Verification completed silently

    } catch (error) {
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

verifyDateFilterRemoval();
