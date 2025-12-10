import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Cost from '../../models/Cost.js';
import CostCategory from '../../models/CostCategory.js';

let mongoServer;
let testCategory;
let testOrg;
let testUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test organization and user
  testOrg = new mongoose.Types.ObjectId();
  testUser = new mongoose.Types.ObjectId();

  // Create test category
  testCategory = await CostCategory.create({
    name: 'Test Category',
    icon: 'DollarSign',
    color: '#3B82F6',
    organization: testOrg,
    createdBy: testUser
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Cost.deleteMany({});
});

describe('Cost Model - Automatic Status Calculation', () => {
  describe('Remaining Amount Calculation', () => {
    it('should calculate remainingAmount correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 300,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.remainingAmount).toBe(700);
    });

    it('should ensure remainingAmount is never negative', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 1200, // More than amount
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.remainingAmount).toBe(0);
      expect(cost.paidAmount).toBe(1000); // Should be capped at amount
    });
  });

  describe('Payment-Based Status Calculation', () => {
    it('should set status to "paid" when paidAmount equals amount', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 1000,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
    });

    it('should set status to "paid" when paidAmount exceeds amount', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 1200,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
    });

    it('should set status to "partially_paid" when 0 < paidAmount < amount', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 500,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('partially_paid');
      expect(cost.remainingAmount).toBe(500);
    });

    it('should set status to "pending" when paidAmount is 0 and no dueDate', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('pending');
      expect(cost.remainingAmount).toBe(1000);
    });
  });

  describe('Date-Based Status Calculation', () => {
    it('should set status to "overdue" when paidAmount is 0 and dueDate is past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        dueDate: pastDate,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('overdue');
    });

    it('should set status to "pending" when paidAmount is 0 and dueDate is future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        dueDate: futureDate,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('pending');
    });

    it('should not set status to "overdue" when partially paid even if past due', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 100,
        dueDate: pastDate,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('partially_paid');
    });
  });

  describe('addPayment Method', () => {
    it('should add payment and update status correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg,
        createdBy: testUser
      });

      await cost.addPayment(300, 'cash');

      expect(cost.paidAmount).toBe(300);
      expect(cost.remainingAmount).toBe(700);
      expect(cost.status).toBe('partially_paid');
      expect(cost.paymentMethod).toBe('cash');
    });

    it('should update status to "paid" when payment completes the cost', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 700,
        organization: testOrg,
        createdBy: testUser
      });

      await cost.addPayment(300, 'card');

      expect(cost.paidAmount).toBe(1000);
      expect(cost.remainingAmount).toBe(0);
      expect(cost.status).toBe('paid');
    });

    it('should throw error when payment amount is zero or negative', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg,
        createdBy: testUser
      });

      try {
        await cost.addPayment(0);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Payment amount must be greater than zero');
      }

      try {
        await cost.addPayment(-100);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Payment amount must be greater than zero');
      }
    });

    it('should throw error when payment exceeds remaining amount', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 700,
        organization: testOrg,
        createdBy: testUser
      });

      try {
        await cost.addPayment(400);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Payment amount cannot exceed remaining amount');
      }
    });
  });

  describe('Status Updates on Save', () => {
    it('should recalculate status when paidAmount is updated', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('pending');

      cost.paidAmount = 500;
      await cost.save();

      expect(cost.status).toBe('partially_paid');
      expect(cost.remainingAmount).toBe(500);
    });

    it('should recalculate status when amount is updated', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 500,
        organization: testOrg,
        createdBy: testUser
      });

      expect(cost.status).toBe('partially_paid');

      cost.amount = 500;
      await cost.save();

      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
    });
  });
});
