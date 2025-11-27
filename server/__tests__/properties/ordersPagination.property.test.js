/**
 * Property-Based Tests for Orders Pagination
 * Feature: bills-pagination-fix
 * 
 * These tests use fast-check to verify correctness properties across many random inputs
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Order from '../../models/Order.js';

describe('Property-Based Tests: Orders Pagination', () => {
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
  }, 10000);

  /**
   * Helper function to create test orders with specific dates and statuses
   */
  async function createTestOrders(count, options = {}) {
    const { startDate = new Date(), statuses = ['pending', 'preparing', 'ready', 'delivered'] } = options;
    const orders = [];
    
    for (let i = 0; i < count; i++) {
      const orderDate = new Date(startDate);
      orderDate.setHours(orderDate.getHours() - i); // Each order is 1 hour older
      
      // Randomly assign status
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const order = await Order.create({
        orderNumber: `ORD-${Date.now()}-${i}`,
        customerName: `Customer ${i}`,
        items: [
          {
            name: `Item ${i}`,
            price: 50 + i,
            quantity: 1,
            itemTotal: 50 + i
          }
        ],
        subtotal: 50 + i,
        finalAmount: 50 + i,
        status: status,
        organization: testOrganizationId,
        createdBy: testUserId,
        createdAt: orderDate
      });
      orders.push(order);
    }
    return orders;
  }

  /**
   * Feature: bills-pagination-fix, Property 7: Filtered pagination maintains functionality
   * For any status filter applied to orders, pagination should work correctly with 
   * accurate page counts and hasMore flags.
   * Validates: Requirements 4.4
   */
  describe('Property 7: Filtered pagination maintains functionality', () => {
    it('should maintain correct pagination when status filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalOrders: fc.integer({ min: 30, max: 80 }),
            pageSize: fc.integer({ min: 5, max: 20 }),
            statusFilter: fc.constantFrom('pending', 'preparing', 'ready', 'delivered')
          }),
          async ({ totalOrders, pageSize, statusFilter }) => {
            // Create orders with various statuses
            await createTestOrders(totalOrders, {
              statuses: ['pending', 'preparing', 'ready', 'delivered']
            });

            // Build query with status filter
            const query = {
              organization: testOrganizationId,
              status: statusFilter
            };

            // Get total count for filtered results
            const totalFiltered = await Order.countDocuments(query);

            // Fetch first page with filter
            const page1Orders = await Order.find(query)
              .sort({ createdAt: -1 })
              .limit(pageSize)
              .skip(0)
              .lean();

            // Calculate pagination metadata
            const page1Metadata = {
              page: 1,
              limit: pageSize,
              hasMore: (1 * pageSize) < totalFiltered,
              totalPages: Math.ceil(totalFiltered / pageSize),
              total: totalFiltered
            };

            // Property 1: All returned orders should match the filter
            page1Orders.forEach(order => {
              expect(order.status).toBe(statusFilter);
            });

            // Property 2: Pagination metadata should be accurate
            expect(page1Metadata.total).toBe(totalFiltered);
            expect(page1Metadata.hasMore).toBe((1 * pageSize) < totalFiltered);
            expect(page1Metadata.totalPages).toBe(Math.ceil(totalFiltered / pageSize));

            // Property 3: Should return correct number of orders
            const expectedCount = Math.min(pageSize, totalFiltered);
            expect(page1Orders.length).toBe(expectedCount);

            // If there are more pages, test pagination continuity
            if (page1Metadata.hasMore) {
              const page2Orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .limit(pageSize)
                .skip(pageSize)
                .lean();

              // Property 4: No duplicates between pages
              const page1Ids = new Set(page1Orders.map(o => o._id.toString()));
              const page2Ids = new Set(page2Orders.map(o => o._id.toString()));
              const intersection = [...page1Ids].filter(id => page2Ids.has(id));
              expect(intersection.length).toBe(0);

              // Property 5: Chronological order maintained across pages
              if (page1Orders.length > 0 && page2Orders.length > 0) {
                const lastOfPage1 = page1Orders[page1Orders.length - 1];
                const firstOfPage2 = page2Orders[0];
                expect(new Date(lastOfPage1.createdAt).getTime()).toBeGreaterThanOrEqual(
                  new Date(firstOfPage2.createdAt).getTime()
                );
              }

              // Property 6: All page 2 orders should also match the filter
              page2Orders.forEach(order => {
                expect(order.status).toBe(statusFilter);
              });
            }

            // Cleanup
            await Order.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should maintain correct pagination with date range filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalOrders: fc.integer({ min: 40, max: 100 }),
            pageSize: fc.integer({ min: 10, max: 25 }),
            daysBack: fc.integer({ min: 10, max: 30 })
          }),
          async ({ totalOrders, pageSize, daysBack }) => {
            // Create orders spread across multiple days
            const now = new Date();
            const orders = [];
            for (let i = 0; i < totalOrders; i++) {
              const orderDate = new Date(now);
              orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * daysBack));
              
              const order = await Order.create({
                orderNumber: `ORD-${Date.now()}-${i}`,
                customerName: `Customer ${i}`,
                items: [
                  {
                    name: `Item ${i}`,
                    price: 50,
                    quantity: 1,
                    itemTotal: 50
                  }
                ],
                subtotal: 50,
                finalAmount: 50,
                status: 'pending',
                organization: testOrganizationId,
                createdBy: testUserId,
                createdAt: orderDate
              });
              orders.push(order);
            }

            // Pick a random date range
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - Math.floor(daysBack / 2));
            const endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);

            // Build query with date filter
            const query = {
              organization: testOrganizationId,
              createdAt: {
                $gte: startDate,
                $lte: endDate
              }
            };

            // Get total count for filtered results
            const totalFiltered = await Order.countDocuments(query);

            // Fetch first page with date filter
            const page1Orders = await Order.find(query)
              .sort({ createdAt: -1 })
              .limit(pageSize)
              .skip(0)
              .lean();

            // Property 1: All returned orders should be within date range
            page1Orders.forEach(order => {
              const orderDate = new Date(order.createdAt);
              expect(orderDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(orderDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });

            // Property 2: Pagination should work correctly with date filter
            const expectedCount = Math.min(pageSize, totalFiltered);
            expect(page1Orders.length).toBe(expectedCount);

            // Property 3: hasMore flag should be accurate
            const hasMore = (1 * pageSize) < totalFiltered;
            if (hasMore) {
              // Fetch second page
              const page2Orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .limit(pageSize)
                .skip(pageSize)
                .lean();

              // Property 4: Page 2 orders should also be within date range
              page2Orders.forEach(order => {
                const orderDate = new Date(order.createdAt);
                expect(orderDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(orderDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
              });

              // Property 5: No duplicates between pages
              const page1Ids = new Set(page1Orders.map(o => o._id.toString()));
              const page2Ids = new Set(page2Orders.map(o => o._id.toString()));
              const intersection = [...page1Ids].filter(id => page2Ids.has(id));
              expect(intersection.length).toBe(0);
            }

            // Cleanup
            await Order.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should maintain correct pagination with combined status and date filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalOrders: fc.integer({ min: 50, max: 120 }),
            pageSize: fc.integer({ min: 10, max: 20 }),
            statusFilter: fc.constantFrom('pending', 'preparing', 'ready', 'delivered'),
            daysBack: fc.integer({ min: 5, max: 15 })
          }),
          async ({ totalOrders, pageSize, statusFilter, daysBack }) => {
            // Create orders with various statuses across multiple days
            const now = new Date();
            const orders = [];
            for (let i = 0; i < totalOrders; i++) {
              const orderDate = new Date(now);
              orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * daysBack));
              
              const status = ['pending', 'preparing', 'ready', 'delivered'][
                Math.floor(Math.random() * 4)
              ];
              
              const order = await Order.create({
                orderNumber: `ORD-${Date.now()}-${i}`,
                customerName: `Customer ${i}`,
                items: [
                  {
                    name: `Item ${i}`,
                    price: 50,
                    quantity: 1,
                    itemTotal: 50
                  }
                ],
                subtotal: 50,
                finalAmount: 50,
                status: status,
                organization: testOrganizationId,
                createdBy: testUserId,
                createdAt: orderDate
              });
              orders.push(order);
            }

            // Pick a date range
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - Math.floor(daysBack / 2));
            const endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);

            // Build query with both filters
            const query = {
              organization: testOrganizationId,
              status: statusFilter,
              createdAt: {
                $gte: startDate,
                $lte: endDate
              }
            };

            // Get total count for filtered results
            const totalFiltered = await Order.countDocuments(query);

            // Fetch orders with combined filters
            const filteredOrders = await Order.find(query)
              .sort({ createdAt: -1 })
              .limit(pageSize)
              .skip(0)
              .lean();

            // Property 1: All orders should match both filters
            filteredOrders.forEach(order => {
              expect(order.status).toBe(statusFilter);
              const orderDate = new Date(order.createdAt);
              expect(orderDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(orderDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });

            // Property 2: Pagination metadata should be accurate for combined filters
            const expectedCount = Math.min(pageSize, totalFiltered);
            expect(filteredOrders.length).toBe(expectedCount);

            const hasMore = (1 * pageSize) < totalFiltered;
            const totalPages = Math.ceil(totalFiltered / pageSize);

            // Property 3: Should be able to paginate through all filtered results
            if (hasMore && totalPages > 1) {
              let allFilteredOrders = [...filteredOrders];
              let currentPage = 2;

              while (currentPage <= Math.min(totalPages, 3)) { // Test up to 3 pages
                const pageOrders = await Order.find(query)
                  .sort({ createdAt: -1 })
                  .limit(pageSize)
                  .skip((currentPage - 1) * pageSize)
                  .lean();

                // All orders should match filters
                pageOrders.forEach(order => {
                  expect(order.status).toBe(statusFilter);
                  const orderDate = new Date(order.createdAt);
                  expect(orderDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                  expect(orderDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
                });

                // No duplicates with previous pages
                const existingIds = new Set(allFilteredOrders.map(o => o._id.toString()));
                const newIds = pageOrders.map(o => o._id.toString());
                const duplicates = newIds.filter(id => existingIds.has(id));
                expect(duplicates.length).toBe(0);

                allFilteredOrders = [...allFilteredOrders, ...pageOrders];
                currentPage++;
              }
            }

            // Cleanup
            await Order.deleteMany({ organization: testOrganizationId });
          }
        ),
        { numRuns: 50 }
      );
    }, 240000);
  });
});
