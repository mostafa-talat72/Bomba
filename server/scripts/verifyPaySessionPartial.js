/**
 * Verification script for paySessionPartial functionality
 * This script verifies that all components are properly implemented
 */

import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import '../config/database.js';

async function verifyImplementation() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');

    // 1. Verify Bill model has paySessionPartial method
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

    if (typeof bill.paySessionPartial !== 'function') {
      process.exit(1);
    }

    if (typeof bill.calculateRemainingAmount !== 'function') {
      process.exit(1);
    }

    // 2. Verify schema has sessionPayments field
    const schema = Bill.schema;
    
    if (!schema.path('sessionPayments')) {
      process.exit(1);
    }

    if (!schema.path('paymentHistory')) {
      process.exit(1);
    }

    // 3. Test the method logic
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
      
      if (result.paidAmount !== 50) {
        process.exit(1);
      }
      
      if (result.remaining !== 50) {
        process.exit(1);
      }
    } catch (error) {
      process.exit(1);
    }

    // Test overpayment rejection
    try {
      bill.paySessionPartial(testSessionId, 100, 'cash', testUserId);
      process.exit(1);
    } catch (error) {
      // Expected to fail
    }

    // Test invalid amount rejection
    try {
      bill.paySessionPartial(testSessionId, 0, 'cash', testUserId);
      process.exit(1);
    } catch (error) {
      // Expected to fail
    }

    // 4. Verify calculateRemainingAmount includes sessionPayments
    bill.calculateRemainingAmount();
    
    if (bill.paid !== 50) {
      process.exit(1);
    }

    // 5. Verify payment history
    if (bill.paymentHistory.length !== 1) {
      process.exit(1);
    }
    
    const historyEntry = bill.paymentHistory[0];
    if (historyEntry.type !== 'partial-session') {
      process.exit(1);
    }

  } catch (error) {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

verifyImplementation();
