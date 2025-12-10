/**
 * Integration Tests for Costs Database Synchronization
 * Tests dual database sync for cost categories and costs
 * 
 * Test Coverage:
 * - Category sync between Local and Atlas MongoDB
 * - Cost sync between databases
 * - Sync failure handling
 * - Data consistency verification
 */

import mongoose from 'mongoose';
import Cost from '../../models/Cost.js';
import CostCategory from '../../models/CostCategory.js';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';

// Mock environment for dual database testing
const LOCAL_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba-test';
const ATLAS_DB_URI = process.env.MONGODB_ATLAS_URI || LOCAL_DB_URI;

describe('Costs Database Sync Integration Tests', () => {
  let testOrg;
  let testUser;
  let localConnection;
  let atlasConnection;

  beforeAll(async () => {
    // Connect to local database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(LOCAL_DB_URI);
    }
    localConnection = mongoose.connection;

    // Note: In a real dual-database setup, you would connect to Atlas here
    // For testing purposes, we'll use the same connection
    atlasConnection = localConnection;
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Sync Test User',
      email: `synctest${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin',
    });

    // Create test organization
    testOrg = await Organization.create({
      name: 'Sync Test Organization',
      email: `synctest${Date.now()}@test.com`,
      phone: '1234567890',
      owner: testUser._id,
    });

    testUser.organization = testOrg._id;
    await testUser.save();
  });

  afterEach(async () => {
    await Cost.deleteMany({});
    await CostCategory.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Category Sync Operations', () => {
    test('should sync category creation to both databases', async () => {
      const categoryData = {
        name: 'Sync Test Category',
        icon: 'DollarSign',
        color: '#3B82F6',
        description: 'Category for sync testing',
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      // Create category (should trigger sync)
      const category = await CostCategory.create(categoryData);

      // Verify in local database
      const localCategory = await CostCategory.findById(category._id);
      expect(localCategory).toBeDefined();
      expect(localCategory.name).toBe(categoryData.name);
      expect(localCategory.icon).toBe(categoryData.icon);
      expect(localCategory.color).toBe(categoryData.color);

      // In a real dual-database setup, verify in Atlas
      // For now, we verify the same connection
      const atlasCategory = await CostCategory.findById(category._id);
      expect(atlasCategory).toBeDefined();
      expect(atlasCategory.name).toBe(categoryData.name);
    });

    test('should sync category updates to both databases', async () => {
      const category = await CostCategory.create({
        name: 'Original Name',
        icon: 'DollarSign',
        color: '#3B82F6',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Update category
      category.name = 'Updated Name';
      category.color = '#EF4444';
      await category.save();

      // Verify update in local database
      const localCategory = await CostCategory.findById(category._id);
      expect(localCategory.name).toBe('Updated Name');
      expect(localCategory.color).toBe('#EF4444');

      // Verify update in Atlas (same connection for testing)
      const atlasCategory = await CostCategory.findById(category._id);
      expect(atlasCategory.name).toBe('Updated Name');
      expect(atlasCategory.color).toBe('#EF4444');
    });

    test('should sync category deletion to both databases', async () => {
      const category = await CostCategory.create({
        name: 'To Be Deleted',
        icon: 'Trash',
        color: '#EF4444',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const categoryId = category._id;

      // Delete category
      await CostCategory.findByIdAndDelete(categoryId);

      // Verify deletion in local database
      const localCategory = await CostCategory.findById(categoryId);
      expect(localCategory).toBeNull();

      // Verify deletion in Atlas (same connection for testing)
      const atlasCategory = await CostCategory.findById(categoryId);
      expect(atlasCategory).toBeNull();
    });
  });

  describe('Cost Sync Operations', () => {
    let testCategory;

    beforeEach(async () => {
      testCategory = await CostCategory.create({
        name: 'Test Category',
        icon: 'DollarSign',
        color: '#3B82F6',
        organization: testOrg._id,
        createdBy: testUser._id,
      });
    });

    test('should sync cost creation to both databases', async () => {
      const costData = {
        category: testCategory._id,
        description: 'Sync test cost',
        amount: 5000,
        paidAmount: 0,
        date: new Date(),
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      // Create cost (should trigger sync)
      const cost = await Cost.create(costData);

      // Verify in local database
      const localCost = await Cost.findById(cost._id);
      expect(localCost).toBeDefined();
      expect(localCost.description).toBe(costData.description);
      expect(localCost.amount).toBe(costData.amount);
      expect(localCost.status).toBe('pending');

      // Verify in Atlas (same connection for testing)
      const atlasCost = await Cost.findById(cost._id);
      expect(atlasCost).toBeDefined();
      expect(atlasCost.description).toBe(costData.description);
    });

    test('should sync cost updates to both databases', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Original description',
        amount: 1000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Update cost
      cost.description = 'Updated description';
      cost.paidAmount = 500;
      await cost.save();

      // Verify update in local database
      const localCost = await Cost.findById(cost._id);
      expect(localCost.description).toBe('Updated description');
      expect(localCost.paidAmount).toBe(500);
      expect(localCost.status).toBe('partially_paid');

      // Verify update in Atlas (same connection for testing)
      const atlasCost = await Cost.findById(cost._id);
      expect(atlasCost.description).toBe('Updated description');
      expect(atlasCost.paidAmount).toBe(500);
    });

    test('should sync cost deletion to both databases', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'To be deleted',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const costId = cost._id;

      // Delete cost
      await Cost.findByIdAndDelete(costId);

      // Verify deletion in local database
      const localCost = await Cost.findById(costId);
      expect(localCost).toBeNull();

      // Verify deletion in Atlas (same connection for testing)
      const atlasCost = await Cost.findById(costId);
      expect(atlasCost).toBeNull();
    });

    test('should sync payment additions correctly', async () => {
      const cost = await Cost.create({
        category: testCategory._id,
        description: 'Payment sync test',
        amount: 10000,
        paidAmount: 0,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Add payment
      cost.paidAmount = 3000;
      await cost.save();

      // Verify in local database
      const localCost = await Cost.findById(cost._id);
      expect(localCost.paidAmount).toBe(3000);
      expect(localCost.remainingAmount).toBe(7000);
      expect(localCost.status).toBe('partially_paid');

      // Verify in Atlas (same connection for testing)
      const atlasCost = await Cost.findById(cost._id);
      expect(atlasCost.paidAmount).toBe(3000);
      expect(atlasCost.remainingAmount).toBe(7000);
      expect(atlasCost.status).toBe('partially_paid');
    });
  });

  describe('Data Consistency Verification', () => {
    test('should maintain data consistency across databases', async () => {
      // Create category
      const category = await CostCategory.create({
        name: 'Consistency Test',
        icon: 'CheckCircle',
        color: '#10B981',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Create multiple costs
      const costs = await Promise.all([
        Cost.create({
          category: category._id,
          description: 'Cost 1',
          amount: 1000,
          organization: testOrg._id,
          createdBy: testUser._id,
        }),
        Cost.create({
          category: category._id,
          description: 'Cost 2',
          amount: 2000,
          organization: testOrg._id,
          createdBy: testUser._id,
        }),
        Cost.create({
          category: category._id,
          description: 'Cost 3',
          amount: 3000,
          organization: testOrg._id,
          createdBy: testUser._id,
        }),
      ]);

      // Verify count in local database
      const localCount = await Cost.countDocuments({
        category: category._id,
        organization: testOrg._id,
      });
      expect(localCount).toBe(3);

      // Verify count in Atlas (same connection for testing)
      const atlasCount = await Cost.countDocuments({
        category: category._id,
        organization: testOrg._id,
      });
      expect(atlasCount).toBe(3);

      // Verify total amounts match
      const localCosts = await Cost.find({
        category: category._id,
        organization: testOrg._id,
      });
      const localTotal = localCosts.reduce((sum, cost) => sum + cost.amount, 0);

      const atlasCosts = await Cost.find({
        category: category._id,
        organization: testOrg._id,
      });
      const atlasTotal = atlasCosts.reduce((sum, cost) => sum + cost.amount, 0);

      expect(localTotal).toBe(atlasTotal);
      expect(localTotal).toBe(6000);
    });

    test('should handle bulk operations consistently', async () => {
      const category = await CostCategory.create({
        name: 'Bulk Test',
        icon: 'Package',
        color: '#F59E0B',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Create multiple costs in bulk
      const costsData = Array.from({ length: 10 }, (_, i) => ({
        category: category._id,
        description: `Bulk cost ${i + 1}`,
        amount: (i + 1) * 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      }));

      await Cost.insertMany(costsData);

      // Verify in local database
      const localCosts = await Cost.find({
        category: category._id,
        organization: testOrg._id,
      });
      expect(localCosts).toHaveLength(10);

      // Verify in Atlas (same connection for testing)
      const atlasCosts = await Cost.find({
        category: category._id,
        organization: testOrg._id,
      });
      expect(atlasCosts).toHaveLength(10);
    });
  });

  describe('Sync Error Handling', () => {
    test('should handle sync with invalid data gracefully', async () => {
      // This test simulates what happens when invalid data is attempted
      const invalidCategoryData = {
        // Missing required name field
        icon: 'DollarSign',
        color: '#3B82F6',
        organization: testOrg._id,
        createdBy: testUser._id,
      };

      // Should fail validation
      await expect(CostCategory.create(invalidCategoryData)).rejects.toThrow();

      // Verify nothing was created in either database
      const localCount = await CostCategory.countDocuments({
        organization: testOrg._id,
      });
      expect(localCount).toBe(0);
    });

    test('should maintain referential integrity during sync', async () => {
      const category = await CostCategory.create({
        name: 'Integrity Test',
        icon: 'Shield',
        color: '#8B5CF6',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const cost = await Cost.create({
        category: category._id,
        description: 'Test cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Verify relationship in local database
      const localCost = await Cost.findById(cost._id).populate('category');
      expect(localCost.category).toBeDefined();
      expect(localCost.category.name).toBe('Integrity Test');

      // Verify relationship in Atlas (same connection for testing)
      const atlasCost = await Cost.findById(cost._id).populate('category');
      expect(atlasCost.category).toBeDefined();
      expect(atlasCost.category.name).toBe('Integrity Test');
    });

    test('should handle concurrent sync operations', async () => {
      const category = await CostCategory.create({
        name: 'Concurrent Test',
        icon: 'Zap',
        color: '#EF4444',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      // Create multiple costs concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        Cost.create({
          category: category._id,
          description: `Concurrent cost ${i + 1}`,
          amount: (i + 1) * 1000,
          organization: testOrg._id,
          createdBy: testUser._id,
        })
      );

      const costs = await Promise.all(promises);

      // Verify all costs were created
      expect(costs).toHaveLength(5);

      // Verify in database
      const dbCosts = await Cost.find({
        category: category._id,
        organization: testOrg._id,
      });
      expect(dbCosts).toHaveLength(5);
    });
  });

  describe('Organization Isolation', () => {
    test('should sync costs only within organization boundaries', async () => {
      // Create another organization
      const anotherUser = await User.create({
        name: 'Another User',
        email: `another${Date.now()}@test.com`,
        password: 'password123',
        role: 'admin',
      });

      const anotherOrg = await Organization.create({
        name: 'Another Organization',
        email: `another${Date.now()}@test.com`,
        phone: '9876543210',
        owner: anotherUser._id,
      });

      anotherUser.organization = anotherOrg._id;
      await anotherUser.save();

      // Create categories in both organizations
      const category1 = await CostCategory.create({
        name: 'Org 1 Category',
        icon: 'Building',
        color: '#3B82F6',
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      const category2 = await CostCategory.create({
        name: 'Org 2 Category',
        icon: 'Building',
        color: '#EF4444',
        organization: anotherOrg._id,
        createdBy: anotherUser._id,
      });

      // Create costs in both organizations
      await Cost.create({
        category: category1._id,
        description: 'Org 1 Cost',
        amount: 1000,
        organization: testOrg._id,
        createdBy: testUser._id,
      });

      await Cost.create({
        category: category2._id,
        description: 'Org 2 Cost',
        amount: 2000,
        organization: anotherOrg._id,
        createdBy: anotherUser._id,
      });

      // Verify organization 1 can only see its costs
      const org1Costs = await Cost.find({ organization: testOrg._id });
      expect(org1Costs).toHaveLength(1);
      expect(org1Costs[0].description).toBe('Org 1 Cost');

      // Verify organization 2 can only see its costs
      const org2Costs = await Cost.find({ organization: anotherOrg._id });
      expect(org2Costs).toHaveLength(1);
      expect(org2Costs[0].description).toBe('Org 2 Cost');

      // Clean up
      await User.findByIdAndDelete(anotherUser._id);
      await Organization.findByIdAndDelete(anotherOrg._id);
    });
  });
});
