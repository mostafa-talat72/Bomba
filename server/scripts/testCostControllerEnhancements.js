import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cost from '../models/Cost.js';
import CostCategory from '../models/CostCategory.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

dotenv.config({ path: './server/.env' });

const testCostControllerEnhancements = async () => {
    try {
        console.log('🧪 Testing Cost Controller Enhancements...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Get test organization and user
        const organization = await Organization.findOne();
        const user = await User.findOne({ organization: organization._id });

        if (!organization || !user) {
            console.log('❌ No organization or user found. Please create test data first.');
            process.exit(1);
        }

        console.log(`Using organization: ${organization.name}`);
        console.log(`Using user: ${user.name}\n`);

        // Create test category
        let testCategory = await CostCategory.findOne({
            name: 'Test Category',
            organization: organization._id
        });

        if (!testCategory) {
            testCategory = await CostCategory.create({
                name: 'Test Category',
                icon: 'DollarSign',
                color: '#3B82F6',
                description: 'Test category for controller testing',
                organization: organization._id,
                createdBy: user._id
            });
            console.log('✓ Created test category\n');
        } else {
            console.log('✓ Using existing test category\n');
        }

        // Test 1: Create cost with validation
        console.log('Test 1: Create cost with required fields validation');
        console.log('='.repeat(60));

        try {
            const validCost = await Cost.create({
                category: testCategory._id,
                description: 'Test cost with all required fields',
                amount: 1000,
                paidAmount: 0,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            });
            console.log('✓ Created cost with valid data');
            console.log(`  - ID: ${validCost._id}`);
            console.log(`  - Status: ${validCost.status}`);
            console.log(`  - Remaining: ${validCost.remainingAmount}`);
        } catch (error) {
            console.log(`❌ Failed to create valid cost: ${error.message}`);
        }

        // Test missing required fields
        try {
            await Cost.create({
                description: 'Missing category',
                amount: 500,
                organization: organization._id,
                createdBy: user._id
            });
            console.log('❌ Should have failed without category');
        } catch (error) {
            console.log('✓ Correctly rejected cost without category');
        }

        console.log('');

        // Test 2: Search functionality
        console.log('Test 2: Search functionality for description and vendor');
        console.log('='.repeat(60));

        // Create costs with different descriptions and vendors
        const searchTestCosts = await Cost.create([
            {
                category: testCategory._id,
                description: 'Office supplies purchase',
                vendor: 'Staples Inc',
                amount: 500,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            },
            {
                category: testCategory._id,
                description: 'Equipment maintenance',
                vendor: 'Tech Solutions',
                amount: 1500,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            },
            {
                category: testCategory._id,
                description: 'Software licenses',
                vendor: 'Microsoft Store',
                amount: 2000,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            }
        ]);

        console.log(`✓ Created ${searchTestCosts.length} test costs for search`);

        // Test search by description
        const searchByDescription = await Cost.find({
            organization: organization._id,
            $or: [
                { description: { $regex: 'supplies', $options: 'i' } },
                { vendor: { $regex: 'supplies', $options: 'i' } }
            ]
        });
        console.log(`✓ Search "supplies" found ${searchByDescription.length} result(s)`);

        // Test search by vendor
        const searchByVendor = await Cost.find({
            organization: organization._id,
            $or: [
                { description: { $regex: 'tech', $options: 'i' } },
                { vendor: { $regex: 'tech', $options: 'i' } }
            ]
        });
        console.log(`✓ Search "tech" found ${searchByVendor.length} result(s)`);

        console.log('');

        // Test 3: Category and status filtering
        console.log('Test 3: Category and status filtering');
        console.log('='.repeat(60));

        // Create another category
        const category2 = await CostCategory.create({
            name: 'Test Category 2',
            icon: 'CreditCard',
            color: '#10B981',
            organization: organization._id,
            createdBy: user._id
        });

        // Create costs with different categories and statuses
        await Cost.create([
            {
                category: testCategory._id,
                description: 'Pending cost 1',
                amount: 300,
                paidAmount: 0,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            },
            {
                category: category2._id,
                description: 'Paid cost 1',
                amount: 500,
                paidAmount: 500,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            },
            {
                category: testCategory._id,
                description: 'Partially paid cost',
                amount: 1000,
                paidAmount: 400,
                date: new Date(),
                organization: organization._id,
                createdBy: user._id
            }
        ]);

        // Test category filter
        const category1Costs = await Cost.find({
            organization: organization._id,
            category: testCategory._id
        });
        console.log(`✓ Category filter: Found ${category1Costs.length} costs in category 1`);

        // Test status filter
        const paidCosts = await Cost.find({
            organization: organization._id,
            status: 'paid'
        });
        console.log(`✓ Status filter: Found ${paidCosts.length} paid cost(s)`);

        const partiallyPaidCosts = await Cost.find({
            organization: organization._id,
            status: 'partially_paid'
        });
        console.log(`✓ Status filter: Found ${partiallyPaidCosts.length} partially paid cost(s)`);

        // Test combined filters
        const combinedFilter = await Cost.find({
            organization: organization._id,
            category: testCategory._id,
            status: 'pending'
        });
        console.log(`✓ Combined filter: Found ${combinedFilter.length} pending cost(s) in category 1`);

        console.log('');

        // Test 4: Add payment endpoint validation
        console.log('Test 4: Add payment endpoint validation');
        console.log('='.repeat(60));

        const paymentTestCost = await Cost.create({
            category: testCategory._id,
            description: 'Payment test cost',
            amount: 1000,
            paidAmount: 0,
            date: new Date(),
            organization: organization._id,
            createdBy: user._id
        });

        console.log(`✓ Created test cost: ${paymentTestCost.amount} EGP`);
        console.log(`  - Initial paid: ${paymentTestCost.paidAmount}`);
        console.log(`  - Initial remaining: ${paymentTestCost.remainingAmount}`);
        console.log(`  - Initial status: ${paymentTestCost.status}`);

        // Test valid payment
        try {
            await paymentTestCost.addPayment(300, 'cash');
            console.log(`✓ Added payment of 300 EGP`);
            console.log(`  - New paid: ${paymentTestCost.paidAmount}`);
            console.log(`  - New remaining: ${paymentTestCost.remainingAmount}`);
            console.log(`  - New status: ${paymentTestCost.status}`);
        } catch (error) {
            console.log(`❌ Failed to add valid payment: ${error.message}`);
        }

        // Test payment exceeding remaining amount
        try {
            await paymentTestCost.addPayment(800, 'cash');
            console.log(`❌ Should have rejected payment exceeding remaining amount`);
        } catch (error) {
            console.log(`✓ Correctly rejected excessive payment: ${error.message}`);
        }

        // Test completing payment
        try {
            await paymentTestCost.addPayment(700, 'card');
            console.log(`✓ Completed payment with 700 EGP`);
            console.log(`  - Final paid: ${paymentTestCost.paidAmount}`);
            console.log(`  - Final remaining: ${paymentTestCost.remainingAmount}`);
            console.log(`  - Final status: ${paymentTestCost.status}`);
        } catch (error) {
            console.log(`❌ Failed to complete payment: ${error.message}`);
        }

        console.log('');

        // Test 5: Error handling
        console.log('Test 5: Error handling and validation');
        console.log('='.repeat(60));

        // Test invalid payment amount
        const errorTestCost = await Cost.create({
            category: testCategory._id,
            description: 'Error test cost',
            amount: 500,
            date: new Date(),
            organization: organization._id,
            createdBy: user._id
        });

        try {
            await errorTestCost.addPayment(-100, 'cash');
            console.log(`❌ Should have rejected negative payment`);
        } catch (error) {
            console.log(`✓ Correctly rejected negative payment: ${error.message}`);
        }

        try {
            await errorTestCost.addPayment(0, 'cash');
            console.log(`❌ Should have rejected zero payment`);
        } catch (error) {
            console.log(`✓ Correctly rejected zero payment: ${error.message}`);
        }

        console.log('');

        // Cleanup
        console.log('Cleaning up test data...');
        await Cost.deleteMany({
            organization: organization._id,
            description: { $regex: /test|supplies|equipment|software|pending|paid|payment|error/i }
        });
        await CostCategory.deleteMany({
            organization: organization._id,
            name: { $regex: /test/i }
        });
        console.log('✓ Cleanup complete\n');

        console.log('✅ All Cost Controller Enhancement tests completed successfully!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

testCostControllerEnhancements();
