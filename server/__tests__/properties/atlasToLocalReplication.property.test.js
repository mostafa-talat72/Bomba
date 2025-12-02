/**
 * Property-Based Tests for Atlas→Local Replication
 * Feature: bidirectional-sync, Property 1: Atlas to Local replication with business logic
 * 
 * For any operation (insert, update, delete) performed on Atlas, the same operation 
 * should be replicated to Local MongoDB with proper execution of Mongoose pre-save hooks,
 * validation, and calculated fields
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.6
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Bill from '../../models/Bill.js';
import Order from '../../models/Order.js';
import Session from '../../models/Session.js';
import ChangeProcessor from '../../services/sync/changeProcessor.js';
import OriginTracker from '../../services/sync/originTracker.js';
import ConflictResolver from '../../services/sync/conflictResolver.js';

describe('Property-Based Tests: Atlas→Local Replication', () => {
  let mongoServer;
  let localConnection;
  let atlasConnection;
  let changeProcessor;
  let originTracker;
  let conflictResolver;
  let testOrganizationId;
  let testUserId;

  beforeAll(async () => {
    // Start in-memory MongoDB servers for Local and Atlas
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Create separate connections for Local and Atlas simulation
    localConnection = await mongoose.createConnection(mongoUri + 'local').asPromise();
    atlasConnection = await mongoose.createConnection(mongoUri + 'atlas').asPromise();
    
    // Register models on both connections
    // Only register Bill model - we don't need Order/Session for these tests
    if (!localConnection.models['Bill']) {
      localConnection.model('Bill', Bill.schema);
    }
    if (!atlasConnection.models['Bill']) {
      atlasConnection.model('Bill', Bill.schema);
    }
    
    // Register Order and Session models to prevent buffering timeouts
    // but we won't use them in tests
    if (!localConnection.models['Order']) {
      localConnection.model('Order', Order.schema);
    }
    if (!atlasConnection.models['Order']) {
      atlasConnection.model('Order', Order.schema);
    }
    if (!localConnection.models['Session']) {
      localConnection.model('Session', Session.schema);
    }
    if (!atlasConnection.models['Session']) {
      atlasConnection.model('Session', Session.schema);
    }

    // Create test IDs
    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();

    // Initialize sync components
    originTracker = new OriginTracker();
    conflictResolver = new ConflictResolver();
    
    // Mock database manager
    const mockDatabaseManager = {
      localConnection: localConnection,
      atlasConnection: atlasConnection,
      getAtlasConnection: () => atlasConnection,
      isAtlasAvailable: () => true
    };
    
    changeProcessor = new ChangeProcessor(originTracker, conflictResolver, mockDatabaseManager);
  }, 60000);

  afterAll(async () => {
    await localConnection.close();
    await atlasConnection.close();
    await mongoServer.stop();
    originTracker.stopCleanup();
  }, 30000);

  beforeEach(async () => {
    // Clear collections with proper timeout handling
    // Only clear bills collection - don't touch orders or sessions
    try {
      const LocalBill = localConnection.model('Bill');
      await LocalBill.deleteMany({}).maxTimeMS(5000);
    } catch (err) {
      // Ignore errors during cleanup
    }
    
    try {
      const AtlasBill = atlasConnection.model('Bill');
      await AtlasBill.deleteMany({}).maxTimeMS(5000);
    } catch (err) {
      // Ignore errors during cleanup
    }
    
    // Clear origin tracker
    if (originTracker && typeof originTracker.clear === 'function') {
      originTracker.clear();
    }
    
    // Reset processor stats
    if (changeProcessor && typeof changeProcessor.resetStats === 'function') {
      changeProcessor.resetStats();
    }
  }, 15000);

  /**
   * Feature: bidirectional-sync, Property 1: Atlas to Local replication with business logic
   * For any operation (insert, update, delete) performed on Atlas, the same operation 
   * should be replicated to Local MongoDB with proper execution of Mongoose pre-save hooks,
   * validation, and calculated fields
   * Validates: Requirements 1.1, 1.2, 1.3, 1.6
   */
  describe('Property 1: Atlas to Local replication with business logic', () => {
    /**
     * Test insert replication with business logic execution
     */
    it('should replicate insert operations from Atlas to Local with business logic', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billType: fc.constantFrom('cafe', 'playstation', 'computer'),
            subtotal: fc.double({ min: 10, max: 1000, noNaN: true }),
            paidAmount: fc.double({ min: 0, max: 1, noNaN: true }) // 0 to 1 as a fraction
          }),
          async (billData) => {
            // Calculate paid amount
            const paid = Math.floor(billData.subtotal * billData.paidAmount);
            const remaining = billData.subtotal - paid;

            // Create document on Atlas (without status - let business logic calculate it)
            const AtlasBill = atlasConnection.model('Bill');
            const atlasBill = await AtlasBill.create({
              organization: testOrganizationId,
              createdBy: testUserId,
              billType: billData.billType,
              subtotal: billData.subtotal,
              total: billData.subtotal,
              paid: paid,
              remaining: remaining,
              // Don't set status - let the model calculate it
              billNumber: `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}` // Unique bill number
            });

            // Simulate Atlas Change Stream insert event
            const changeEvent = {
              _id: { _data: 'test-resume-token' },
              operationType: 'insert',
              fullDocument: atlasBill.toObject(),
              ns: {
                db: 'bomba',
                coll: 'bills'
              },
              documentKey: {
                _id: atlasBill._id
              },
              clusterTime: new Date()
            };

            // Process the change
            const result = await changeProcessor.processChange(changeEvent);

            // Verify: change was processed successfully
            expect(result.success).toBe(true);

            // Verify: document exists on Local
            const LocalBill = localConnection.model('Bill');
            const localBill = await LocalBill.findById(atlasBill._id);
            
            expect(localBill).toBeTruthy();
            expect(localBill._id.toString()).toBe(atlasBill._id.toString());
            expect(localBill.billType).toBe(billData.billType);
            expect(localBill.subtotal).toBe(billData.subtotal);
            expect(localBill.paid).toBe(paid);
            
            // Verify business logic: status should be calculated correctly
            // The Bill model calculates status based on paid/remaining/itemPayments
            // Since we have no itemPayments, it uses the fallback logic
            let expectedStatus = 'draft';
            if (remaining === 0 && paid > 0) {
              expectedStatus = 'paid';
            } else if (paid > 0 && paid < billData.subtotal) {
              expectedStatus = 'partial';
            }
            expect(localBill.status).toBe(expectedStatus);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    /**
     * Test update replication
     */
    it('should replicate update operations from Atlas to Local', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialStatus: fc.constantFrom('draft', 'partial'),
            updatedStatus: fc.constantFrom('paid', 'partial'),
            initialPaid: fc.double({ min: 0, max: 500, noNaN: true }),
            additionalPaid: fc.double({ min: 0, max: 500, noNaN: true })
          }),
          async (data) => {
            // Create initial document on both databases
            const billId = new mongoose.Types.ObjectId();
            const initialDoc = {
              _id: billId,
              organization: testOrganizationId,
              createdBy: testUserId,
              billType: 'cafe',
              subtotal: 1000,
              total: 1000,
              paid: data.initialPaid,
              remaining: 1000 - data.initialPaid,
              status: data.initialStatus
            };

            const LocalBill = localConnection.model('Bill');
            const AtlasBill = atlasConnection.model('Bill');
            
            await LocalBill.create(initialDoc);
            await AtlasBill.create(initialDoc);

            // Update on Atlas
            const newPaid = data.initialPaid + data.additionalPaid;
            await AtlasBill.findByIdAndUpdate(billId, {
              paid: newPaid,
              remaining: 1000 - newPaid,
              status: data.updatedStatus
            });

            // Simulate Atlas Change Stream update event
            const changeEvent = {
              _id: { _data: 'test-resume-token' },
              operationType: 'update',
              ns: {
                db: 'bomba',
                coll: 'bills'
              },
              documentKey: {
                _id: billId
              },
              updateDescription: {
                updatedFields: {
                  paid: newPaid,
                  remaining: 1000 - newPaid,
                  status: data.updatedStatus
                },
                removedFields: []
              },
              clusterTime: new Date()
            };

            // Process the change
            const result = await changeProcessor.processChange(changeEvent);

            // Verify: change was processed successfully
            expect(result.success).toBe(true);

            // Verify: document is updated on Local
            const localBill = await LocalBill.findById(billId);
            
            expect(localBill).toBeTruthy();
            expect(localBill.paid).toBe(newPaid);
            expect(localBill.status).toBe(data.updatedStatus);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    /**
     * Test delete replication
     */
    it('should replicate delete operations from Atlas to Local', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            billType: fc.constantFrom('cafe', 'playstation', 'computer'),
            subtotal: fc.double({ min: 0, max: 1000, noNaN: true })
          }),
          async (billData) => {
            // Create document on both databases
            const billId = new mongoose.Types.ObjectId();
            const doc = {
              _id: billId,
              organization: testOrganizationId,
              createdBy: testUserId,
              billType: billData.billType,
              subtotal: billData.subtotal,
              total: billData.subtotal,
              paid: 0,
              remaining: billData.subtotal,
              status: 'draft'
            };

            const LocalBill = localConnection.model('Bill');
            const AtlasBill = atlasConnection.model('Bill');
            
            await LocalBill.create(doc);
            await AtlasBill.create(doc);

            // Delete on Atlas
            await AtlasBill.findByIdAndDelete(billId);

            // Simulate Atlas Change Stream delete event
            const changeEvent = {
              _id: { _data: 'test-resume-token' },
              operationType: 'delete',
              ns: {
                db: 'bomba',
                coll: 'bills'
              },
              documentKey: {
                _id: billId
              },
              clusterTime: new Date()
            };

            // Process the change
            const result = await changeProcessor.processChange(changeEvent);

            // Verify: change was processed successfully
            expect(result.success).toBe(true);

            // Verify: document is deleted on Local
            const localBill = await LocalBill.findById(billId);
            
            expect(localBill).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    /**
     * Test replace replication
     */
    it('should replicate replace operations from Atlas to Local', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialType: fc.constantFrom('cafe', 'playstation'),
            replacedType: fc.constantFrom('computer', 'playstation'),
            initialTotal: fc.double({ min: 100, max: 500, noNaN: true }),
            replacedTotal: fc.double({ min: 500, max: 1000, noNaN: true })
          }),
          async (data) => {
            // Create initial document on both databases
            const billId = new mongoose.Types.ObjectId();
            const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const initialDoc = {
              _id: billId,
              organization: testOrganizationId,
              createdBy: testUserId,
              billType: data.initialType,
              subtotal: data.initialTotal,
              total: data.initialTotal,
              paid: 0,
              remaining: data.initialTotal,
              status: 'draft',
              billNumber: billNumber
            };

            const LocalBill = localConnection.model('Bill');
            const AtlasBill = atlasConnection.model('Bill');
            
            await LocalBill.create(initialDoc);
            await AtlasBill.create(initialDoc);

            // Replace on Atlas - use unique bill number to avoid duplicate key error
            const newBillNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const replacedDoc = {
              _id: billId,
              organization: testOrganizationId,
              createdBy: testUserId,
              billType: data.replacedType,
              subtotal: data.replacedTotal,
              total: data.replacedTotal,
              paid: 0,
              remaining: data.replacedTotal,
              status: 'draft',
              billNumber: newBillNumber // Use new unique bill number
            };
            
            await AtlasBill.replaceOne({ _id: billId }, replacedDoc);

            // Simulate Atlas Change Stream replace event
            const changeEvent = {
              _id: { _data: 'test-resume-token' },
              operationType: 'replace',
              fullDocument: replacedDoc,
              ns: {
                db: 'bomba',
                coll: 'bills'
              },
              documentKey: {
                _id: billId
              },
              clusterTime: new Date()
            };

            // Process the change
            const result = await changeProcessor.processChange(changeEvent);

            // Verify: change was processed successfully
            expect(result.success).toBe(true);

            // Verify: document is replaced on Local
            const localBill = await LocalBill.findById(billId);
            
            expect(localBill).toBeTruthy();
            expect(localBill.billType).toBe(data.replacedType);
            expect(localBill.total).toBe(data.replacedTotal);
            expect(localBill.billNumber).toBe(newBillNumber);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    /**
     * Test multiple operations in sequence
     */
    it('should replicate a sequence of operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('insert', 'update', 'delete'),
              billType: fc.constantFrom('cafe', 'playstation', 'computer'),
              amount: fc.double({ min: 10, max: 1000, noNaN: true })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (operations) => {
            const LocalBill = localConnection.model('Bill');
            const AtlasBill = atlasConnection.model('Bill');
            const billId = new mongoose.Types.ObjectId();
            const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            let documentExists = false;
            let lastCreatedDoc = null;

            for (const op of operations) {
              let changeEvent;

              if (op.operation === 'insert' && !documentExists) {
                // Insert operation
                const doc = {
                  _id: billId,
                  organization: testOrganizationId,
                  createdBy: testUserId,
                  billType: op.billType,
                  subtotal: op.amount,
                  total: op.amount,
                  paid: 0,
                  remaining: op.amount,
                  status: 'draft',
                  billNumber: billNumber
                };

                const created = await AtlasBill.create(doc);
                lastCreatedDoc = created.toObject();
                documentExists = true;

                changeEvent = {
                  _id: { _data: 'test-resume-token' },
                  operationType: 'insert',
                  fullDocument: lastCreatedDoc,
                  ns: { db: 'bomba', coll: 'bills' },
                  documentKey: { _id: billId },
                  clusterTime: new Date()
                };

              } else if (op.operation === 'update' && documentExists) {
                // Update operation
                await AtlasBill.findByIdAndUpdate(billId, {
                  paid: op.amount / 2,
                  remaining: op.amount / 2
                });

                changeEvent = {
                  _id: { _data: 'test-resume-token' },
                  operationType: 'update',
                  ns: { db: 'bomba', coll: 'bills' },
                  documentKey: { _id: billId },
                  updateDescription: {
                    updatedFields: {
                      paid: op.amount / 2,
                      remaining: op.amount / 2
                    },
                    removedFields: []
                  },
                  clusterTime: new Date()
                };

              } else if (op.operation === 'delete' && documentExists) {
                // Delete operation
                await AtlasBill.findByIdAndDelete(billId);
                documentExists = false;

                changeEvent = {
                  _id: { _data: 'test-resume-token' },
                  operationType: 'delete',
                  ns: { db: 'bomba', coll: 'bills' },
                  documentKey: { _id: billId },
                  clusterTime: new Date()
                };

              } else {
                // Skip invalid operation sequence
                continue;
              }

              // Process the change
              const result = await changeProcessor.processChange(changeEvent);
              expect(result.success).toBe(true);
            }

            // Verify final state matches
            const localBill = await LocalBill.findById(billId);
            const atlasBill = await AtlasBill.findById(billId);

            if (documentExists) {
              expect(localBill).toBeTruthy();
              expect(atlasBill).toBeTruthy();
              expect(localBill._id.toString()).toBe(atlasBill._id.toString());
            } else {
              expect(localBill).toBeNull();
              expect(atlasBill).toBeNull();
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 90000);
  });
});
