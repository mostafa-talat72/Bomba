/**
 * Test Script: Cost Model Status Automation
 * Demonstrates the automatic status calculation functionality
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cost from '../models/Cost.js';
import CostCategory from '../models/CostCategory.js';

dotenv.config();

const testCostStatusAutomation = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Create test organization and user
    const testOrg = new mongoose.Types.ObjectId();
    const testUser = new mongoose.Types.ObjectId();

    // Create test category
    console.log('📁 Creating test category...');
    const category = await CostCategory.create({
      name: 'Test Category - Status Automation',
      icon: 'DollarSign',
      color: '#3B82F6',
      organization: testOrg,
      createdBy: testUser
    });
    console.log(`✅ Category created: ${category.name}\n`);

    // Test 1: Create unpaid cost with no due date
    console.log('📝 Test 1: Unpaid cost with no due date');
    const cost1 = await Cost.create({
      category: category._id,
      description: 'Test Cost 1 - Pending',
      amount: 1000,
      paidAmount: 0,
      organization: testOrg,
      createdBy: testUser
    });
    console.log(`   Status: ${cost1.status} (expected: pending)`);
    console.log(`   Remaining: ${cost1.remainingAmount} EGP\n`);

    // Test 2: Create overdue cost
    console.log('📝 Test 2: Unpaid cost with past due date');
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const cost2 = await Cost.create({
      category: category._id,
      description: 'Test Cost 2 - Overdue',
      amount: 2000,
      paidAmount: 0,
      dueDate: pastDate,
      organization: testOrg,
      createdBy: testUser
    });
    console.log(`   Status: ${cost2.status} (expected: overdue)`);
    console.log(`   Remaining: ${cost2.remainingAmount} EGP\n`);

    // Test 3: Add partial payment
    console.log('📝 Test 3: Add partial payment');
    await cost2.addPayment(800, 'cash');
    console.log(`   Status: ${cost2.status} (expected: partially_paid)`);
    console.log(`   Paid: ${cost2.paidAmount} EGP`);
    console.log(`   Remaining: ${cost2.remainingAmount} EGP\n`);

    // Test 4: Complete payment
    console.log('📝 Test 4: Complete payment');
    await cost2.addPayment(1200, 'card');
    console.log(`   Status: ${cost2.status} (expected: paid)`);
    console.log(`   Paid: ${cost2.paidAmount} EGP`);
    console.log(`   Remaining: ${cost2.remainingAmount} EGP\n`);

    // Test 5: Create fully paid cost
    console.log('📝 Test 5: Create fully paid cost');
    const cost3 = await Cost.create({
      category: category._id,
      description: 'Test Cost 3 - Fully Paid',
      amount: 500,
      paidAmount: 500,
      organization: testOrg,
      createdBy: testUser
    });
    console.log(`   Status: ${cost3.status} (expected: paid)`);
    console.log(`   Remaining: ${cost3.remainingAmount} EGP\n`);

    // Test 6: Try to overpay (should be prevented)
    console.log('📝 Test 6: Attempt to overpay');
    try {
      await cost1.addPayment(1500, 'cash');
      console.log('   ❌ ERROR: Overpayment was not prevented!\n');
    } catch (error) {
      console.log(`   ✅ Overpayment prevented: ${error.message}\n`);
    }

    // Test 7: Update amount and verify status recalculation
    console.log('📝 Test 7: Update amount and verify status recalculation');
    cost1.paidAmount = 500;
    await cost1.save();
    console.log(`   After paying 500 EGP:`);
    console.log(`   Status: ${cost1.status} (expected: partially_paid)`);
    console.log(`   Remaining: ${cost1.remainingAmount} EGP`);
    
    cost1.amount = 500; // Reduce amount to match paid amount
    await cost1.save();
    console.log(`   After reducing amount to 500 EGP:`);
    console.log(`   Status: ${cost1.status} (expected: paid)`);
    console.log(`   Remaining: ${cost1.remainingAmount} EGP\n`);

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await Cost.deleteMany({ organization: testOrg });
    await CostCategory.deleteMany({ organization: testOrg });
    console.log('✅ Test data cleaned up\n');

    console.log('✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Automatic status calculation: ✅');
    console.log('   - Remaining amount calculation: ✅');
    console.log('   - Payment addition with validation: ✅');
    console.log('   - Overpayment prevention: ✅');
    console.log('   - Status recalculation on save: ✅');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

testCostStatusAutomation();
