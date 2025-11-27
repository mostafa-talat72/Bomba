/**
 * Property-Based Tests for Table Status Auto-Update
 * Feature: table-based-billing-enhancements
 * 
 * These tests verify that table status is automatically updated based on bill status
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Table from '../../models/Table.js';
import User from '../../models/User.js';
import TableSection from '../../models/TableSection.js';

describe('Property-Based Tests: Table Status Auto-Update', () => {
  let mongoServer;
  let testOrganizationId;
  let testUserId;
  let testSectionId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testSectionId = new mongoose.Types.ObjectId();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await Bill.deleteMany({});
    await Table.deleteMany({});
    await User.deleteMany({});
    await TableSection.deleteMany({});
  }, 10000);

  /**
   * Helper function to create a table
   */
  async function createTable(tableNumber) {
    const table = new Table({
      number: tableNumber,
      section: testSectionId,
      organization: testOrganizationId,
      createdBy: testUserId,
      status: 'empty'
    });
    await table.save();
    return table;
  }

  /**
   * Helper function to create a bill for a table
   */
  async function createBill(tableId, status, total) {
    const bill = new Bill({
      organization: testOrganizationId,
      createdBy: testUserId,
      table: tableId,
      billType: 'cafe',
      subtotal: total,
      total: total,
      paid: status === 'paid' ? total : (status === 'partial' ? total / 2 : 0),
      remaining: status === 'paid' ? 0 : (status === 'partial' ? total / 2 : total),
      status: status
    });
    await bill.save();
    return bill;
  }

  /**
   * Feature: table-based-billing-enhancements, Property 2: Table status reflects unpaid bills
   * For any table, if there exists at least one bill with status 'draft' or 'partial', 
   * the table status should be 'occupied'; otherwise it should be 'empty'
   * Validates: Requirements 2.1, 2.2, 2.5
   */
  describe('Property 2: Table status reflects unpaid bills', () => {
    it('should set table to occupied when unpaid bills exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bills: fc.array(
              fc.record({
                status: fc.constantFrom('draft', 'partial', 'paid'),
                total: fc.double({ min: 10, max: 500, noNaN: true })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async (data) => {
            // Create table with unique number
            const tableNumber = `T-${Date.now()}-${Math.random()}`;
            const table = await createTable(tableNumber);

            // Create bills with various statuses
            for (const billData of data.bills) {
              await createBill(table._id, billData.status, billData.total);
            }

            // Reload table to get updated status
            const updatedTable = await Table.findById(table._id);

            // Check if there are any unpaid bills
            const hasUnpaidBills = data.bills.some(
              bill => bill.status === 'draft' || bill.status === 'partial'
            );

            // Verify: table status matches expectation
            if (hasUnpaidBills) {
              expect(updatedTable.status).toBe('occupied');
            } else {
              expect(updatedTable.status).toBe('empty');
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 3: Bill creation sets table to occupied
   * For any table, creating a new bill for that table should immediately set the table status to 'occupied'
   * Validates: Requirements 2.3
   */
  describe('Property 3: Bill creation sets table to occupied', () => {
    it('should set table to occupied when bill is created', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billTotal: fc.double({ min: 10, max: 500, noNaN: true })
          }),
          async (data) => {
            // Create table with unique number and empty status
            const tableNumber = `T-${Date.now()}-${Math.random()}`;
            const table = await createTable(tableNumber);
            expect(table.status).toBe('empty');

            // Create a new bill for the table
            await createBill(table._id, 'draft', data.billTotal);

            // Reload table to get updated status
            const updatedTable = await Table.findById(table._id);

            // Verify: table status is now occupied
            expect(updatedTable.status).toBe('occupied');
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  /**
   * Feature: table-based-billing-enhancements, Property 4: Paying last bill sets table to empty
   * For any table with exactly one unpaid bill, when that bill is fully paid, 
   * the table status should immediately change to 'empty'
   * Validates: Requirements 2.4
   */
  describe('Property 4: Paying last bill sets table to empty', () => {
    it('should set table to empty when last bill is paid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billTotal: fc.double({ min: 10, max: 500, noNaN: true })
          }),
          async (data) => {
            // Create table with unique number
            const tableNumber = `T-${Date.now()}-${Math.random()}`;
            const table = await createTable(tableNumber);

            // Create one unpaid bill
            const bill = await createBill(table._id, 'draft', data.billTotal);

            // Verify table is occupied
            let updatedTable = await Table.findById(table._id);
            expect(updatedTable.status).toBe('occupied');

            // Pay the bill fully
            bill.status = 'paid';
            bill.paid = bill.total;
            bill.remaining = 0;
            await bill.save();

            // Reload table to get updated status
            updatedTable = await Table.findById(table._id);

            // Verify: table status is now empty
            expect(updatedTable.status).toBe('empty');
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });
});
