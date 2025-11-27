/**
 * Integration test for payForItems functionality
 * Tests the complete flow from API endpoint to database
 */

import mongoose from 'mongoose';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';

describe('Pay For Items Integration Test', () => {
  let testOrg;
  let testUser;
  let testBill;
  let testOrder;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba-test');
    }
  });

  beforeEach(async () => {
    // Create test user first (without organization)
    testUser = await User.create({
      name: 'Test User',
      email: 'testuser@test.com',
      password: 'password123',
      role: 'admin',
    });

    // Create test organization with owner
    testOrg = await Organization.create({
      name: 'Test Organization',
      email: 'test@test.com',
      phone: '1234567890',
      owner: testUser._id,
    });

    // Update user with organization
    testUser.organization = testOrg._id;
    await testUser.save();

    // Create test order with items
    testOrder = await Order.create({
      orderNumber: 'ORD-001',
      items: [
        {
          menuItem: new mongoose.Types.ObjectId(),
          name: 'Coffee',
          price: 25,
          quantity: 2,
          itemTotal: 50,
        },
        {
          menuItem: new mongoose.Types.ObjectId(),
          name: 'Tea',
          price: 15,
          quantity: 1,
          itemTotal: 15,
        },
      ],
      subtotal: 65,
      totalAmount: 65,
      finalAmount: 65,
      status: 'pending',
      createdBy: testUser._id,
      organization: testOrg._id,
    });

    // Create test bill
    testBill = await Bill.create({
      orders: [testOrder._id],
      subtotal: 65,
      total: 65,
      paid: 0,
      remaining: 65,
      status: 'draft',
      billType: 'cafe',
      createdBy: testUser._id,
      organization: testOrg._id,
    });

    // Wait for itemPayments to be initialized
    await testBill.save();
  });

  afterEach(async () => {
    // Clean up test data
    await Bill.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('should pay for specific items successfully', async () => {
    // Reload bill to get itemPayments
    const bill = await Bill.findById(testBill._id);
    
    expect(bill.itemPayments).toBeDefined();
    expect(bill.itemPayments.length).toBeGreaterThan(0);

    // Get first item ID
    const firstItemId = bill.itemPayments[0]._id;

    // Pay for first item
    const result = bill.payForItems([firstItemId], 'cash', testUser._id);

    // Save the bill
    await bill.save();

    // Verify result
    expect(result.paidItems).toHaveLength(1);
    expect(result.totalAmount).toBe(bill.itemPayments[0].totalPrice);

    // Verify item is marked as paid
    const paidItem = bill.itemPayments.find(i => i._id.toString() === firstItemId.toString());
    expect(paidItem.isPaid).toBe(true);
    expect(paidItem.paidAmount).toBe(paidItem.totalPrice);
    expect(paidItem.paidBy.toString()).toBe(testUser._id.toString());

    // Verify payment history
    expect(bill.paymentHistory).toHaveLength(1);
    expect(bill.paymentHistory[0].type).toBe('partial-items');
    expect(bill.paymentHistory[0].amount).toBe(result.totalAmount);

    // Verify remaining amount is updated
    expect(bill.paid).toBeGreaterThan(0);
    expect(bill.remaining).toBe(bill.total - bill.paid);
  });

  test('should reject payment for already paid items', async () => {
    const bill = await Bill.findById(testBill._id);
    const firstItemId = bill.itemPayments[0]._id;

    // Pay for first item
    bill.payForItems([firstItemId], 'cash', testUser._id);
    await bill.save();

    // Try to pay for same item again
    expect(() => {
      bill.payForItems([firstItemId], 'cash', testUser._id);
    }).toThrow('مدفوع بالكامل');
  });

  test('should update bill status to paid when all items are paid', async () => {
    const bill = await Bill.findById(testBill._id);
    
    // Pay for all items
    const allItemIds = bill.itemPayments.map(item => item._id);
    bill.payForItems(allItemIds, 'cash', testUser._id);
    await bill.save();

    // Verify bill status
    expect(bill.status).toBe('paid');
    expect(bill.remaining).toBe(0);
    expect(bill.paid).toBe(bill.total);
  });

  test('should calculate remaining amount correctly', async () => {
    const bill = await Bill.findById(testBill._id);
    
    // Pay for first item only
    const firstItemId = bill.itemPayments[0]._id;
    const firstItemPrice = bill.itemPayments[0].totalPrice;
    
    bill.payForItems([firstItemId], 'cash', testUser._id);
    await bill.save();

    // Verify amounts
    expect(bill.paid).toBe(firstItemPrice);
    expect(bill.remaining).toBe(bill.total - firstItemPrice);
    expect(bill.status).toBe('partial');
  });
});
