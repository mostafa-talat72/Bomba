import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  buildTableMap,
  isValidObjectId,
  migrateOrders,
  migrateBills,
  verifyMigration
} from '../../scripts/migrateTableNumberToObjectId.js';

// Define test schemas
const tableSchema = new mongoose.Schema({
  number: mongoose.Schema.Types.Mixed,
  name: String,
  section: mongoose.Schema.Types.ObjectId,
  organization: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  status: String
}, { strict: false });

const orderSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  tableNumber: mongoose.Schema.Types.Mixed,
  orderNumber: String,
  organization: mongoose.Schema.Types.ObjectId
}, { strict: false });

const billSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  tableNumber: mongoose.Schema.Types.Mixed,
  billNumber: String,
  organization: mongoose.Schema.Types.ObjectId
}, { strict: false });

let mongoServer;
let Table, Order, Bill;

describe('Migration Script - migrateTableNumberToObjectId', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create models (check if they exist first to avoid overwrite error)
    try {
      Table = mongoose.model('Table');
    } catch (e) {
      Table = mongoose.model('Table', tableSchema);
    }
    
    try {
      Order = mongoose.model('Order');
    } catch (e) {
      Order = mongoose.model('Order', orderSchema);
    }
    
    try {
      Bill = mongoose.model('Bill');
    } catch (e) {
      Bill = mongoose.model('Bill', billSchema);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    await Table.deleteMany({});
    await Order.deleteMany({});
    await Bill.deleteMany({});
  });

  describe('isValidObjectId', () => {
    it('should return true for valid ObjectId', () => {
      const validId = new mongoose.Types.ObjectId();
      expect(isValidObjectId(validId)).toBe(true);
      expect(isValidObjectId(validId.toString())).toBe(true);
    });

    it('should return false for invalid ObjectId', () => {
      expect(isValidObjectId('123')).toBe(false);
      expect(isValidObjectId('invalid-id')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId('')).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isValidObjectId(5)).toBe(false);
      expect(isValidObjectId('5')).toBe(false);
    });
  });

  describe('buildTableMap', () => {
    it('should build map of table numbers to ObjectIds', async () => {
      // Create test tables
      const table1 = await Table.create({ number: 1, name: 'Table 1' });
      const table2 = await Table.create({ number: 2, name: 'Table 2' });
      const table3 = await Table.create({ number: '3', name: 'Table 3' });

      const tableMap = await buildTableMap();

      expect(tableMap.size).toBe(3);
      expect(tableMap.get('1').toString()).toBe(table1._id.toString());
      expect(tableMap.get('2').toString()).toBe(table2._id.toString());
      expect(tableMap.get('3').toString()).toBe(table3._id.toString());
    });

    it('should handle empty table collection', async () => {
      const tableMap = await buildTableMap();
      expect(tableMap.size).toBe(0);
    });

    it('should handle string and number table numbers', async () => {
      const table1 = await Table.create({ number: 5, name: 'Table 5' });
      const table2 = await Table.create({ number: '10', name: 'Table 10' });

      const tableMap = await buildTableMap();

      expect(tableMap.get('5').toString()).toBe(table1._id.toString());
      expect(tableMap.get('10').toString()).toBe(table2._id.toString());
    });
  });

  describe('migrateOrders', () => {
    it('should convert tableNumber field to table ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: 5, name: 'Table 5' });
      const tableMap = new Map([['5', table._id]]);

      // Create order with tableNumber field
      const order = await Order.create({
        orderNumber: 'ORD-001',
        tableNumber: 5
      });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.updated).toBe(1);
      expect(stats.errors).toBe(0);

      const updatedOrder = await Order.findById(order._id).lean();
      expect(updatedOrder.table.toString()).toBe(table._id.toString());
      expect(updatedOrder.tableNumber).toBeUndefined();
    });

    it('should convert table field with number to ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: 3, name: 'Table 3' });
      const tableMap = new Map([['3', table._id]]);

      // Create order with table as number
      const order = await Order.create({
        orderNumber: 'ORD-002',
        table: 3
      });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.updated).toBe(1);
      expect(stats.errors).toBe(0);

      const updatedOrder = await Order.findById(order._id).lean();
      expect(updatedOrder.table.toString()).toBe(table._id.toString());
    });

    it('should skip orders with valid ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: 7, name: 'Table 7' });
      const tableMap = new Map([['7', table._id]]);

      // Create order with valid ObjectId
      const order = await Order.create({
        orderNumber: 'ORD-003',
        table: table._id
      });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.skipped).toBe(1);
      expect(stats.updated).toBe(0);

      const updatedOrder = await Order.findById(order._id).lean();
      expect(updatedOrder.table.toString()).toBe(table._id.toString());
    });

    it('should handle missing tables', async () => {
      const tableMap = new Map([['5', new mongoose.Types.ObjectId()]]);

      // Create order with non-existent table
      const order = await Order.create({
        orderNumber: 'ORD-004',
        tableNumber: 99
      });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.notFound).toBe(1);
      expect(stats.updated).toBe(0);

      const updatedOrder = await Order.findById(order._id).lean();
      expect(updatedOrder.tableNumber).toBe(99);
    });

    it('should skip orders without table reference', async () => {
      const tableMap = new Map();

      // Create order without table
      await Order.create({
        orderNumber: 'ORD-005'
      });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.skipped).toBe(1);
      expect(stats.updated).toBe(0);
    });

    it('should handle multiple orders', async () => {
      // Create tables
      const table1 = await Table.create({ number: 1, name: 'Table 1' });
      const table2 = await Table.create({ number: 2, name: 'Table 2' });
      const tableMap = new Map([
        ['1', table1._id],
        ['2', table2._id]
      ]);

      // Create orders
      await Order.create({ orderNumber: 'ORD-006', tableNumber: 1 });
      await Order.create({ orderNumber: 'ORD-007', table: 2 });
      await Order.create({ orderNumber: 'ORD-008', table: table1._id });
      await Order.create({ orderNumber: 'ORD-009' });

      // Run migration
      const stats = await migrateOrders(tableMap);

      // Verify
      expect(stats.total).toBe(4);
      expect(stats.updated).toBe(2);
      expect(stats.skipped).toBe(2);
    });
  });

  describe('migrateBills', () => {
    it('should convert tableNumber field to table ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: 8, name: 'Table 8' });
      const tableMap = new Map([['8', table._id]]);

      // Create bill with tableNumber field
      const bill = await Bill.create({
        billNumber: 'BILL-001',
        tableNumber: 8
      });

      // Run migration
      const stats = await migrateBills(tableMap);

      // Verify
      expect(stats.updated).toBe(1);
      expect(stats.errors).toBe(0);

      const updatedBill = await Bill.findById(bill._id).lean();
      expect(updatedBill.table.toString()).toBe(table._id.toString());
      expect(updatedBill.tableNumber).toBeUndefined();
    });

    it('should convert table field with string to ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: '12', name: 'Table 12' });
      const tableMap = new Map([['12', table._id]]);

      // Create bill with table as string
      const bill = await Bill.create({
        billNumber: 'BILL-002',
        table: '12'
      });

      // Run migration
      const stats = await migrateBills(tableMap);

      // Verify
      expect(stats.updated).toBe(1);
      expect(stats.errors).toBe(0);

      const updatedBill = await Bill.findById(bill._id).lean();
      expect(updatedBill.table.toString()).toBe(table._id.toString());
    });

    it('should skip bills with valid ObjectId', async () => {
      // Create table
      const table = await Table.create({ number: 15, name: 'Table 15' });
      const tableMap = new Map([['15', table._id]]);

      // Create bill with valid ObjectId
      const bill = await Bill.create({
        billNumber: 'BILL-003',
        table: table._id
      });

      // Run migration
      const stats = await migrateBills(tableMap);

      // Verify
      expect(stats.skipped).toBe(1);
      expect(stats.updated).toBe(0);

      const updatedBill = await Bill.findById(bill._id).lean();
      expect(updatedBill.table.toString()).toBe(table._id.toString());
    });

    it('should handle missing tables', async () => {
      const tableMap = new Map([['10', new mongoose.Types.ObjectId()]]);

      // Create bill with non-existent table
      const bill = await Bill.create({
        billNumber: 'BILL-004',
        tableNumber: 999
      });

      // Run migration
      const stats = await migrateBills(tableMap);

      // Verify
      expect(stats.notFound).toBe(1);
      expect(stats.updated).toBe(0);

      const updatedBill = await Bill.findById(bill._id).lean();
      expect(updatedBill.tableNumber).toBe(999);
    });

    it('should handle multiple bills', async () => {
      // Create tables
      const table1 = await Table.create({ number: 20, name: 'Table 20' });
      const table2 = await Table.create({ number: 21, name: 'Table 21' });
      const tableMap = new Map([
        ['20', table1._id],
        ['21', table2._id]
      ]);

      // Create bills
      await Bill.create({ billNumber: 'BILL-005', tableNumber: 20 });
      await Bill.create({ billNumber: 'BILL-006', table: '21' });
      await Bill.create({ billNumber: 'BILL-007', table: table1._id });
      await Bill.create({ billNumber: 'BILL-008' });

      // Run migration
      const stats = await migrateBills(tableMap);

      // Verify
      expect(stats.total).toBe(4);
      expect(stats.updated).toBe(2);
      expect(stats.skipped).toBe(2);
    });
  });

  describe('verifyMigration', () => {
    it('should verify all table references are valid ObjectIds', async () => {
      // Create table
      const table = await Table.create({ number: 30, name: 'Table 30' });

      // Create orders and bills with valid ObjectIds
      await Order.create({ orderNumber: 'ORD-010', table: table._id });
      await Order.create({ orderNumber: 'ORD-011', table: table._id });
      await Bill.create({ billNumber: 'BILL-009', table: table._id });

      // Run verification
      const results = await verifyMigration();

      // Verify
      expect(results.orders.total).toBe(2);
      expect(results.orders.valid).toBe(2);
      expect(results.orders.invalid).toBe(0);
      expect(results.bills.total).toBe(1);
      expect(results.bills.valid).toBe(1);
      expect(results.bills.invalid).toBe(0);
    });

    it('should detect invalid table references', async () => {
      // Create orders and bills with invalid references
      await Order.create({ orderNumber: 'ORD-012', table: 'invalid' });
      await Order.create({ orderNumber: 'ORD-013', table: 123 });
      await Bill.create({ billNumber: 'BILL-010', table: 'bad-ref' });

      // Run verification
      const results = await verifyMigration();

      // Verify
      expect(results.orders.total).toBe(2);
      expect(results.orders.valid).toBe(0);
      expect(results.orders.invalid).toBe(2);
      expect(results.bills.total).toBe(1);
      expect(results.bills.valid).toBe(0);
      expect(results.bills.invalid).toBe(1);
    });

    it('should handle empty collections', async () => {
      // Run verification with no data
      const results = await verifyMigration();

      // Verify
      expect(results.orders.total).toBe(0);
      expect(results.orders.valid).toBe(0);
      expect(results.orders.invalid).toBe(0);
      expect(results.bills.total).toBe(0);
      expect(results.bills.valid).toBe(0);
      expect(results.bills.invalid).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete migration workflow', async () => {
      // Create tables
      const table1 = await Table.create({ number: 1, name: 'Table 1' });
      const table2 = await Table.create({ number: 2, name: 'Table 2' });

      // Create orders with various formats
      await Order.create({ orderNumber: 'ORD-100', tableNumber: 1 });
      await Order.create({ orderNumber: 'ORD-101', table: 2 });
      await Order.create({ orderNumber: 'ORD-102', table: table1._id });
      await Order.create({ orderNumber: 'ORD-103' });

      // Create bills with various formats
      await Bill.create({ billNumber: 'BILL-100', tableNumber: 1 });
      await Bill.create({ billNumber: 'BILL-101', table: '2' });
      await Bill.create({ billNumber: 'BILL-102', table: table2._id });

      // Build table map
      const tableMap = await buildTableMap();
      expect(tableMap.size).toBe(2);

      // Migrate orders
      const orderStats = await migrateOrders(tableMap);
      expect(orderStats.total).toBe(4);
      expect(orderStats.updated).toBe(2);
      expect(orderStats.skipped).toBe(2);

      // Migrate bills
      const billStats = await migrateBills(tableMap);
      expect(billStats.total).toBe(3);
      expect(billStats.updated).toBe(2);
      expect(billStats.skipped).toBe(1);

      // Verify migration
      const verification = await verifyMigration();
      expect(verification.orders.valid).toBe(3);
      expect(verification.orders.invalid).toBe(0);
      expect(verification.bills.valid).toBe(3);
      expect(verification.bills.invalid).toBe(0);
    });

    it('should rollback on error scenario', async () => {
      // Create table
      const table = await Table.create({ number: 50, name: 'Table 50' });

      // Create order with tableNumber
      const order = await Order.create({
        orderNumber: 'ORD-200',
        tableNumber: 50
      });

      // Build table map
      const tableMap = await buildTableMap();

      // Verify initial state
      let currentOrder = await Order.findById(order._id).lean();
      expect(currentOrder.tableNumber).toBe(50);

      // Migrate
      await migrateOrders(tableMap);

      // Verify migration succeeded
      currentOrder = await Order.findById(order._id).lean();
      expect(currentOrder.table.toString()).toBe(table._id.toString());
      expect(currentOrder.tableNumber).toBeUndefined();
    });
  });
});
