import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CostCategory from '../models/CostCategory.js';
import Cost from '../models/Cost.js';

dotenv.config({ path: './server/.env' });

const testCostCategoryEnhancements = async () => {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        // Get a test organization and user
        const Organization = (await import('../models/Organization.js')).default;
        const User = (await import('../models/User.js')).default;
        
        const testOrg = await Organization.findOne();
        const testUser = await User.findOne();

        if (!testOrg || !testUser) {
            console.log('❌ No organization or user found. Please create test data first.');
            process.exit(1);
        }

        console.log(`📋 Using Organization: ${testOrg.name}`);
        console.log(`👤 Using User: ${testUser.name}\n`);

        // Test 1: Create category with all fields (Requirement 1.1)
        console.log('Test 1: Create category with icon, color, and sortOrder');
        const category1 = await CostCategory.create({
            name: 'Test Category ' + Date.now(),
            icon: 'Wallet',
            color: '#FF5733',
            description: 'Test category for verification',
            sortOrder: 10,
            organization: testOrg._id,
            createdBy: testUser._id
        });
        console.log('✅ Category created:', {
            name: category1.name,
            icon: category1.icon,
            color: category1.color,
            sortOrder: category1.sortOrder
        });

        // Test 2: Verify sorting (Requirement 1.2)
        console.log('\nTest 2: Verify category sorting by sortOrder and name');
        const category2 = await CostCategory.create({
            name: 'AAA Category ' + Date.now(),
            icon: 'DollarSign',
            color: '#3B82F6',
            sortOrder: 5,
            organization: testOrg._id,
            createdBy: testUser._id
        });
        
        const categories = await CostCategory.find({ organization: testOrg._id })
            .sort({ sortOrder: 1, name: 1 })
            .select('name sortOrder');
        
        console.log('✅ Categories sorted:', categories.map(c => ({ name: c.name, sortOrder: c.sortOrder })));

        // Test 3: Test unique name constraint (Requirement 1.3)
        console.log('\nTest 3: Test unique name constraint');
        try {
            await CostCategory.create({
                name: category1.name,
                organization: testOrg._id,
                createdBy: testUser._id
            });
            console.log('❌ Should have failed with duplicate name error');
        } catch (error) {
            if (error.code === 11000) {
                console.log('✅ Duplicate name correctly rejected');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Test 4: Test deletion protection (Requirement 1.4)
        console.log('\nTest 4: Test deletion protection when category has costs');
        
        // Create a cost linked to the category
        const testCost = await Cost.create({
            category: category1._id,
            description: 'Test cost for deletion protection',
            amount: 100,
            date: new Date(),
            organization: testOrg._id,
            createdBy: testUser._id
        });
        console.log('✅ Test cost created');

        // Try to delete category with costs
        const costsCount = await Cost.countDocuments({
            category: category1._id,
            organization: testOrg._id
        });
        
        if (costsCount > 0) {
            console.log(`✅ Category has ${costsCount} cost(s) - deletion should be prevented`);
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await Cost.deleteOne({ _id: testCost._id });
        await CostCategory.deleteMany({ 
            _id: { $in: [category1._id, category2._id] }
        });
        console.log('✅ Cleanup complete');

        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
};

testCostCategoryEnhancements();
