/**
 * Verification script for paySessionPartial functionality
 * This script verifies that all components are properly implemented
 */

import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import '../config/database.js';

async function verifyImplementation() {
  console.log('🔍 Verifying paySessionPartial implementation...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');
    console.log('✅ Connected to database\n');

    // 1. Verify Bill model has paySessionPartial method
    console.log('1. Checking Bill model methods...');
    const bill = new Bill({
      billNumber: 'TEST-VERIFY',
      subtotal: 100,
      total: 100,
      paid: 0,
      remaining: 100,
      status: 'draft',
      billType: 'playstation',
      createdBy: new mongoose.Types.ObjectId(),
      organization: new mongoose.Types.ObjectId(),
    });

    if (typeof bill.paySessionPartial === 'function') {
      console.log('   ✅ paySessionPartial method exists');
    } else {
      console.log('   ❌ paySessionPartial method NOT found');
      process.exit(1);
    }

    if (typeof bill.calculateRemainingAmount === 'function') {
      console.log('   ✅ calculateRemainingAmount method exists');
    } else {
      console.log('   ❌ calculateRemainingAmount method NOT found');
      process.exit(1);
    }

    // 2. Verify schema has sessionPayments field
    console.log('\n2. Checking Bill schema fields...');
    const schema = Bill.schema;
    
    if (schema.path('sessionPayments')) {
      console.log('   ✅ sessionPayments field exists in schema');
    } else {
      console.log('   ❌ sessionPayments field NOT found in schema');
      process.exit(1);
    }

    if (schema.path('paymentHistory')) {
      console.log('   ✅ paymentHistory field exists in schema');
    } else {
      console.log('   ❌ paymentHistory field NOT found in schema');
      process.exit(1);
    }

    // 3. Test the method logic
    console.log('\n3. Testing paySessionPartial method logic...');
    
    const testSessionId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    
    // Initialize sessionPayments
    bill.sessionPayments = [{
      sessionId: testSessionId,
      sessionCost: 100,
      paidAmount: 0,
      remainingAmount: 100,
      payments: [],
    }];

    // Test valid payment
    try {
      const result = bill.paySessionPartial(testSessionId, 50, 'cash', testUserId);
      console.log('   ✅ Valid payment accepted');
      console.log(`      - Paid amount: ${result.paidAmount}`);
      console.log(`      - Remaining: ${result.remaining}`);
      
      if (result.paidAmount !== 50) {
        console.log('   ❌ Incorrect paid amount');
        process.exit(1);
      }
      
      if (result.remaining !== 50) {
        console.log('   ❌ Incorrect remaining amount');
        process.exit(1);
      }
    } catch (error) {
      console.log(`   ❌ Valid payment rejected: ${error.message}`);
      process.exit(1);
    }

    // Test overpayment rejection
    try {
      bill.paySessionPartial(testSessionId, 100, 'cash', testUserId);
      console.log('   ❌ Overpayment was NOT rejected');
      process.exit(1);
    } catch (error) {
      console.log('   ✅ Overpayment correctly rejected');
    }

    // Test invalid amount rejection
    try {
      bill.paySessionPartial(testSessionId, 0, 'cash', testUserId);
      console.log('   ❌ Invalid amount (0) was NOT rejected');
      process.exit(1);
    } catch (error) {
      console.log('   ✅ Invalid amount correctly rejected');
    }

    // 4. Verify calculateRemainingAmount includes sessionPayments
    console.log('\n4. Testing calculateRemainingAmount...');
    bill.calculateRemainingAmount();
    
    if (bill.paid === 50) {
      console.log('   ✅ calculateRemainingAmount correctly includes sessionPayments');
      console.log(`      - Total paid: ${bill.paid}`);
      console.log(`      - Remaining: ${bill.remaining}`);
    } else {
      console.log(`   ❌ calculateRemainingAmount incorrect: paid=${bill.paid}, expected=50`);
      process.exit(1);
    }

    // 5. Verify payment history
    console.log('\n5. Checking payment history...');
    if (bill.paymentHistory.length === 1) {
      console.log('   ✅ Payment recorded in history');
      const historyEntry = bill.paymentHistory[0];
      console.log(`      - Type: ${historyEntry.type}`);
      console.log(`      - Amount: ${historyEntry.amount}`);
      
      if (historyEntry.type !== 'partial-session') {
        console.log('   ❌ Incorrect payment type in history');
        process.exit(1);
      }
    } else {
      console.log(`   ❌ Payment history incorrect: ${bill.paymentHistory.length} entries`);
      process.exit(1);
    }

    console.log('\n✅ All verifications passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Bill.paySessionPartial() method implemented');
    console.log('   ✅ Bill.calculateRemainingAmount() handles sessionPayments');
    console.log('   ✅ Schema includes sessionPayments and paymentHistory');
    console.log('   ✅ Payment validation works correctly');
    console.log('   ✅ Payment history tracking works correctly');
    
    console.log('\n🎉 Implementation is complete and working correctly!');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

verifyImplementation();
