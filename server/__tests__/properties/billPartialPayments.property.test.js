/**
 * Property-Based Tests for Bill Partial Payments
 * Feature: table-based-billing-enhancements
 * 
 * These tests use fast-check to verify correctness properties across many random inputs
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';
import Session from '../../models/Session.js';
import Table from '../../models/Table.js';
import User from '../../models/User.js';

describe('Property-Based Tests: Bill Partial Payments', () => {
  let mongoServer;
  let testOrganizationId;
  let testUserId;
  let testTableId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testTableId = new mongoose.Types.ObjectId();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await Bill.deleteMany({});
    await Order.deleteMany({});
    await Session.deleteMany({});
    await Table.deleteMany({});
    await User.deleteMany({});
  }, 10000);

  /**
   * Helper function to create a bill with items
   */
  async function createBillWithItems(itemsData) {
    const bill = new Bill({
      organization: testOrganizationId,
      createdBy: testUserId,
      table: testTableId,
      billType: 'cafe',
      subtotal: 0,
      total: 0,
      paid: 0,
      remaining: 0,
      status: 'draft',
      itemPayments: itemsData.map((item, index) => ({
        orderId: new mongoose.Types.ObjectId(),
        itemId: `order-${index}`,
        itemName: item.name,
        quantity: item.quantity,
        pricePerUnit: item.price,
        totalPrice: item.price * item.quantity,
        paidAmount: 0,
        isPaid: false
      }))
    }, 30000);

    // Calculate total
    bill.total = bill.itemPayments.reduce((sum, item) => sum + item.totalPrice, 0);
    bill.subtotal = bill.total;
    bill.remaining = bill.total;

    await bill.save();
    return bill;
  }

  /**
   * Helper function to create a bill with sessions
   */
  async function createBillWithSessions(sessionsData) {
    const bill = new Bill({
      organization: testOrganizationId,
      createdBy: testUserId,
      table: testTableId,
      billType: 'playstation',
      subtotal: 0,
      total: 0,
      paid: 0,
      remaining: 0,
      status: 'draft',
      sessionPayments: sessionsData.map(session => ({
        sessionId: new mongoose.Types.ObjectId(),
        sessionCost: session.cost,
        paidAmount: 0,
        remainingAmount: session.cost,
        payments: []
      }))
    }, 30000);

    // Calculate total
    bill.total = bill.sessionPayments.reduce((sum, session) => sum + session.sessionCost, 0);
    bill.subtotal = bill.total;
    bill.remaining = bill.total;

    await bill.save();
    return bill;
  }

  /**
   * Feature: table-based-billing-enhancements, Property 15: Remaining amount calculation
   * For any bill, the remaining amount should equal total minus (sum of itemPayments.paidAmount + 
   * sum of sessionPayments.paidAmount + sum of payments.amount)
   * Validates: Requirements 7.1, 7.2, 7.4
   */
  describe('Property 15: Remaining amount calculation', () => {
    it('should calculate remaining amount correctly for all payment combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
                price: fc.double({ min: 1, max: 100, noNaN: true }),
                quantity: fc.integer({ min: 1, max: 5 })
              }),
              { minLength: 1, maxLength: 5 }
            ),
            sessions: fc.array(
              fc.record({
                cost: fc.double({ min: 10, max: 200, noNaN: true })
              }),
              { minLength: 0, maxLength: 3 }
            )
          }),
          async (data) => {
            // Create bill with items and sessions
            const bill = new Bill({
              organization: testOrganizationId,
              createdBy: testUserId,
              table: testTableId,
              billType: 'cafe',
              subtotal: 0,
              total: 0,
              paid: 0,
              remaining: 0,
              status: 'draft',
              itemPayments: data.items.map((item, index) => ({
                orderId: new mongoose.Types.ObjectId(),
                itemId: `item-${index}`,
                itemName: item.name,
                quantity: item.quantity,
                pricePerUnit: item.price,
                totalPrice: item.price * item.quantity,
                paidAmount: 0,
                isPaid: false
              })),
              sessionPayments: data.sessions.map(session => ({
                sessionId: new mongoose.Types.ObjectId(),
                sessionCost: session.cost,
                paidAmount: 0,
                remainingAmount: session.cost,
                payments: []
              }))
            }, 30000);

            // Calculate total
            const itemsTotal = bill.itemPayments.reduce((sum, item) => sum + item.totalPrice, 0);
            const sessionsTotal = bill.sessionPayments.reduce((sum, session) => sum + session.sessionCost, 0);
            bill.total = itemsTotal + sessionsTotal;
            bill.subtotal = bill.total;
            bill.remaining = bill.total;

            await bill.save();

            // Pay for some items randomly
            const itemsToPay = bill.itemPayments.slice(0, Math.floor(bill.itemPayments.length / 2));
            itemsToPay.forEach(item => {
              item.isPaid = true;
              item.paidAmount = item.totalPrice;
            }, 30000);

            // Pay partial amounts for sessions
            bill.sessionPayments.forEach(session => {
              const partialAmount = session.sessionCost / 2;
              session.paidAmount = partialAmount;
              session.remainingAmount = session.sessionCost - partialAmount;
            }, 30000);

            // Calculate remaining
            const remaining = bill.calculateRemainingAmount();

            // Verify: remaining = total - all payments
            const expectedPaid = itemsToPay.reduce((sum, item) => sum + item.paidAmount, 0) +
                                 bill.sessionPayments.reduce((sum, session) => sum + session.paidAmount, 0);
            const expectedRemaining = bill.total - expectedPaid;

            expect(Math.abs(remaining - expectedRemaining)).toBeLessThan(0.01);
            expect(Math.abs(bill.paid - expectedPaid)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 5: Item payment total equals sum of selected items
   * For any set of selected items from a bill, the calculated payment total should equal 
   * the sum of (price × quantity) for all selected items
   * Validates: Requirements 3.2
   */
  describe('Property 5: Item payment total equals sum of selected items', () => {
    it('should calculate correct total for any selection of items', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              price: fc.double({ min: 1, max: 100, noNaN: true }),
              quantity: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (items) => {
            const bill = await createBillWithItems(items);

            // Select random subset of items to pay
            const numItemsToPay = Math.max(1, Math.floor(Math.random() * bill.itemPayments.length));
            const itemsToPay = bill.itemPayments.slice(0, numItemsToPay);
            const itemIds = itemsToPay.map(item => item._id);

            // Calculate expected total
            const expectedTotal = itemsToPay.reduce((sum, item) => sum + item.totalPrice, 0);

            // Pay for items
            const result = bill.payForItems(itemIds, 'cash', testUserId);

            // Verify: total equals sum of selected items
            expect(Math.abs(result.totalAmount - expectedTotal)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 6: Item payment updates status and history
   * For any set of items paid, those items should be marked as paid (isPaid = true), 
   * the bill's paid amount should increase by the total, and a payment history record 
   * should be created with the specific items paid
   * Validates: Requirements 3.3, 3.4
   */
  describe('Property 6: Item payment updates status and history', () => {
    it('should update item status, bill amount, and history for all payments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              price: fc.double({ min: 1, max: 100, noNaN: true }),
              quantity: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (items) => {
            const bill = await createBillWithItems(items);
            const initialPaid = bill.paid;
            const initialHistoryLength = bill.paymentHistory.length;

            // Select items to pay
            const numItemsToPay = Math.max(1, Math.floor(Math.random() * bill.itemPayments.length));
            const itemsToPay = bill.itemPayments.slice(0, numItemsToPay);
            const itemIds = itemsToPay.map(item => item._id);
            const expectedTotal = itemsToPay.reduce((sum, item) => sum + item.totalPrice, 0);

            // Pay for items
            bill.payForItems(itemIds, 'cash', testUserId);

            // Verify: items marked as paid
            itemsToPay.forEach(item => {
              const paidItem = bill.itemPayments.find(i => i._id.toString() === item._id.toString());
              expect(paidItem.isPaid).toBe(true);
              expect(paidItem.paidAmount).toBe(paidItem.totalPrice);
              expect(paidItem.paidBy).toEqual(testUserId);
            }, 30000);

            // Verify: bill paid amount increased
            expect(Math.abs(bill.paid - (initialPaid + expectedTotal))).toBeLessThan(0.01);

            // Verify: payment history record created
            expect(bill.paymentHistory.length).toBe(initialHistoryLength + 1);
            const lastPayment = bill.paymentHistory[bill.paymentHistory.length - 1];
            expect(lastPayment.type).toBe('partial-items');
            expect(Math.abs(lastPayment.amount - expectedTotal)).toBeLessThan(0.01);
            expect(lastPayment.details.paidItems.length).toBe(itemsToPay.length);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 7: Cannot pay same item twice
   * For any item that is already marked as paid (isPaid = true), attempting to pay 
   * for it again should be rejected or have no effect
   * Validates: Requirements 3.5
   */
  describe('Property 7: Cannot pay same item twice', () => {
    it('should reject payment for already paid items', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              price: fc.double({ min: 1, max: 100, noNaN: true }),
              quantity: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (items) => {
            const bill = await createBillWithItems(items);

            // Pay for first item
            const firstItemId = bill.itemPayments[0]._id;
            bill.payForItems([firstItemId], 'cash', testUserId);

            // Try to pay for same item again
            try {
              bill.payForItems([firstItemId], 'cash', testUserId);
              // Should throw error
              expect(true).toBe(false); // Fail if no error thrown
            } catch (error) {
              // Verify: error message indicates item already paid
              expect(error.message).toContain('مدفوع بالكامل');
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 8: Session partial payment validation
   * For any session partial payment amount, the amount must be greater than 0 and 
   * less than or equal to the session's remaining unpaid amount
   * Validates: Requirements 4.2
   */
  describe('Property 8: Session partial payment validation', () => {
    it('should validate payment amount against remaining balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionCost: fc.double({ min: 50, max: 500, noNaN: true }),
            paymentAmount: fc.double({ min: -10, max: 600, noNaN: true })
          }),
          async (data) => {
            const bill = await createBillWithSessions([{ cost: data.sessionCost }]);
            const sessionId = bill.sessionPayments[0].sessionId;
            const remainingAmount = bill.sessionPayments[0].remainingAmount;

            if (data.paymentAmount <= 0 || data.paymentAmount > remainingAmount) {
              // Should reject invalid amounts
              try {
                bill.paySessionPartial(sessionId, data.paymentAmount, 'cash', testUserId);
                expect(true).toBe(false); // Should have thrown error
              } catch (error) {
                expect(error.message).toBeTruthy();
              }
            } else {
              // Should accept valid amounts
              const result = bill.paySessionPartial(sessionId, data.paymentAmount, 'cash', testUserId);
              expect(result.paidAmount).toBe(data.paymentAmount);
              expect(Math.abs(result.remaining - (remainingAmount - data.paymentAmount))).toBeLessThan(0.01);
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 9: Session partial payments accumulate correctly
   * For any sequence of partial payments for a session, the sum of all payment amounts 
   * should equal the session's paidAmount, and remainingAmount should equal sessionCost minus paidAmount
   * Validates: Requirements 4.3, 4.4
   */
  describe('Property 9: Session partial payments accumulate correctly', () => {
    it('should accumulate payments correctly for any sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionCost: fc.double({ min: 100, max: 500, noNaN: true }),
            numPayments: fc.integer({ min: 2, max: 5 })
          }),
          async (data) => {
            const bill = await createBillWithSessions([{ cost: data.sessionCost }]);
            const sessionId = bill.sessionPayments[0].sessionId;

            // Make multiple partial payments
            const paymentAmount = data.sessionCost / data.numPayments;
            
            for (let i = 0; i < data.numPayments - 1; i++) {
              bill.paySessionPartial(sessionId, paymentAmount, 'cash', testUserId);
            }

            const sessionPayment = bill.sessionPayments.find(
              s => s.sessionId.toString() === sessionId.toString()
            );

            // Verify: sum of payments equals paidAmount
            const sumOfPayments = sessionPayment.payments.reduce((sum, p) => sum + p.amount, 0);
            expect(Math.abs(sumOfPayments - sessionPayment.paidAmount)).toBeLessThan(0.01);

            // Verify: remainingAmount = sessionCost - paidAmount
            const expectedRemaining = sessionPayment.sessionCost - sessionPayment.paidAmount;
            expect(Math.abs(sessionPayment.remainingAmount - expectedRemaining)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 10: Session allows payments until fully paid
   * For any session, partial payments should be accepted as long as remainingAmount > 0, 
   * and rejected when remainingAmount = 0
   * Validates: Requirements 4.5
   */
  describe('Property 10: Session allows payments until fully paid', () => {
    it('should accept payments while remaining > 0 and reject at 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 50, max: 200, noNaN: true }),
          async (sessionCost) => {
            const bill = await createBillWithSessions([{ cost: sessionCost }]);
            const sessionId = bill.sessionPayments[0].sessionId;

            // Pay full amount
            bill.paySessionPartial(sessionId, sessionCost, 'cash', testUserId);

            const sessionPayment = bill.sessionPayments.find(
              s => s.sessionId.toString() === sessionId.toString()
            );

            // Verify: remaining is 0
            expect(sessionPayment.remainingAmount).toBe(0);

            // Try to pay more
            try {
              bill.paySessionPartial(sessionId, 1, 'cash', testUserId);
              expect(true).toBe(false); // Should have thrown error
            } catch (error) {
              expect(error.message).toContain('أكبر من المبلغ المتبقي');
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 11: Payment history contains complete data
   * For any payment recorded, the payment history entry should contain timestamp, amount, 
   * method, paidBy user, type, and details (paidItems or paidSessions as applicable)
   * Validates: Requirements 5.2, 5.3, 5.4, 6.2
   */
  describe('Property 11: Payment history contains complete data', () => {
    it('should record complete payment data in history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
                price: fc.double({ min: 1, max: 100, noNaN: true }),
                quantity: fc.integer({ min: 1, max: 5 })
              }),
              { minLength: 1, maxLength: 5 }
            ),
            paymentMethod: fc.constantFrom('cash', 'card', 'transfer')
          }),
          async (data) => {
            const bill = await createBillWithItems(data.items);
            const itemIds = bill.itemPayments.map(item => item._id);

            // Pay for items
            bill.payForItems(itemIds, data.paymentMethod, testUserId);

            // Verify: payment history has complete data
            const lastPayment = bill.paymentHistory[bill.paymentHistory.length - 1];
            expect(lastPayment.timestamp).toBeTruthy();
            expect(lastPayment.amount).toBeGreaterThan(0);
            expect(lastPayment.method).toBe(data.paymentMethod);
            expect(lastPayment.paidBy).toEqual(testUserId);
            expect(lastPayment.type).toBe('partial-items');
            expect(lastPayment.details).toBeTruthy();
            expect(lastPayment.details.paidItems).toBeTruthy();
            expect(lastPayment.details.paidItems.length).toBe(data.items.length);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 12: Payment history consistency
   * For any bill, the sum of all amounts in paymentHistory should equal the bill's paid amount
   * Validates: Requirements 6.5
   */
  describe('Property 12: Payment history consistency', () => {
    it('should maintain consistency between history and paid amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
                price: fc.double({ min: 1, max: 100, noNaN: true }),
                quantity: fc.integer({ min: 1, max: 5 })
              }),
              { minLength: 2, maxLength: 10 }
            ),
            sessions: fc.array(
              fc.record({
                cost: fc.double({ min: 10, max: 200, noNaN: true })
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (data) => {
            // Create bill with items and sessions
            const bill = new Bill({
              organization: testOrganizationId,
              createdBy: testUserId,
              table: testTableId,
              billType: 'cafe',
              subtotal: 0,
              total: 0,
              paid: 0,
              remaining: 0,
              status: 'draft',
              itemPayments: data.items.map((item, index) => ({
                orderId: new mongoose.Types.ObjectId(),
                itemId: `item-${index}`,
                itemName: item.name,
                quantity: item.quantity,
                pricePerUnit: item.price,
                totalPrice: item.price * item.quantity,
                paidAmount: 0,
                isPaid: false
              })),
              sessionPayments: data.sessions.map(session => ({
                sessionId: new mongoose.Types.ObjectId(),
                sessionCost: session.cost,
                paidAmount: 0,
                remainingAmount: session.cost,
                payments: []
              }))
            }, 30000);

            const itemsTotal = bill.itemPayments.reduce((sum, item) => sum + item.totalPrice, 0);
            const sessionsTotal = bill.sessionPayments.reduce((sum, session) => sum + session.sessionCost, 0);
            bill.total = itemsTotal + sessionsTotal;
            bill.subtotal = bill.total;
            bill.remaining = bill.total;

            await bill.save();

            // Make some payments
            const itemIds = bill.itemPayments.slice(0, Math.floor(bill.itemPayments.length / 2)).map(i => i._id);
            if (itemIds.length > 0) {
              bill.payForItems(itemIds, 'cash', testUserId);
            }

            bill.sessionPayments.forEach(session => {
              const partialAmount = session.sessionCost / 2;
              bill.paySessionPartial(session.sessionId, partialAmount, 'cash', testUserId);
            }, 30000);

            // Verify: sum of payment history equals paid amount
            const historySum = bill.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
            expect(Math.abs(historySum - bill.paid)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 13: Item payment status tracking
   * For any bill with orders, each order item should have a corresponding entry in 
   * itemPayments with payment status tracking (isPaid, paidAmount, paidBy)
   * Validates: Requirements 6.3
   */
  describe('Property 13: Item payment status tracking', () => {
    it('should track payment status for all items', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              price: fc.double({ min: 1, max: 100, noNaN: true }),
              quantity: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (items) => {
            const bill = await createBillWithItems(items);

            // Verify: each item has tracking fields
            bill.itemPayments.forEach(item => {
              expect(item.isPaid).toBeDefined();
              expect(item.paidAmount).toBeDefined();
              expect(item.paidAmount).toBe(0); // Initially unpaid
              expect(item.isPaid).toBe(false);
            }, 30000);

            // Pay for some items
            const itemIds = bill.itemPayments.slice(0, Math.floor(bill.itemPayments.length / 2)).map(i => i._id);
            if (itemIds.length > 0) {
              bill.payForItems(itemIds, 'cash', testUserId);

              // Verify: paid items have updated status
              itemIds.forEach(itemId => {
                const item = bill.itemPayments.find(i => i._id.toString() === itemId.toString());
                expect(item.isPaid).toBe(true);
                expect(item.paidAmount).toBe(item.totalPrice);
                expect(item.paidBy).toEqual(testUserId);
              }, 30000);
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 14: Session payment status tracking
   * For any bill with sessions, each session should have a corresponding entry in 
   * sessionPayments with paidAmount and remainingAmount tracking
   * Validates: Requirements 6.4
   */
  describe('Property 14: Session payment status tracking', () => {
    it('should track payment status for all sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              cost: fc.double({ min: 10, max: 200, noNaN: true })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (sessions) => {
            const bill = await createBillWithSessions(sessions);

            // Verify: each session has tracking fields
            bill.sessionPayments.forEach(session => {
              expect(session.paidAmount).toBeDefined();
              expect(session.remainingAmount).toBeDefined();
              expect(session.paidAmount).toBe(0); // Initially unpaid
              expect(session.remainingAmount).toBe(session.sessionCost);
              expect(session.payments).toBeDefined();
              expect(Array.isArray(session.payments)).toBe(true);
            }, 30000);

            // Make partial payments
            bill.sessionPayments.forEach(session => {
              const partialAmount = session.sessionCost / 3;
              bill.paySessionPartial(session.sessionId, partialAmount, 'cash', testUserId);
            }, 30000);

            // Verify: sessions have updated status
            bill.sessionPayments.forEach(session => {
              expect(session.paidAmount).toBeGreaterThan(0);
              expect(session.remainingAmount).toBeLessThan(session.sessionCost);
              expect(session.payments.length).toBeGreaterThan(0);
            }, 30000);
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 16: Bill status transitions to paid when remaining is zero
   * For any bill, when the remaining amount reaches exactly 0, the bill status should be set to 'paid'
   * Validates: Requirements 7.5
   */
  describe('Property 16: Bill status transitions to paid when remaining is zero', () => {
    it('should transition to paid status when fully paid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              price: fc.double({ min: 1, max: 100, noNaN: true }),
              quantity: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (items) => {
            const bill = await createBillWithItems(items);

            // Initially should be draft
            expect(bill.status).toBe('draft');

            // Pay for all items
            const itemIds = bill.itemPayments.map(item => item._id);
            bill.payForItems(itemIds, 'cash', testUserId);

            // Calculate remaining
            bill.calculateRemainingAmount();

            // Verify: remaining is 0
            expect(bill.remaining).toBe(0);

            // Save to trigger pre-save hook that updates status
            await bill.save();

            // Verify: status is paid
            expect(bill.status).toBe('paid');
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);
  });
});
