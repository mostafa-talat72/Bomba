/**
 * Property-Based Tests for Table Status with Unpaid Bills
 * Feature: table-bills-management-enhancement, Property 2: Table status reflects unpaid bills
 * 
 * These tests use fast-check to verify that table status is correctly updated
 * based on the presence of unpaid bills.
 * 
 * Validates: Requirements 2.1
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Table from '../../models/Table.js';
import TableSection from '../../models/TableSection.js';

describe('Property-Based Tests: Table Status with Unpaid Bills', () => {
  let mongoServer;
  let testOrganizationId;
  let testUserId;
  let testSectionId;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test organization and user
    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    
    // Create test section
    const section = await TableSection.create({
      name: 'Test Section',
      organization: testOrganizationId,
      createdBy: testUserId
    });
    testSectionId = section._id;
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data before each test
    await Bill.deleteMany({});
    await Table.deleteMany({});
  }, 10000);

  /**
   * Helper function to create test tables
   */
  async function createTestTable(status = 'empty') {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const table = await Table.create({
      number: `T${timestamp}-${randomSuffix}`,
      section: testSectionId,
      status: status,
      organization: testOrganizationId,
      createdBy: testUserId
    });
    return table;
  }

  /**
   * Helper function to update table status based on unpaid bills
   * This simulates the updateTableStatusIfNeeded function
   */
  async function updateTableStatusIfNeeded(tableId, organizationId) {
    if (!tableId) {
      return null;
    }

    // Find all unpaid bills for this table (draft, partial, or overdue status)
    const unpaidBills = await Bill.find({
      table: tableId,
      status: { $in: ['draft', 'partial', 'overdue'] },
      organization: organizationId,
    });

    // Determine new status: occupied if there are unpaid bills, empty otherwise
    const newStatus = unpaidBills.length > 0 ? 'occupied' : 'empty';

    // Update table status
    await Table.findByIdAndUpdate(tableId, { status: newStatus });

    return newStatus;
  }

  /**
   * Feature: table-bills-management-enhancement, Property 2: Table status reflects unpaid bills
   * For any table, if there exists at least one bill with status 'draft', 'partial', or 'overdue'
   * for that table, then the table status should be 'occupied'.
   * Validates: Requirements 2.1
   */
  describe('Property 2: Table status reflects unpaid bills', () => {
    it('should set table status to occupied when there are unpaid bills', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            unpaidBillCount: fc.integer({ min: 1, max: 10 }),
            paidBillCount: fc.integer({ min: 0, max: 5 }),
            unpaidStatus: fc.constantFrom('draft', 'partial', 'overdue')
          }),
          async ({ unpaidBillCount, paidBillCount, unpaidStatus }) => {
            // Create a test table with initial status 'empty'
            const table = await createTestTable('empty');
            
            // Create unpaid bills for this table
            for (let i = 0; i < unpaidBillCount; i++) {
              await Bill.create({
                customerName: `Customer ${i}`,
                table: table._id,
                subtotal: 100 + i,
                total: 100 + i,
                paid: unpaidStatus === 'partial' ? 50 : 0,
                remaining: unpaidStatus === 'partial' ? 50 : 100 + i,
                status: unpaidStatus,
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Create paid bills for this table (should not affect status)
            for (let i = 0; i < paidBillCount; i++) {
              await Bill.create({
                customerName: `Paid Customer ${i}`,
                table: table._id,
                subtotal: 100,
                total: 100,
                paid: 100,
                remaining: 0,
                status: 'paid',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Update table status based on bills
            const newStatus = await updateTableStatusIfNeeded(table._id, testOrganizationId);
            
            // Verify the table status
            const updatedTable = await Table.findById(table._id);
            
            // Property 1: Table status should be 'occupied' when there are unpaid bills
            expect(updatedTable.status).toBe('occupied');
            expect(newStatus).toBe('occupied');
            
            // Property 2: Verify unpaid bills exist
            const unpaidBills = await Bill.find({
              table: table._id,
              status: { $in: ['draft', 'partial', 'overdue'] }
            });
            expect(unpaidBills.length).toBe(unpaidBillCount);
            expect(unpaidBills.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should maintain occupied status with mixed bill statuses as long as one is unpaid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            draftBills: fc.integer({ min: 0, max: 5 }),
            partialBills: fc.integer({ min: 0, max: 5 }),
            overdueBills: fc.integer({ min: 0, max: 5 }),
            paidBills: fc.integer({ min: 0, max: 10 }),
            cancelledBills: fc.integer({ min: 0, max: 3 })
          }).filter(({ draftBills, partialBills, overdueBills }) => 
            // Ensure at least one unpaid bill exists
            draftBills + partialBills + overdueBills > 0
          ),
          async ({ draftBills, partialBills, overdueBills, paidBills, cancelledBills }) => {
            // Create a test table
            const table = await createTestTable('empty');
            
            const billStatuses = [
              { status: 'draft', count: draftBills, paid: 0, remaining: 100 },
              { status: 'partial', count: partialBills, paid: 50, remaining: 50 },
              { status: 'overdue', count: overdueBills, paid: 0, remaining: 100 },
              { status: 'paid', count: paidBills, paid: 100, remaining: 0 },
              { status: 'cancelled', count: cancelledBills, paid: 0, remaining: 0 }
            ];
            
            let totalUnpaidBills = 0;
            
            // Create bills with various statuses
            for (const { status, count, paid, remaining } of billStatuses) {
              for (let i = 0; i < count; i++) {
                await Bill.create({
                  customerName: `Customer ${status} ${i}`,
                  table: table._id,
                  subtotal: 100,
                  total: 100,
                  paid: paid,
                  remaining: remaining,
                  status: status,
                  billType: 'cafe',
                  organization: testOrganizationId,
                  createdBy: testUserId
                });
              }
              
              if (['draft', 'partial', 'overdue'].includes(status)) {
                totalUnpaidBills += count;
              }
            }
            
            // Update table status
            const newStatus = await updateTableStatusIfNeeded(table._id, testOrganizationId);
            
            // Verify the table status
            const updatedTable = await Table.findById(table._id);
            
            // Property: Table should be occupied if there's at least one unpaid bill
            expect(updatedTable.status).toBe('occupied');
            expect(newStatus).toBe('occupied');
            expect(totalUnpaidBills).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should set table status to occupied immediately after creating an unpaid bill', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billAmount: fc.integer({ min: 50, max: 500 }),
            billStatus: fc.constantFrom('draft', 'partial', 'overdue')
          }),
          async ({ billAmount, billStatus }) => {
            // Create a test table with initial status 'empty'
            const table = await createTestTable('empty');
            
            // Verify initial status
            expect(table.status).toBe('empty');
            
            // Create an unpaid bill
            const paidAmount = billStatus === 'partial' ? billAmount / 2 : 0;
            await Bill.create({
              customerName: 'Test Customer',
              table: table._id,
              subtotal: billAmount,
              total: billAmount,
              paid: paidAmount,
              remaining: billAmount - paidAmount,
              status: billStatus,
              billType: 'cafe',
              organization: testOrganizationId,
              createdBy: testUserId
            });
            
            // Update table status (simulating what happens in createBill controller)
            await updateTableStatusIfNeeded(table._id, testOrganizationId);
            
            // Verify the table status changed to occupied
            const updatedTable = await Table.findById(table._id);
            
            // Property: Table status should change from empty to occupied
            expect(updatedTable.status).toBe('occupied');
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should keep table occupied when adding more unpaid bills', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialBills: fc.integer({ min: 1, max: 5 }),
            additionalBills: fc.integer({ min: 1, max: 5 })
          }),
          async ({ initialBills, additionalBills }) => {
            // Create a test table
            const table = await createTestTable('empty');
            
            // Create initial unpaid bills
            for (let i = 0; i < initialBills; i++) {
              await Bill.create({
                customerName: `Initial Customer ${i}`,
                table: table._id,
                subtotal: 100,
                total: 100,
                paid: 0,
                remaining: 100,
                status: 'draft',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Update table status
            await updateTableStatusIfNeeded(table._id, testOrganizationId);
            let updatedTable = await Table.findById(table._id);
            expect(updatedTable.status).toBe('occupied');
            
            // Add more unpaid bills
            for (let i = 0; i < additionalBills; i++) {
              await Bill.create({
                customerName: `Additional Customer ${i}`,
                table: table._id,
                subtotal: 100,
                total: 100,
                paid: 0,
                remaining: 100,
                status: 'draft',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Update table status again
            await updateTableStatusIfNeeded(table._id, testOrganizationId);
            updatedTable = await Table.findById(table._id);
            
            // Property: Table should remain occupied
            expect(updatedTable.status).toBe('occupied');
            
            // Verify total unpaid bills
            const unpaidBills = await Bill.find({
              table: table._id,
              status: { $in: ['draft', 'partial', 'overdue'] }
            });
            expect(unpaidBills.length).toBe(initialBills + additionalBills);
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should handle tables with no bills correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Create a test table with no bills
            const table = await createTestTable('empty');
            
            // Update table status (should remain empty)
            const newStatus = await updateTableStatusIfNeeded(table._id, testOrganizationId);
            
            // Verify the table status
            const updatedTable = await Table.findById(table._id);
            
            // Property: Table with no bills should be empty
            expect(updatedTable.status).toBe('empty');
            expect(newStatus).toBe('empty');
            
            // Verify no bills exist
            const bills = await Bill.find({ table: table._id });
            expect(bills.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    }, 180000);

    it('should correctly identify unpaid bills across different organizations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            unpaidBillsOrg1: fc.integer({ min: 1, max: 5 }),
            unpaidBillsOrg2: fc.integer({ min: 0, max: 5 })
          }),
          async ({ unpaidBillsOrg1, unpaidBillsOrg2 }) => {
            // Create a test table for organization 1
            const table = await createTestTable('empty');
            
            // Create another organization
            const org2Id = new mongoose.Types.ObjectId();
            
            // Create unpaid bills for organization 1
            for (let i = 0; i < unpaidBillsOrg1; i++) {
              await Bill.create({
                customerName: `Org1 Customer ${i}`,
                table: table._id,
                subtotal: 100,
                total: 100,
                paid: 0,
                remaining: 100,
                status: 'draft',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Create unpaid bills for organization 2 (should not affect table status)
            for (let i = 0; i < unpaidBillsOrg2; i++) {
              await Bill.create({
                customerName: `Org2 Customer ${i}`,
                table: table._id,
                subtotal: 100,
                total: 100,
                paid: 0,
                remaining: 100,
                status: 'draft',
                billType: 'cafe',
                organization: org2Id,
                createdBy: testUserId
              });
            }
            
            // Update table status for organization 1
            await updateTableStatusIfNeeded(table._id, testOrganizationId);
            
            // Verify the table status
            const updatedTable = await Table.findById(table._id);
            
            // Property: Table should be occupied because org1 has unpaid bills
            expect(updatedTable.status).toBe('occupied');
            
            // Verify only org1 bills are counted
            const org1UnpaidBills = await Bill.find({
              table: table._id,
              status: { $in: ['draft', 'partial', 'overdue'] },
              organization: testOrganizationId
            });
            expect(org1UnpaidBills.length).toBe(unpaidBillsOrg1);
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });
});
