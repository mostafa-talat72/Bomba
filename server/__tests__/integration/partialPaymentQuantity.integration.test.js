/**
 * Integration test for partial payment with quantity support
 * Tests complete payment flow from frontend to backend
 * 
 * Requirements tested:
 * - 1.1: Calculate payment amount based on specified quantity
 * - 1.2: Update paid and remaining quantities correctly
 * - 1.3: Record quantity in payment history
 * - 1.4: Display paid and remaining quantities
 * - 1.5: Prevent duplicate payments
 * - 2.1: Calculate remaining amount based on unpaid quantities
 * - 2.2: Aggregate paid amounts correctly
 * - 2.3: Update bill status to "paid" when all quantities paid
 * - 2.4: Update bill status to "partial" when some quantities paid
 */

import mongoose from 'mongoose';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';

describe('Partial Payment with Quantity Support - Integration Tests', () => {
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
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: `testuser${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin',
    });

    // Create test organization
    testOrg = await Organization.create({
      name: 'Test Organization',
      email: `test${Date.now()}@test.com`,
      phone: '1234567890',
      owner: testUser._id,
    });

    // Update user with organization
    testUser.organization = testOrg._id;
    await testUser.save();

    // Create test order with multiple items
    testOrder = await Order.create({
      orderNumber: `ORD-${Date.now()}`,
      items: [
        {
          menuItem: new mongoose.Types.ObjectId(),
          name: 'Coffee',
          price: 25,
          quantity: 3, // 3 coffees
          itemTotal: 75,
        },
        {
          menuItem: new mongoose.Types.ObjectId(),
          name: 'Tea',
          price: 15,
          quantity: 2, // 2 teas
          itemTotal: 30,
        },
        {
          menuItem: new mongoose.Types.ObjectId(),
          name: 'Cake',
          price: 40,
          quantity: 1, // 1 cake
          itemTotal: 40,
        },
      ],
      subtotal: 145,
      totalAmount: 145,
      finalAmount: 145,
      status: 'pending',
      createdBy: testUser._id,
      organization: testOrg._id,
    });

    // Create test bill
    testBill = await Bill.create({
      orders: [testOrder._id],
      subtotal: 145,
      total: 145,
      paid: 0,
      remaining: 145,
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

  // Test 1: Complete payment flow from frontend to backend
  describe('Complete Payment Flow', () => {
    test('should process payment for partial quantity successfully', async () => {
      // Reload bill to get itemPayments
      const bill = await Bill.findById(testBill._id);
      
      expect(bill.itemPayments).toBeDefined();
      expect(bill.itemPayments.length).toBe(3);

      // Find Coffee item (quantity: 3, price: 25)
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(coffeeItem).toBeDefined();
      expect(coffeeItem.quantity).toBe(3);
      expect(coffeeItem.paidQuantity).toBe(0);

      // Pay for 2 coffees (partial quantity)
      const result = bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 2 }],
        'cash',
        testUser._id
      );

      await bill.save();

      // Verify result (Requirement 1.1: Calculate payment amount)
      expect(result.paidItems).toHaveLength(1);
      expect(result.totalAmount).toBe(50); // 2 * 25
      expect(result.paidItems[0].quantity).toBe(2);
      expect(result.paidItems[0].amount).toBe(50);

      // Verify quantity tracking (Requirement 1.2: Update quantities)
      const updatedItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedItem.paidQuantity).toBe(2);
      expect(updatedItem.quantity - updatedItem.paidQuantity).toBe(1); // remaining
      expect(updatedItem.isPaid).toBe(false); // not fully paid yet

      // Verify payment history (Requirement 1.3: Record in history)
      expect(updatedItem.paymentHistory).toHaveLength(1);
      expect(updatedItem.paymentHistory[0].quantity).toBe(2);
      expect(updatedItem.paymentHistory[0].amount).toBe(50);
      expect(updatedItem.paymentHistory[0].method).toBe('cash');

      // Verify bill amounts (Requirement 2.1: Calculate remaining)
      expect(bill.paid).toBe(50);
      expect(bill.remaining).toBe(95); // 145 - 50
      expect(bill.status).toBe('partial'); // Requirement 2.4
    });

    test('should display paid and remaining quantities correctly', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // Pay for 2 out of 3 coffees
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 2 }],
        'cash',
        testUser._id
      );
      await bill.save();

      // Reload to verify saved data (Requirement 1.4: Display data)
      const reloadedBill = await Bill.findById(testBill._id);
      const reloadedItem = reloadedBill.itemPayments.find(i => i.itemName === 'Coffee');

      expect(reloadedItem.quantity).toBe(3); // original quantity
      expect(reloadedItem.paidQuantity).toBe(2); // paid quantity
      expect(reloadedItem.quantity - reloadedItem.paidQuantity).toBe(1); // remaining
      expect(reloadedItem.paidAmount).toBe(50); // 2 * 25
    });
  });

  // Test 2: Multiple partial payments on same item
  describe('Multiple Partial Payments on Same Item', () => {
    test('should handle multiple partial payments on same item', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // First payment: 1 coffee
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 1 }],
        'cash',
        testUser._id
      );
      await bill.save();

      // Verify first payment
      let updatedItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedItem.paidQuantity).toBe(1);
      expect(updatedItem.paymentHistory).toHaveLength(1);
      expect(bill.paid).toBe(25);
      expect(bill.status).toBe('partial');

      // Second payment: 1 more coffee
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 1 }],
        'card',
        testUser._id
      );
      await bill.save();

      // Verify second payment
      updatedItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedItem.paidQuantity).toBe(2);
      expect(updatedItem.paymentHistory).toHaveLength(2);
      expect(updatedItem.paymentHistory[1].method).toBe('card');
      expect(bill.paid).toBe(50);

      // Third payment: final coffee
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 1 }],
        'transfer',
        testUser._id
      );
      await bill.save();

      // Verify third payment and full payment
      updatedItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedItem.paidQuantity).toBe(3);
      expect(updatedItem.isPaid).toBe(true);
      expect(updatedItem.paymentHistory).toHaveLength(3);
      expect(bill.paid).toBe(75);
    });

    test('should track payment history correctly for multiple payments', async () => {
      const bill = await Bill.findById(testBill._id);
      const teaItem = bill.itemPayments.find(i => i.itemName === 'Tea');

      // Pay 1 tea at a time
      bill.payForItems([{ itemId: teaItem._id, quantity: 1 }], 'cash', testUser._id);
      await bill.save();

      bill.payForItems([{ itemId: teaItem._id, quantity: 1 }], 'card', testUser._id);
      await bill.save();

      // Verify payment history
      const updatedItem = bill.itemPayments.find(i => i.itemName === 'Tea');
      expect(updatedItem.paymentHistory).toHaveLength(2);
      expect(updatedItem.paymentHistory[0].quantity).toBe(1);
      expect(updatedItem.paymentHistory[0].amount).toBe(15);
      expect(updatedItem.paymentHistory[0].method).toBe('cash');
      expect(updatedItem.paymentHistory[1].quantity).toBe(1);
      expect(updatedItem.paymentHistory[1].amount).toBe(15);
      expect(updatedItem.paymentHistory[1].method).toBe('card');
    });
  });

  // Test 3: Payment of multiple items with different quantities
  describe('Multiple Items with Different Quantities', () => {
    test('should pay for multiple items with different quantities', async () => {
      const bill = await Bill.findById(testBill._id);
      
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      const teaItem = bill.itemPayments.find(i => i.itemName === 'Tea');
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // Pay for: 2 coffees, 1 tea, 1 cake
      const result = bill.payForItems(
        [
          { itemId: coffeeItem._id, quantity: 2 },
          { itemId: teaItem._id, quantity: 1 },
          { itemId: cakeItem._id, quantity: 1 },
        ],
        'cash',
        testUser._id
      );

      await bill.save();

      // Verify total amount (Requirement 2.2: Aggregate amounts)
      expect(result.totalAmount).toBe(105); // (2*25) + (1*15) + (1*40)
      expect(result.paidItems).toHaveLength(3);

      // Verify each item
      const updatedCoffee = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedCoffee.paidQuantity).toBe(2);
      expect(updatedCoffee.paidAmount).toBe(50);

      const updatedTea = bill.itemPayments.find(i => i.itemName === 'Tea');
      expect(updatedTea.paidQuantity).toBe(1);
      expect(updatedTea.paidAmount).toBe(15);

      const updatedCake = bill.itemPayments.find(i => i.itemName === 'Cake');
      expect(updatedCake.paidQuantity).toBe(1);
      expect(updatedCake.paidAmount).toBe(40);
      expect(updatedCake.isPaid).toBe(true); // fully paid

      // Verify bill totals
      expect(bill.paid).toBe(105);
      expect(bill.remaining).toBe(40); // 145 - 105
      expect(bill.status).toBe('partial');
    });

    test('should handle mixed partial and full payments', async () => {
      const bill = await Bill.findById(testBill._id);
      
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // Pay for: 1 coffee (partial) and 1 cake (full)
      bill.payForItems(
        [
          { itemId: coffeeItem._id, quantity: 1 },
          { itemId: cakeItem._id, quantity: 1 },
        ],
        'cash',
        testUser._id
      );

      await bill.save();

      // Verify coffee is partially paid
      const updatedCoffee = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedCoffee.paidQuantity).toBe(1);
      expect(updatedCoffee.isPaid).toBe(false);

      // Verify cake is fully paid
      const updatedCake = bill.itemPayments.find(i => i.itemName === 'Cake');
      expect(updatedCake.paidQuantity).toBe(1);
      expect(updatedCake.isPaid).toBe(true);

      expect(bill.paid).toBe(65); // 25 + 40
      expect(bill.status).toBe('partial');
    });
  });

  // Test 4: Error scenarios
  describe('Error Scenarios', () => {
    test('should reject overpayment (quantity > remaining)', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // Try to pay for 5 coffees when only 3 exist
      expect(() => {
        bill.payForItems(
          [{ itemId: coffeeItem._id, quantity: 5 }],
          'cash',
          testUser._id
        );
      }).toThrow('الكمية المطلوبة (5) أكبر من الكمية المتبقية (3)');

      // Verify nothing was changed
      expect(coffeeItem.paidQuantity).toBe(0);
      expect(bill.paid).toBe(0);
    });

    test('should reject payment after partial payment exceeds remaining', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // Pay for 2 coffees first
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 2 }],
        'cash',
        testUser._id
      );
      await bill.save();

      // Try to pay for 2 more (only 1 remaining)
      expect(() => {
        bill.payForItems(
          [{ itemId: coffeeItem._id, quantity: 2 }],
          'cash',
          testUser._id
        );
      }).toThrow('الكمية المطلوبة (2) أكبر من الكمية المتبقية (1)');
    });

    test('should reject invalid quantities (zero)', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      expect(() => {
        bill.payForItems(
          [{ itemId: coffeeItem._id, quantity: 0 }],
          'cash',
          testUser._id
        );
      }).toThrow('يجب إدخال كمية صحيحة أكبر من صفر');
    });

    test('should reject invalid quantities (negative)', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      expect(() => {
        bill.payForItems(
          [{ itemId: coffeeItem._id, quantity: -1 }],
          'cash',
          testUser._id
        );
      }).toThrow('يجب إدخال كمية صحيحة أكبر من صفر');
    });

    test('should reject payment for fully paid item', async () => {
      const bill = await Bill.findById(testBill._id);
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // Pay for the cake (quantity: 1)
      bill.payForItems(
        [{ itemId: cakeItem._id, quantity: 1 }],
        'cash',
        testUser._id
      );
      await bill.save();

      // Try to pay again
      expect(() => {
        bill.payForItems(
          [{ itemId: cakeItem._id, quantity: 1 }],
          'cash',
          testUser._id
        );
      }).toThrow('مدفوع بالكامل');
    });

    test('should reject payment for non-existent item', async () => {
      const bill = await Bill.findById(testBill._id);
      const fakeItemId = new mongoose.Types.ObjectId();

      expect(() => {
        bill.payForItems(
          [{ itemId: fakeItemId, quantity: 1 }],
          'cash',
          testUser._id
        );
      }).toThrow('غير موجود في الفاتورة');
    });

    test('should reject empty items array', async () => {
      const bill = await Bill.findById(testBill._id);

      expect(() => {
        bill.payForItems([], 'cash', testUser._id);
      }).toThrow('يجب تحديد الأصناف والكميات المراد دفعها');
    });
  });

  // Test 5: Bill status updates
  describe('Bill Status Updates', () => {
    test('should update status to "paid" when all items fully paid', async () => {
      const bill = await Bill.findById(testBill._id);
      
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      const teaItem = bill.itemPayments.find(i => i.itemName === 'Tea');
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // Pay for all items with full quantities
      bill.payForItems(
        [
          { itemId: coffeeItem._id, quantity: 3 },
          { itemId: teaItem._id, quantity: 2 },
          { itemId: cakeItem._id, quantity: 1 },
        ],
        'cash',
        testUser._id
      );

      await bill.save();

      // Verify status (Requirement 2.3: Status = "paid")
      expect(bill.status).toBe('paid');
      expect(bill.paid).toBe(145);
      expect(bill.remaining).toBe(0);

      // Verify all items are fully paid
      bill.itemPayments.forEach(item => {
        expect(item.isPaid).toBe(true);
        expect(item.paidQuantity).toBe(item.quantity);
      });
    });

    test('should update status to "partial" when some quantities paid', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // Pay for 1 out of 3 coffees
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 1 }],
        'cash',
        testUser._id
      );

      await bill.save();

      // Verify status (Requirement 2.4: Status = "partial")
      expect(bill.status).toBe('partial');
      expect(bill.paid).toBe(25);
      expect(bill.remaining).toBe(120);
    });

    test('should maintain "draft" status when no payment made', async () => {
      const bill = await Bill.findById(testBill._id);

      // No payment made
      expect(bill.status).toBe('draft');
      expect(bill.paid).toBe(0);
      expect(bill.remaining).toBe(145);
    });

    test('should transition from partial to paid correctly', async () => {
      const bill = await Bill.findById(testBill._id);
      
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      const teaItem = bill.itemPayments.find(i => i.itemName === 'Tea');
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // First payment: partial
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 1 }],
        'cash',
        testUser._id
      );
      await bill.save();
      expect(bill.status).toBe('partial');

      // Second payment: complete the rest
      bill.payForItems(
        [
          { itemId: coffeeItem._id, quantity: 2 },
          { itemId: teaItem._id, quantity: 2 },
          { itemId: cakeItem._id, quantity: 1 },
        ],
        'cash',
        testUser._id
      );
      await bill.save();

      // Should now be fully paid
      expect(bill.status).toBe('paid');
      expect(bill.paid).toBe(145);
      expect(bill.remaining).toBe(0);
    });
  });

  // Test 6: Backward compatibility
  describe('Backward Compatibility', () => {
    test('should handle payment without quantity (pay all remaining)', async () => {
      const bill = await Bill.findById(testBill._id);
      const cakeItem = bill.itemPayments.find(i => i.itemName === 'Cake');

      // Pay without specifying quantity (old API style)
      const result = bill.payForItems(
        [cakeItem._id], // Just itemId, no quantity object
        'cash',
        testUser._id
      );

      await bill.save();

      // Should pay for all remaining quantity
      const updatedItem = bill.itemPayments.find(i => i.itemName === 'Cake');
      expect(updatedItem.paidQuantity).toBe(1);
      expect(updatedItem.isPaid).toBe(true);
      expect(result.totalAmount).toBe(40);
    });
  });

  // Test 7: Prevent duplicate payments (Requirement 1.5)
  describe('Duplicate Payment Prevention', () => {
    test('should prevent paying same quantity twice', async () => {
      const bill = await Bill.findById(testBill._id);
      const coffeeItem = bill.itemPayments.find(i => i.itemName === 'Coffee');

      // Pay for all 3 coffees
      bill.payForItems(
        [{ itemId: coffeeItem._id, quantity: 3 }],
        'cash',
        testUser._id
      );
      await bill.save();

      // Try to pay again
      expect(() => {
        bill.payForItems(
          [{ itemId: coffeeItem._id, quantity: 1 }],
          'cash',
          testUser._id
        );
      }).toThrow('مدفوع بالكامل');

      // Verify no duplicate payment
      const updatedItem = bill.itemPayments.find(i => i.itemName === 'Coffee');
      expect(updatedItem.paidQuantity).toBe(3);
      expect(updatedItem.paymentHistory).toHaveLength(1);
    });
  });
});
