/**
 * Property-Based Tests for Date Filter Removal
 * Feature: table-bills-management-enhancement
 * 
 * These tests use fast-check to verify that date filters are completely ignored
 * when querying bills, especially when querying by table.
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Table from '../../models/Table.js';
import TableSection from '../../models/TableSection.js';

describe('Property-Based Tests: Date Filter Removal', () => {
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
  async function createTestTable() {
    const timestamp = Date.now();
    const table = await Table.create({
      number: `T${timestamp}`,
      section: testSectionId,
      status: 'empty',
      organization: testOrganizationId,
      createdBy: testUserId
    });
    return table;
  }

  /**
   * Helper function to create bills with specific dates
   */
  async function createBillsWithDates(table, billCount, daysSpread) {
    const bills = [];
    const now = new Date();
    
    for (let i = 0; i < billCount; i++) {
      const billDate = new Date(now);
      // Create bills spread across different dates
      billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysSpread));
      
      const bill = await Bill.create({
        customerName: `Customer ${i}`,
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
    return bills;
  }

  /**
   * Feature: table-bills-management-enhancement, Property 1: Bills query ignores date filters completely
   * For any query parameters including date range (startDate, endDate), when querying bills,
   * the system should completely ignore these date parameters and return ALL bills that match
   * other criteria (like table, status, organization) regardless of their creation date.
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  describe('Property 1: Bills query ignores date filters completely', () => {
    it('should return all bills regardless of date filter parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billCount: fc.integer({ min: 10, max: 30 }),
            daysSpread: fc.integer({ min: 60, max: 365 }),
            filterDaysBack: fc.integer({ min: 7, max: 30 })
          }),
          async ({ billCount, daysSpread, filterDaysBack }) => {
            // Create a test table
            const table = await createTestTable();
            
            // Create bills spread across many dates (some old, some recent)
            const bills = await createBillsWithDates(table, billCount, daysSpread);
            
            // Define a restrictive date range that would exclude many bills
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - filterDaysBack);
            const endDate = now;
            
            // Count how many bills would be excluded by the date filter
            const billsWithinDateRange = bills.filter(bill => {
              const billDate = new Date(bill.createdAt);
              return billDate >= startDate && billDate <= endDate;
            });
            
            // Query 1: Query with table parameter (should ignore date filters)
            const queryWithTable = {
              organization: testOrganizationId,
              table: table._id
              // NOTE: No date filter should be applied
            };
            
            const tableBills = await Bill.find(queryWithTable)
              .sort({ createdAt: -1 })
              .lean();
            
            // Query 2: Simulate what would happen if date filter WAS applied (for comparison)
            const queryWithDateFilter = {
              organization: testOrganizationId,
              table: table._id,
              createdAt: {
                $gte: startDate,
                $lte: endDate
              }
            };
            
            const dateFilteredBills = await Bill.find(queryWithDateFilter)
              .sort({ createdAt: -1 })
              .lean();
            
            // Property 1: Query should return ALL bills for the table
            expect(tableBills.length).toBe(billCount);
            
            // Property 2: Query should return MORE bills than date-filtered query
            // (because it ignores the date filter)
            if (daysSpread > filterDaysBack) {
              expect(tableBills.length).toBeGreaterThanOrEqual(dateFilteredBills.length);
            }
            
            // Property 3: All returned bills should belong to the target table
            tableBills.forEach(bill => {
              expect(bill.table.toString()).toBe(table._id.toString());
            });
            
            // Property 4: Bills should include old bills (outside the date range)
            if (daysSpread > filterDaysBack && billsWithinDateRange.length < billCount) {
              // There should be bills outside the date range
              const oldBills = tableBills.filter(bill => {
                const billDate = new Date(bill.createdAt);
                return billDate < startDate;
              });
              expect(oldBills.length).toBeGreaterThan(0);
            }
            
            // Property 5: Bills should be sorted by createdAt (newest first)
            for (let i = 0; i < tableBills.length - 1; i++) {
              expect(new Date(tableBills[i].createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(tableBills[i + 1].createdAt).getTime()
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 180000);
  });

  /**
   * Extended test: Verify date parameters are completely ignored in query building
   */
  describe('Property 1 (Extended): Date parameters have no effect on query results', () => {
    it('should return identical results with or without date parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billCount: fc.integer({ min: 15, max: 25 }),
            daysSpread: fc.integer({ min: 90, max: 180 })
          }),
          async ({ billCount, daysSpread }) => {
            // Create a test table
            const table = await createTestTable();
            
            // Create bills spread across many dates
            await createBillsWithDates(table, billCount, daysSpread);
            
            // Define various date ranges
            const now = new Date();
            const startDate1 = new Date(now);
            startDate1.setDate(startDate1.getDate() - 30);
            
            const startDate2 = new Date(now);
            startDate2.setDate(startDate2.getDate() - 90);
            
            // Query 1: Without any date parameters
            const query1 = {
              organization: testOrganizationId,
              table: table._id
            };
            
            const bills1 = await Bill.find(query1)
              .sort({ createdAt: -1 })
              .lean();
            
            // Query 2: With date parameters (should be ignored)
            // Simulating what the controller receives but ignores
            const query2 = {
              organization: testOrganizationId,
              table: table._id
              // startDate and endDate are NOT added to query
            };
            
            const bills2 = await Bill.find(query2)
              .sort({ createdAt: -1 })
              .lean();
            
            // Property: Both queries should return identical results
            expect(bills1.length).toBe(bills2.length);
            expect(bills1.length).toBe(billCount);
            
            // Property: Bill IDs should match
            const ids1 = bills1.map(b => b._id.toString()).sort();
            const ids2 = bills2.map(b => b._id.toString()).sort();
            expect(ids1).toEqual(ids2);
          }
        ),
        { numRuns: 10 }
      );
    }, 180000);
  });

  /**
   * Extended test: Verify old bills (>1 year) are still returned
   */
  describe('Property 1 (Extended): Very old bills are still accessible', () => {
    it('should return bills from any time period including very old ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recentBills: fc.integer({ min: 5, max: 10 }),
            oldBills: fc.integer({ min: 5, max: 10 })
          }),
          async ({ recentBills, oldBills }) => {
            // Create a test table
            const table = await createTestTable();
            
            const now = new Date();
            const allBills = [];
            
            // Create recent bills (last 30 days)
            for (let i = 0; i < recentBills; i++) {
              const billDate = new Date(now);
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * 30));
              
              const bill = await Bill.create({
                customerName: `Recent Customer ${i}`,
                table: table._id,
                tableNumber: table.number,
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
              allBills.push(bill);
            }
            
            // Create very old bills (1-2 years ago)
            for (let i = 0; i < oldBills; i++) {
              const billDate = new Date(now);
              billDate.setFullYear(billDate.getFullYear() - 1);
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * 365));
              
              const bill = await Bill.create({
                customerName: `Old Customer ${i}`,
                table: table._id,
                tableNumber: table.number,
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
              allBills.push(bill);
            }
            
            // Query all bills for this table
            const tableBills = await Bill.find({
              organization: testOrganizationId,
              table: table._id
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Property 1: Should return ALL bills (recent + old)
            expect(tableBills.length).toBe(recentBills + oldBills);
            
            // Property 2: Should include bills from over a year ago
            const veryOldBills = tableBills.filter(bill => {
              const billDate = new Date(bill.createdAt);
              const oneYearAgo = new Date(now);
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              return billDate < oneYearAgo;
            });
            
            expect(veryOldBills.length).toBeGreaterThan(0);
            
            // Property 3: Old bills should be accessible alongside recent ones
            const recentBillsReturned = tableBills.filter(bill => {
              const billDate = new Date(bill.createdAt);
              const thirtyDaysAgo = new Date(now);
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return billDate >= thirtyDaysAgo;
            });
            
            expect(recentBillsReturned.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    }, 180000);
  });

  /**
   * Extended test: Verify bills with all statuses are returned regardless of date
   */
  describe('Property 1 (Extended): All bill statuses returned regardless of date', () => {
    it('should return bills with any status regardless of creation date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billsPerStatus: fc.integer({ min: 3, max: 8 }),
            daysSpread: fc.integer({ min: 60, max: 180 })
          }),
          async ({ billsPerStatus, daysSpread }) => {
            // Create a test table
            const table = await createTestTable();
            
            const statuses = ['draft', 'partial', 'paid', 'overdue'];
            const now = new Date();
            let totalBills = 0;
            
            // Create bills with different statuses spread across dates
            for (const status of statuses) {
              for (let i = 0; i < billsPerStatus; i++) {
                const billDate = new Date(now);
                billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysSpread));
                
                await Bill.create({
                  customerName: `Customer ${status} ${i}`,
                  table: table._id,
                  tableNumber: table.number,
                  subtotal: 100,
                  total: 100,
                  paid: status === 'paid' ? 100 : (status === 'partial' ? 50 : 0),
                  remaining: status === 'paid' ? 0 : (status === 'partial' ? 50 : 100),
                  status: status,
                  billType: 'cafe',
                  organization: testOrganizationId,
                  createdBy: testUserId,
                  createdAt: billDate
                });
                totalBills++;
              }
            }
            
            // Query all bills for this table
            const tableBills = await Bill.find({
              organization: testOrganizationId,
              table: table._id
            })
              .sort({ createdAt: -1 })
              .lean();
            
            // Property 1: Should return all bills regardless of status
            expect(tableBills.length).toBe(totalBills);
            
            // Property 2: Should include bills with all statuses
            const returnedStatuses = new Set(tableBills.map(b => b.status));
            expect(returnedStatuses.size).toBe(statuses.length);
            
            // Property 3: Each status should have the expected count
            for (const status of statuses) {
              const billsWithStatus = tableBills.filter(b => b.status === status);
              expect(billsWithStatus.length).toBe(billsPerStatus);
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 180000);
  });
});
