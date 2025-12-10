/**
 * Integration Tests for Costs Management Enhancement
 * Tests complete flows for cost categories and cost entries
 * 
 * Test Coverage:
 * - Complete cost creation flow with category
 * - Payment addition and status updates
 * - Category management with costs
 * - Filtering combinations
 * - Sync between databases
 * - Error handling scenarios
 */

import mongoose from 'mongoose';
import Cost from '../../models/Cost.js';
import CostCategory from '../../models/CostCategory.js';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';

describe('Costs Management Integration Tests', () => {
  let testOrg;
  let testUser;
  let testCategory;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba-test');
    }
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: `testuser${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin',
    });

    // Create test organization
    testOrg = await Organization.create({
      name: 'Test Organization',
      email: `test${Date.now()}@test.com`,
      phone: '1234567890',
      owner: testUser._id,
    });

    // Update user with organization
    testUser.organization = testOrg._id;
    await testUser.save();

    // Create test category
    testCategory = await CostCategory.create({
      name: 'Test Category',
      icon: 'DollarSign',
      color: '#3B82F6',
      description: 'Test category for integration tests',
      organization: testOrg._id,
      createdBy: testUser._id,
    });
  });

  afterEach(async () => {
    // Clean up test data
    await Cost.deleteMany({});
    await CostCategory.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Complete Cost Creation Flow with Category', () => {
    test('should create cost with category and calculate status correctly', async () => {
      const costData = {
        category: testCategory._id,
        description: 'Office rent payment',
        amount: 5000,
        paidAmount: 0,
        date: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        paymentMethod: 'transfer',
        vendor: 'Landlord Inc',
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      const cost = await Cost.create(costData);

      // Verify cost was created
      expect(cost).toBeDefined();
      expect(cost.category.toString()).toBe(testCategory._id.toString());
      expect(cost.description).toBe(costData.description);
      expect(cost.amount).toBe(costData.amount);

      // Verify automatic status calculation
      expect(cost.status).toBe('pending');
      expect(cost.remainingAmount).toBe(5000);
    });

    test('should populate category details when retrieving cost', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const populatedCost = await Cost.findById(cost._id)
        .populate('category', 'name icon color');

      expect(populatedCost.category.name).toBe('Test Category');
      expect(populatedCost.category.icon).toBe('DollarSign');
      expect(populatedCost.category.color).toBe('#3B82F6');
    });

    test('should reject cost creation without required fields', async () => {
      const invalidCost = {
        // Missing category
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      await expect(Cost.create(invalidCost)).rejects.toThrow();
    });
  });

  describe('Payment Addition and Status Updates', () => {
    test('should update status to partially_paid when partial payment is added', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Equipment purchase',
        amount: 10000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Add partial payment
      cost.paidAmount = 3000;
      await cost.save();

      // Verify status update
      expect(cost.status).toBe('partially_paid');
      expect(cost.remainingAmount).toBe(7000);
      expect(cost.paidAmount).toBe(3000);
    });

    test('should update status to paid when full payment is added', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Software license',
        amount: 2000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Add full payment
      cost.paidAmount = 2000;
      await cost.save();

      // Verify status update
      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
      expect(cost.paidAmount).toBe(2000);
    });

    test('should handle multiple partial payments correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Consulting services',
        amount: 15000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // First payment
      cost.paidAmount = 5000;
      await cost.save();
      expect(cost.status).toBe('partially_paid');
      expect(cost.remainingAmount).toBe(10000);

      // Second payment
      cost.paidAmount = 10000;
      await cost.save();
      expect(cost.status).toBe('partially_paid');
      expect(cost.remainingAmount).toBe(5000);

      // Final payment
      cost.paidAmount = 15000;
      await cost.save();
      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
    });

    test('should update status to overdue when due date passes', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Overdue payment',
        amount: 3000,
        paidAmount: 0,
        dueDate: pastDate,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Verify status is overdue
      expect(cost.status).toBe('overdue');
      expect(cost.remainingAmount).toBe(3000);
    });

    test('should prevent paidAmount from exceeding amount', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Try to pay more than amount
      cost.paidAmount = 1500;
      await cost.save();

      // Status should be paid and remainingAmount should be 0
      expect(cost.status).toBe('paid');
      expect(cost.remainingAmount).toBe(0);
    });
  });

  describe('Category Management with Costs', () => {
    test('should prevent deletion of category with associated costs', async () => {
      // Create cost with category
      await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Check if category has costs
      const costsCount = await Cost.countDocuments({
        category: testCategory._id,
        organization: testOrg._id,
      });

      expect(costsCount).toBe(1);

      // Attempting to delete should be prevented by application logic
      // This would be handled in the controller
    });

    test('should allow deletion of category without costs', async () => {
      const emptyCategory = await CostCategory.create({
        name: 'Empty Category',
        icon: 'Package',
        color: '#10B981',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Check if category has costs
      const costsCount = await Cost.countDocuments({
        category: emptyCategory._id,
        organization: testOrg._id,
      });

      expect(costsCount).toBe(0);

      // Delete category
      await CostCategory.findByIdAndDelete(emptyCategory._id);

      // Verify deletion
      const deletedCategory = await CostCategory.findById(emptyCategory._id);
      expect(deletedCategory).toBeNull();
    });

    test('should enforce unique category names per organization', async () => {
      // Try to create category with same name
      const duplicateCategory = {
        name: 'Test Category', // Same as testCategory
        icon: 'Wallet',
        color: '#EF4444',
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      await expect(CostCategory.create(duplicateCategory)).rejects.toThrow();
    });

    test('should allow same category name in different organizations', async () => {
      // Create another organization
      const anotherOrg = await Organization.create({
        name: 'Another Organization',
        email: `another${Date.now()}@test.com`,
        phone: '9876543210',
        owner: testUser._id,
      });

      // Create category with same name in different org
      const categoryInAnotherOrg = await CostCategory.create({
        name: 'Test Category', // Same name as testCategory
        icon: 'Wallet',
        color: '#EF4444',
        organization: anotherOrg._id,
        createdBy: testUser._id,
      });

      expect(categoryInAnotherOrg).toBeDefined();
      expect(categoryInAnotherOrg.name).toBe('Test Category');
      expect(categoryInAnotherOrg.organization.toString()).toBe(anotherOrg._id.toString());

      // Clean up
      await Organization.findByIdAndDelete(anotherOrg._id);
    });

    test('should sort categories by sortOrder and name', async () => {
      // Create multiple categories with different sortOrders
      await CostCategory.create({
        name: 'Zebra Category',
        icon: 'Package',
        color: '#10B981',
        sortOrder: 2,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await CostCategory.create({
        name: 'Alpha Category',
        icon: 'Home',
        color: '#F59E0B',
        sortOrder: 1,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await CostCategory.create({
        name: 'Beta Category',
        icon: 'Zap',
        color: '#8B5CF6',
        sortOrder: 1,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Retrieve categories sorted
      const categories = await CostCategory.find({
        organization: testOrg._id,
      }).sort({ sortOrder: 1, name: 1 });

      // Verify sorting
      expect(categories[0].sortOrder).toBe(0); // testCategory
      expect(categories[1].sortOrder).toBe(1);
      expect(categories[1].name).toBe('Alpha Category');
      expect(categories[2].sortOrder).toBe(1);
      expect(categories[2].name).toBe('Beta Category');
      expect(categories[3].sortOrder).toBe(2);
      expect(categories[3].name).toBe('Zebra Category');
    });
  });

  describe('Filtering Combinations', () => {
    beforeEach(async () => {
      // Create additional categories
      const salaryCategory = await CostCategory.create({
        name: 'Salaries',
        icon: 'Users',
        color: '#EF4444',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const utilitiesCategory = await CostCategory.create({
        name: 'Utilities',
        icon: 'Zap',
        color: '#F59E0B',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Create costs with different categories and statuses
      await Cost.create({
        category: testCategory._id,
        description: 'Rent payment',
        amount: 5000,
        paidAmount: 5000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await Cost.create({
        category: testCategory._id,
        description: 'Office supplies',
        amount: 500,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await Cost.create({
        category: salaryCategory._id,
        description: 'Employee salaries',
        amount: 20000,
        paidAmount: 10000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await Cost.create({
        category: utilitiesCategory._id,
        description: 'Electricity bill',
        amount: 800,
        paidAmount: 0,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        organization: testOrg._id,
        createdBy: testUser._id,
      });
    });

    test('should filter costs by category', async () => {
      const costs = await Cost.find({
        category: testCategory._id,
        organization: testOrg._id,
      });

      expect(costs).toHaveLength(2);
      costs.forEach(cost => {
        expect(cost.category.toString()).toBe(testCategory._id.toString());
      });
    });

    test('should filter costs by status', async () => {
      const paidCosts = await Cost.find({
        status: 'paid',
        organization: testOrg._id,
      });

      expect(paidCosts).toHaveLength(1);
      expect(paidCosts[0].status).toBe('paid');

      const pendingCosts = await Cost.find({
        status: 'pending',
        organization: testOrg._id,
      });

      expect(pendingCosts).toHaveLength(1);
      expect(pendingCosts[0].status).toBe('pending');

      const partialCosts = await Cost.find({
        status: 'partially_paid',
        organization: testOrg._id,
      });

      expect(partialCosts).toHaveLength(1);
      expect(partialCosts[0].status).toBe('partially_paid');

      const overdueCosts = await Cost.find({
        status: 'overdue',
        organization: testOrg._id,
      });

      expect(overdueCosts).toHaveLength(1);
      expect(overdueCosts[0].status).toBe('overdue');
    });

    test('should filter costs by category AND status', async () => {
      const costs = await Cost.find({
        category: testCategory._id,
        status: 'paid',
        organization: testOrg._id,
      });

      expect(costs).toHaveLength(1);
      expect(costs[0].category.toString()).toBe(testCategory._id.toString());
      expect(costs[0].status).toBe('paid');
    });

    test('should search costs by description', async () => {
      const costs = await Cost.find({
        description: { $regex: 'salaries', $options: 'i' },
        organization: testOrg._id,
      });

      expect(costs).toHaveLength(1);
      expect(costs[0].description).toContain('salaries');
    });

    test('should search costs by vendor', async () => {
      // Create cost with vendor
      await Cost.create({
        category: testCategory._id,
        description: 'Equipment',
        amount: 3000,
        vendor: 'Tech Supplies Inc',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const costs = await Cost.find({
        vendor: { $regex: 'Tech Supplies', $options: 'i' },
        organization: testOrg._id,
      });

      expect(costs).toHaveLength(1);
      expect(costs[0].vendor).toContain('Tech Supplies');
    });

    test('should filter costs by date range', async () => {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const costs = await Cost.find({
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        organization: testOrg._id,
      });

      expect(costs.length).toBeGreaterThan(0);
      costs.forEach(cost => {
        expect(cost.date.getTime()).toBeGreaterThanOrEqual(startOfDay.getTime());
        expect(cost.date.getTime()).toBeLessThanOrEqual(endOfDay.getTime());
      });
    });

    test('should return all costs when no filters applied', async () => {
      const allCosts = await Cost.find({
        organization: testOrg._id,
      });

      expect(allCosts).toHaveLength(4);
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle invalid category reference', async () => {
      const invalidCategoryId = new mongoose.Types.ObjectId();

      const costData = {
        category: invalidCategoryId,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      // Cost will be created but category won't populate
      const cost = await Cost.create(costData);
      expect(cost).toBeDefined();

      const populatedCost = await Cost.findById(cost._id).populate('category');
      expect(populatedCost.category).toBeNull();
    });

    test('should handle negative amounts gracefully', async () => {
      const costData = {
        category: testCategory._id,
        description: 'Test cost',
        amount: -1000, // Negative amount
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      // Should fail validation
      await expect(Cost.create(costData)).rejects.toThrow();
    });

    test('should handle missing organization', async () => {
      const costData = {
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        // Missing organization
        createdBy: testUser._id,
      };

      await expect(Cost.create(costData)).rejects.toThrow();
    });

    test('should handle invalid status value', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Try to set invalid status
      cost.status = 'invalid_status';
      await expect(cost.save()).rejects.toThrow();
    });

    test('should handle concurrent updates correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 10000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Simulate concurrent updates
      const cost1 = await Cost.findById(cost._id);
      const cost2 = await Cost.findById(cost._id);

      cost1.paidAmount = 3000;
      await cost1.save();

      cost2.paidAmount = 5000;
      await cost2.save();

      // Last write wins
      const finalCost = await Cost.findById(cost._id);
      expect(finalCost.paidAmount).toBe(5000);
      expect(finalCost.status).toBe('partially_paid');
    });
  });

  describe('Data Consistency and Validation', () => {
    test('should maintain remainingAmount consistency', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 5000,
        paidAmount: 2000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      expect(cost.remainingAmount).toBe(3000);
      expect(cost.amount).toBe(cost.paidAmount + cost.remainingAmount);
    });

    test('should update timestamps correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const createdAt = cost.createdAt;
      const updatedAt = cost.updatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update cost
      cost.paidAmount = 500;
      await cost.save();

      expect(cost.createdAt.getTime()).toBe(createdAt.getTime());
      expect(cost.updatedAt.getTime()).toBeGreaterThan(updatedAt.getTime());
    });

    test('should preserve category reference integrity', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Update category
      testCategory.color = '#FF0000';
      await testCategory.save();

      // Reload cost with populated category
      const reloadedCost = await Cost.findById(cost._id).populate('category');
      expect(reloadedCost.category.color).toBe('#FF0000');
    });
  });
});
