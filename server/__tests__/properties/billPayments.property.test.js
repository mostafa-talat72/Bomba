/**
 * Property-Based Tests for Bill Payment System
 * Feature: table-based-billing-enhancements
 * 
 * These tests verify the correctness properties of the enhanced bill payment system
 * including item-level payments, session partial payments, and payment history tracking.
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';
import Session from '../../models/Session.js';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';
import Table from '../../models/Table.js';
import TableSection from '../../models/TableSection.js';

// Test configuration
const TEST_ITERATIONS = 10; // Reduced for faster testing

// Helper to connect to test database
let connection;

beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/bomba-test';
    connection = await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
});

// Clean up after each test
afterEach(async () => {
    await Bill.deleteMany({});
    await Order.deleteMany({});
    await Session.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Table.deleteMany({});
    await TableSection.deleteMany({});
});

// Generators
const userGenerator = () => fc.record({
    name: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8 }),
    role: fc.constantFrom('admin', 'staff', 'cashier'),
});

const organizationGenerator = (ownerId) => fc.record({
    name: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length >= 3),
    type: fc.constantFrom('cafe', 'restaurant'),
    owner: fc.constant(ownerId),
});

const itemGenerator = () => fc.record({
    name: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    price: fc.integer({ min: 10, max: 500 }),
    quantity: fc.integer({ min: 1, max: 10 }),
});

const sessionCostGenerator = () => fc.integer({ min: 20, max: 200 });

const paymentAmountGenerator = (max) => fc.integer({ min: 1, max });

/**
 * Property 15: Remaining amount calculation
 * For any bill, the remaining amount should equal total minus 
 * (sum of itemPayments.paidAmount + sum of sessionPayments.paidAmount + sum of payments.amount)
 * 
 * Validates: Requirements 7.1, 7.2, 7.4
 */
describe('Property 15: Remaining amount calculation', () => {
    test('remaining equals total minus all payments', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(itemGenerator(), { minLength: 1, maxLength: 3 }),
                fc.array(sessionCostGenerator(), { minLength: 0, maxLength: 2 }),
                async (items, sessionCosts) => {
                    // Create bill without saving to database (faster)
                    const orgId = new mongoose.Types.ObjectId();
                    const userId = new mongoose.Types.ObjectId();

                    const bill = new Bill({
                        organization: orgId,
                        createdBy: userId,
                        subtotal: 0,
                        total: 0,
                        itemPayments: items.map((item, index) => ({
                            orderId: new mongoose.Types.ObjectId(),
                            itemId: `item-${index}`,
                            itemName: item.name,
                            quantity: item.quantity,
                            pricePerUnit: item.price,
                            totalPrice: item.price * item.quantity,
                            paidAmount: 0,
                            isPaid: false,
                        })),
                        sessionPayments: sessionCosts.map((cost) => ({
                            sessionId: new mongoose.Types.ObjectId(),
                            sessionCost: cost,
                            paidAmount: 0,
                            remainingAmount: cost,
                            payments: [],
                        })),
                        paymentHistory: [],
                    });

                    // Calculate total
                    const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const sessionsTotal = sessionCosts.reduce((sum, cost) => sum + cost, 0);
                    bill.total = itemsTotal + sessionsTotal;

                    // Pay for some items randomly
                    let expectedPaid = 0;
                    bill.itemPayments.forEach((item) => {
                        if (Math.random() > 0.5) {
                            item.isPaid = true;
                            item.paidAmount = item.totalPrice;
                            expectedPaid += item.totalPrice;
                        }
                    });

                    // Make partial payments for sessions
                    bill.sessionPayments.forEach((session) => {
                        const partialAmount = Math.floor(session.sessionCost * Math.random());
                        session.paidAmount = partialAmount;
                        session.remainingAmount = session.sessionCost - partialAmount;
                        expectedPaid += partialAmount;
                    });

                    // Calculate remaining
                    const remaining = bill.calculateRemainingAmount();

                    // Verify property
                    expect(bill.paid).toBe(expectedPaid);
                    expect(bill.remaining).toBe(Math.max(0, bill.total - expectedPaid));
                    expect(remaining).toBe(bill.remaining);
                }
            ),
            { numRuns: TEST_ITERATIONS }
        );
    });
});
