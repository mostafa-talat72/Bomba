/**
 * Property-Based Tests for Table-Order-Bill Linking
 * Feature: cafe-table-order-linking-fix
 * 
 * These tests use fast-check to verify correctness properties across many random inputs
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Table from '../../models/Table.js';
import Order from '../../models/Order.js';
import Bill from '../../models/Bill.js';

describe('Property-Based Tests: Table-Order-Bill Linking', () => {
  let mongoServer;
  let testOrganizationId;
  let testUserId;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test organization and user
    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  afterEach(async () => {
    // Clean up test data after each test
    await Order.deleteMany({ organization: testOrganizationId });
    await Bill.deleteMany({ organization: testOrganizationId });
    await Table.deleteMany({ organization: testOrganizationId });
  }, 10000);

  /**
   * Feature: cafe-table-order-linking-fix, Property 1: Table Reference Storage Integrity
   * For any order created with a table reference, the system SHALL store the table field as a valid MongoDB ObjectId
   * Validates: Requirements 1.1, 6.1
   */
  describe('Property 1: Table Reference Storage Integrity', () => {
    it('should store table reference as ObjectId for all orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tableNumber: fc.integer({ min: 1, max: 100 }),
            items: fc.array(
              fc.record({
                menuItem: fc.constant(new mongoose.Types.ObjectId()),
                name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                price: fc.double({ min: 1, max: 1000, noNaN: true }),
                quantity: fc.integer({ min: 1, max: 10 })
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          async (orderData) => {
            // Create section for table
            const sectionId = new mongoose.Types.ObjectId();
            
            // Create table with all required fields
            const table = await Table.create({ 
              number: orderData.tableNumber,
              section: sectionId,
              organization: testOrganizationId,
              createdBy: testUserId,
              isActive: true,
              status: 'empty'
            });
            
            // Calculate order totals manually (pre-save hook should do this, but we'll be explicit)
            const itemsWithTotals = orderData.items.map(item => ({
              ...item,
              itemTotal: item.price * item.quantity
            }));
            
            const subtotal = itemsWithTotals.reduce((sum, item) => sum + item.itemTotal, 0);
            const finalAmount = subtotal;
            
            // Create order with table ObjectId
            const order = await Order.create({
              table: table._id,
              items: itemsWithTotals,
              subtotal,
              finalAmount,
              organization: testOrganizationId,
              createdBy: testUserId,
              status: 'pending'
            });
            
            // Verify table is stored as ObjectId
            expect(order.table).toBeInstanceOf(mongoose.Types.ObjectId);
            expect(mongoose.Types.ObjectId.isValid(order.table)).toBe(true);
            expect(order.table.toString()).toBe(table._id.toString());
            
            // Cleanup
            await Order.deleteOne({ _id: order._id });
            await Table.deleteOne({ _id: table._id });
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: cafe-table-order-linking-fix, Property 2: Bill Categorization by Table Linkage
   * For any bill, if it has a populated table field, it SHALL appear in the "table bills" section
   * Validates: Requirements 1.2, 1.3, 1.5
   */
  describe('Property 2: Bill Categorization by Table Linkage', () => {
    it('should categorize bills correctly based on table linkage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              hasTable: fc.boolean(),
              tableNumber: fc.integer({ min: 1, max: 100 }),
              total: fc.double({ min: 10, max: 1000, noNaN: true })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (billsData) => {
            const createdBills = [];
            const sectionId = new mongoose.Types.ObjectId();
            
            // Create bills with and without tables
            for (const billData of billsData) {
              let table = null;
              if (billData.hasTable) {
                table = await Table.create({ 
                  number: billData.tableNumber,
                  section: sectionId,
                  organization: testOrganizationId,
                  createdBy: testUserId,
                  isActive: true,
                  status: 'empty'
                });
              }
              
              const bill = await Bill.create({
                table: table?._id || null,
                subtotal: billData.total,
                total: billData.total,
                paid: 0,
                remaining: billData.total,
                status: 'draft',
                organization: testOrganizationId,
                createdBy: testUserId
              });
              
              createdBills.push({ bill, hasTable: billData.hasTable, table });
            }
            
            // Fetch only the bills we just created with populated table
            const billIds = createdBills.map(b => b.bill._id);
            const bills = await Bill.find({ _id: { $in: billIds } }).populate('table');
            
            // Categorize (simulating frontend logic)
            const tableBills = bills.filter(b => b.table);
            const unlinkedBills = bills.filter(b => !b.table);
            
            // Verify categorization
            const expectedTableBills = billsData.filter(b => b.hasTable).length;
            const expectedUnlinkedBills = billsData.filter(b => !b.hasTable).length;
            
            expect(tableBills.length).toBe(expectedTableBills);
            expect(unlinkedBills.length).toBe(expectedUnlinkedBills);
            
            // Verify all table bills have table data
            tableBills.forEach(bill => {
              expect(bill.table).toBeDefined();
              expect(bill.table._id).toBeDefined();
            });
            
            // Verify all unlinked bills don't have table data
            unlinkedBills.forEach(bill => {
              expect(bill.table).toBeNull();
            });
            
            // Cleanup
            await Bill.deleteMany({ _id: { $in: createdBills.map(b => b.bill._id) } });
            await Table.deleteMany({ _id: { $in: createdBills.filter(b => b.table).map(b => b.table._id) } });
          }
        ),
        { numRuns: 20 }
      );
    }, 120000);
  });

  /**
   * Feature: cafe-table-order-linking-fix, Property 3: Table Number Display
   * For any bill with a table reference, the displayed bill information SHALL include the table number
   * Validates: Requirements 1.4, 6.5
   */
  describe('Property 3: Table Number Display', () => {
    it('should display table number for bills with tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              tableNumber: fc.integer({ min: 1, max: 100 }),
              total: fc.double({ min: 10, max: 1000, noNaN: true })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (billsData) => {
            const createdBills = [];
            const sectionId = new mongoose.Types.ObjectId();
            
            // Create bills with tables
            for (let i = 0; i < billsData.length; i++) {
              const billData = billsData[i];
              // Make table number unique by adding index to avoid duplicate key errors
              const uniqueTableNumber = billData.tableNumber + (i * 1000);
              
              const table = await Table.create({ 
                number: uniqueTableNumber,
                section: sectionId,
                organization: testOrganizationId,
                createdBy: testUserId,
                isActive: true,
                status: 'empty'
              });
              
              const bill = await Bill.create({
                table: table._id,
                subtotal: billData.total,
                total: billData.total,
                paid: 0,
                remaining: billData.total,
                status: 'draft',
                organization: testOrganizationId,
                createdBy: testUserId
              });
              
              createdBills.push({ bill, table, expectedNumber: uniqueTableNumber });
            }
            
            // Fetch bills with populated table
            const billIds = createdBills.map(b => b.bill._id);
            const bills = await Bill.find({ _id: { $in: billIds } }).populate('table');
            
            // Verify each bill has table number accessible
            bills.forEach((bill, index) => {
              expect(bill.table).toBeDefined();
              expect(bill.table.number).toBeDefined();
              // Verify the table number matches what we created
              const expectedBill = createdBills.find(b => b.bill._id.toString() === bill._id.toString());
              expect(bill.table.number).toBe(expectedBill.expectedNumber);
            });
            
            // Cleanup
            await Bill.deleteMany({ _id: { $in: createdBills.map(b => b.bill._id) } });
            await Table.deleteMany({ _id: { $in: createdBills.map(b => b.table._id) } });
          }
        ),
        { numRuns: 20 }
      );
    }, 120000);
  });
});
