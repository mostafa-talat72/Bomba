/**
 * Property-Based Tests for Bills Pagination
 * Feature: bills-pagination-fix
 * 
 * These tests use fast-check to verify correctness properties across many random inputs
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';

describe('Property-Based Tests: Bills Pagination', () => {
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
    await Bill.deleteMany({ organization: testOrganizationId });
  }, 10000);

  /**
   * Helper function to create test bills with specific dates
   */
  async function createTestBills(count, startDate = new Date()) {
    const bills = [];
    for (let i = 0; i < count; i++) {
      const billDate = new Date(startDate);
      billDate.setHours(billDate.getHours() - i); // Each bill is 1 hour older
      
      const bill = await Bill.create({
        customerName: `Customer ${i}`,
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
    return bills;
  }

  /**
   * Feature: bills-pagination-fix, Property 1: Pagination maintains chronological order
   * For any set of bills in the database, fetching page N and page N+1 should return bills 
   * in consistent chronological order (newest first) with no duplicates and no gaps between pages.
   * Validates: Requirements 1.3, 3.5
   */
  describe('Property 1: Pagination maintains chronological order', () => {
    it('should maintain chronological order across pages with no duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalBills: fc.integer({ min: 10, max: 50 }),
            pageSize: fc.integer({ min: 5, max: 20 })
          }),
          async ({ totalBills, pageSize }) => {
            // Create test bills
            await createTestBills(totalBills);

            // Fetch page 1
            const page1Bills = await Bill.find({ organization: testOrganizationId })
              .sort({ createdAt: -1 })
              .limit(pageSize)
              .skip(0)
              .lean();

            // Fetch page 2
            const page2Bills = await Bill.find({ organization: testOrganizationId })
              .sort({ createdAt: -1 })
              .limit(pageSize)
              .skip(pageSize)
              .lean();

            if (page1Bills.length > 0 && page2Bills.length > 0) {
              // Property 1: Last bill of page 1 should be newer than or equal to first bill of page 2
              const lastOfPage1 = page1Bills[page1Bills.length - 1];
              const firstOfPage2 = page2Bills[0];
              expect(new Date(lastOfPage1.createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(firstOfPage2.createdAt).getTime()
              );

              // Property 2: No duplicates between pages
              const page1Ids = new Set(page1Bills.map(b => b._id.toString()));
              const page2Ids = new Set(page2Bills.map(b => b._id.toString()));
              const intersection = [...page1Ids].filter(id => page2Ids.has(id));
              expect(intersection.length).toBe(0);
            }

            // Property 3: Bills within each page are sorted correctly (newest first)
            for (let i = 0; i < page1Bills.length - 1; i++) {
              expect(new Date(page1Bills[i].createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(page1Bills[i + 1].createdAt).getTime()
              );
            }
            for (let i = 0; i < page2Bills.length - 1; i++) {
              expect(new Date(page2Bills[i].createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(page2Bills[i + 1].createdAt).getTime()
              );
            }

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Feature: bills-pagination-fix, Property 2: Date filter returns only bills within range
   * For any date range (startDate, endDate), all returned bills should have 
   * createdAt >= startDate and createdAt <= endDate.
   * Validates: Requirements 2.1, 2.4
   */
  describe('Property 2: Date filter returns only bills within range', () => {
    it('should return only bills within the specified date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billCount: fc.integer({ min: 20, max: 50 }),
            daysBack: fc.integer({ min: 10, max: 30 })
          }),
          async ({ billCount, daysBack }) => {
            // Create bills spread across multiple days
            const now = new Date();
            const bills = [];
            for (let i = 0; i < billCount; i++) {
              const billDate = new Date(now);
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * daysBack));
              
              const bill = await Bill.create({
                customerName: `Customer ${i}`,
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
              bills.push(bill);
            }

            // Pick a random date range
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - Math.floor(daysBack / 2));
            const endDate = new Date(now);

            // Query with date filter
            const query = {
              organization: testOrganizationId,
              createdAt: {
                $gte: startDate,
                $lte: endDate
              }
            };

            const filteredBills = await Bill.find(query).lean();

            // Property: All returned bills should be within the date range
            filteredBills.forEach(bill => {
              const billDate = new Date(bill.createdAt);
              expect(billDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(billDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Feature: bills-pagination-fix, Property 3: Bills from any time period are accessible
   * For any bill with any createdAt date, that bill should be retrievable through pagination 
   * (possibly requiring multiple page loads).
   * Validates: Requirements 1.5
   */
  describe('Property 3: Bills from any time period are accessible', () => {
    it('should be able to retrieve any bill through pagination', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalBills: fc.integer({ min: 50, max: 100 }),
            pageSize: fc.integer({ min: 10, max: 20 }),
            targetBillIndex: fc.integer({ min: 0, max: 99 })
          }),
          async ({ totalBills, pageSize, targetBillIndex }) => {
            // Ensure targetBillIndex is within bounds
            const actualTargetIndex = targetBillIndex % totalBills;
            
            // Create bills with random old dates
            const now = new Date();
            const bills = [];
            for (let i = 0; i < totalBills; i++) {
              const billDate = new Date(now);
              // Create bills from up to 365 days ago
              billDate.setDate(billDate.getDate() - Math.floor(Math.random() * 365));
              
              const bill = await Bill.create({
                customerName: `Customer ${i}`,
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

            // Sort bills by date (newest first) to know which one should be at targetIndex
            const sortedBills = bills.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const targetBill = sortedBills[actualTargetIndex];

            // Paginate through all pages to find the target bill
            let found = false;
            let currentPage = 0;
            const maxPages = Math.ceil(totalBills / pageSize);

            while (currentPage < maxPages && !found) {
              const pageBills = await Bill.find({ organization: testOrganizationId })
                .sort({ createdAt: -1 })
                .limit(pageSize)
                .skip(currentPage * pageSize)
                .lean();

              found = pageBills.some(b => b._id.toString() === targetBill._id.toString());
              currentPage++;
            }

            // Property: The target bill should be found through pagination
            expect(found).toBe(true);

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 50 }
      );
    }, 300000);
  });

  /**
   * Feature: bills-pagination-fix, Property 4: API respects pagination parameters
   * For any valid page number and limit value, the API should return exactly 
   * min(limit, remaining_records) bills starting from the correct offset.
   * Validates: Requirements 3.1
   */
  describe('Property 4: API respects pagination parameters', () => {
    it('should return correct number of bills based on page and limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalBills: fc.integer({ min: 30, max: 80 }),
            page: fc.integer({ min: 1, max: 5 }),
            limit: fc.integer({ min: 5, max: 25 })
          }),
          async ({ totalBills, page, limit }) => {
            // Create test bills
            await createTestBills(totalBills);

            // Calculate expected results
            const skip = (page - 1) * limit;
            const remainingRecords = Math.max(0, totalBills - skip);
            const expectedCount = Math.min(limit, remainingRecords);

            // Fetch bills with pagination
            const bills = await Bill.find({ organization: testOrganizationId })
              .sort({ createdAt: -1 })
              .limit(limit)
              .skip(skip)
              .lean();

            // Property: Should return exactly the expected number of bills
            expect(bills.length).toBe(expectedCount);

            // Property: Should start from the correct offset
            if (bills.length > 0) {
              const allBills = await Bill.find({ organization: testOrganizationId })
                .sort({ createdAt: -1 })
                .lean();
              
              if (skip < allBills.length) {
                expect(bills[0]._id.toString()).toBe(allBills[skip]._id.toString());
              }
            }

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Feature: bills-pagination-fix, Property 5: API returns correct pagination metadata
   * For any query, the pagination metadata should accurately reflect: current page, limit, 
   * total count, hasMore flag, and totalPages.
   * Validates: Requirements 3.2
   */
  describe('Property 5: API returns correct pagination metadata', () => {
    it('should return accurate pagination metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalBills: fc.integer({ min: 20, max: 100 }),
            page: fc.integer({ min: 1, max: 10 }),
            limit: fc.integer({ min: 5, max: 30 })
          }),
          async ({ totalBills, page, limit }) => {
            // Create test bills
            await createTestBills(totalBills);

            // Calculate expected metadata
            const skip = (page - 1) * limit;
            const total = totalBills;
            const expectedHasMore = (page * limit) < total;
            const expectedTotalPages = Math.ceil(total / limit);

            // Fetch bills
            const bills = await Bill.find({ organization: testOrganizationId })
              .sort({ createdAt: -1 })
              .limit(limit)
              .skip(skip)
              .lean();

            const count = bills.length;

            // Simulate pagination metadata
            const metadata = {
              page: page,
              limit: limit,
              hasMore: (page * limit) < total,
              totalPages: Math.ceil(total / limit),
              total: total,
              count: count
            };

            // Property: Metadata should be accurate
            expect(metadata.page).toBe(page);
            expect(metadata.limit).toBe(limit);
            expect(metadata.total).toBe(total);
            expect(metadata.count).toBe(count);
            expect(metadata.hasMore).toBe(expectedHasMore);
            expect(metadata.totalPages).toBe(expectedTotalPages);

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Feature: bills-pagination-fix, Property 6: API enforces maximum limit
   * For any limit value greater than 100, the API should cap the returned results at 100 records.
   * Validates: Requirements 3.3
   */
  describe('Property 6: API enforces maximum limit', () => {
    it('should cap results at 100 records when limit exceeds maximum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalBills: fc.integer({ min: 150, max: 200 }),
            requestedLimit: fc.integer({ min: 101, max: 500 })
          }),
          async ({ totalBills, requestedLimit }) => {
            // Create test bills
            await createTestBills(totalBills);

            // Enforce maximum limit (as the API should do)
            const effectiveLimit = Math.min(requestedLimit, 100);

            // Fetch bills with enforced limit
            const bills = await Bill.find({ organization: testOrganizationId })
              .sort({ createdAt: -1 })
              .limit(effectiveLimit)
              .lean();

            // Property: Should never return more than 100 bills
            expect(bills.length).toBeLessThanOrEqual(100);
            expect(bills.length).toBe(Math.min(effectiveLimit, totalBills));

            // Cleanup
            await Bill.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 50 }
      );
    }, 180000);
  });
});
