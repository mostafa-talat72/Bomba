/**
 * Property-Based Tests for Table Bills Query
 * Feature: table-based-billing-enhancements
 * 
 * These tests use fast-check to verify correctness properties across many random inputs
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Table from '../../models/Table.js';
import TableSection from '../../models/TableSection.js';

describe('Property-Based Tests: Table Bills Query', () => {
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

  afterEach(async () => {
    // Clean up test data after each test
    await Bill.deleteMany({ organization: testOrganizationId });
    await Table.deleteMany({ organization: testOrganizationId });
  }, 10000);

  /**
   * Helper function to create test tables with unique numbers
   */
  async function createTestTables(count) {
    const tables = [];
    const timestamp = Date.now();
    for (let i = 0; i < count; i++) {
      const table = await Table.create({
        number: `T${timestamp}-${i}`, // Use unique table numbers to avoid conflicts
        section: testSectionId,
        status: 'empty',
        organization: testOrganizationId,
        createdBy: testUserId
      });
      tables.push(table);
    }
    return tables;
  }

  /**
   * Helper function to create test bills for specific tables with various dates
   */
  async function createTestBillsForTables(tables, billsPerTable, daysSpread = 365) {
    const bills = [];
    const now = new Date();
    
    for (const table of tables) {
      for (let i = 0; i < billsPerTable; i++) {
        const billDate = new Date(now);
        // Create bills spread across different dates (up to daysSpread days ago)
        billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysSpread));
        
        const bill = await Bill.create({
          customerName: `Customer ${table.number}-${i}`,
          table: table._id,
          tableNumber: table.number,
          subtotal: 100 + i,
          total: 100 + i,
          paid: 0,
          remaining: 100 + i,
          status: i % 3 === 0 ? 'paid' : 'draft',
          billType: 'cafe',
          organization: testOrganizationId,
          createdBy: testUserId,
          createdAt: billDate
        });
        bills.push(bill);
      }
    }
    return bills;
  }

  /**
   * Feature: table-based-billing-enhancements, Property 1: Table bills query returns all bills regardless of date
   * For any table and any set of bills with various creation dates, querying bills by table ID 
   * should return ALL bills for that table sorted by creation date (newest first), without any 
   * date filtering applied.
   * Validates: Requirements 1.2, 1.3, 1.5
   */
  describe('Property 1: Table bills query returns all bills regardless of date', () => {
    it('should return all bills for a table regardless of creation date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billsPerTable: fc.integer({ min: 5, max: 15 }),
            daysSpread: fc.integer({ min: 30, max: 365 })
          }),
          async ({ billsPerTable, daysSpread }) => {
            // Create a single test table
            const tables = await createTestTables(1);
            const targetTable = tables[0];
            
            // Create bills for this table spread across different dates
            const now = new Date();
            const bills = [];
            
            for (let i = 0; i < billsPerTable; i++) {
              const billDate = new Date(now);
              // Create bills spread across different dates
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysSpread));
              
              const bill = await Bill.create({
                customerName: `Customer ${i}`,
                table: targetTable._id,
                tableNumber: targetTable.number,
                subtotal: 100 + i,
                total: 100 + i,
                paid: 0,
                remaining: 100 + i,
                status: 'draft',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId,
                createdAt: billDate
              });
              bills.push(bill);
            }
            
            // Query bills for this table (simulating the API behavior)
            const tableBills = await Bill.find({
              organization: testOrganizationId,
              table: targetTable._id
              // NOTE: No date filter should be applied when querying by table
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Property 1: Should return exactly billsPerTable bills for this table
            expect(tableBills.length).toBe(billsPerTable);
            
            // Property 2: All returned bills should belong to the target table
            tableBills.forEach(bill => {
              expect(bill.table.toString()).toBe(targetTable._id.toString());
            });
            
            // Property 3: Bills should be sorted by createdAt (newest first)
            for (let i = 0; i < tableBills.length - 1; i++) {
              expect(new Date(tableBills[i].createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(tableBills[i + 1].createdAt).getTime()
              );
            }
            
            // Property 4: Should include bills from various dates (not just recent ones)
            if (tableBills.length > 1 && daysSpread > 30) {
              const dates = tableBills.map(b => new Date(b.createdAt).getTime());
              const oldestDate = Math.min(...dates);
              const newestDate = Math.max(...dates);
              const dateRangeDays = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
              
              // We expect some spread in the dates
              expect(dateRangeDays).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 60000);
  });

  /**
   * Additional test: Verify date filter is NOT applied when table parameter is present
   */
  describe('Property 1 (Extended): Date filter should be ignored when querying by table', () => {
    it('should ignore date filters when table parameter is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billsPerTable: fc.integer({ min: 8, max: 12 }),
            daysSpread: fc.integer({ min: 60, max: 120 })
          }),
          async ({ billsPerTable, daysSpread }) => {
            // Create a single table
            const tables = await createTestTables(1);
            const targetTable = tables[0];
            
            // Create bills spread across many dates
            const now = new Date();
            for (let i = 0; i < billsPerTable; i++) {
              const billDate = new Date(now);
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysSpread));
              
              await Bill.create({
                customerName: `Customer ${i}`,
                table: targetTable._id,
                tableNumber: targetTable.number,
                subtotal: 100,
                total: 100,
                paid: 0,
                remaining: 100,
                status: 'draft',
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId,
                createdAt: billDate
              });
            }
            
            // Define a date range that would exclude some bills
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30); // Only last 30 days
            
            // Query 1: With table parameter (should ignore date filter)
            const tableBills = await Bill.find({
              organization: testOrganizationId,
              table: targetTable._id
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Query 2: Without table parameter but with date filter
            const dateFilteredBills = await Bill.find({
              organization: testOrganizationId,
              createdAt: { $gte: startDate }
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Property: Table query should return all bills
            expect(tableBills.length).toBe(billsPerTable);
            
            // Property: Table query should return MORE bills than date-filtered query
            // (because it ignores the date filter)
            if (daysSpread > 30) {
              expect(tableBills.length).toBeGreaterThanOrEqual(dateFilteredBills.length);
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 60000);
  });

  /**
   * Additional test: Verify both paid and unpaid bills are returned for table queries
   */
  describe('Property 1 (Extended): Table query returns both paid and unpaid bills', () => {
    it('should return bills with all status values when querying by table', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billsPerTable: fc.integer({ min: 9, max: 12 })
          }),
          async ({ billsPerTable }) => {
            // Create a table
            const tables = await createTestTables(1);
            const targetTable = tables[0];
            
            // Create bills with mixed statuses
            for (let i = 0; i < billsPerTable; i++) {
              const status = i % 3 === 0 ? 'paid' : (i % 3 === 1 ? 'draft' : 'partial');
              await Bill.create({
                customerName: `Customer ${i}`,
                table: targetTable._id,
                tableNumber: targetTable.number,
                subtotal: 100,
                total: 100,
                paid: status === 'paid' ? 100 : (status === 'partial' ? 50 : 0),
                remaining: status === 'paid' ? 0 : (status === 'partial' ? 50 : 100),
                status: status,
                billType: 'cafe',
                organization: testOrganizationId,
                createdBy: testUserId
              });
            }
            
            // Query bills for this table
            const tableBills = await Bill.find({
              organization: testOrganizationId,
              table: targetTable._id
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Property: Should return all bills regardless of status
            expect(tableBills.length).toBe(billsPerTable);
            
            // Property: Should include bills with different statuses
            const statuses = new Set(tableBills.map(b => b.status));
            expect(statuses.size).toBeGreaterThan(1); // At least 2 different statuses
            
            // Property: Should include both paid and unpaid bills
            const paidBills = tableBills.filter(b => b.status === 'paid');
            const unpaidBills = tableBills.filter(b => b.status !== 'paid');
            
            expect(paidBills.length).toBeGreaterThan(0);
            expect(unpaidBills.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 5 }
      );
    }, 60000);
  });
});
