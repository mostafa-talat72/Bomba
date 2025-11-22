/**
 * Integration Tests for Session Controller
 * Testing API endpoints for PlayStation session management
 */

import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import Session from '../../models/Session.js';
import Device from '../../models/Device.js';
import Bill from '../../models/Bill.js';
import User from '../../models/User.js';
import sessionRoutes from '../../routes/sessionRoutes.js';

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    organization: new mongoose.Types.ObjectId(),
    permissions: ['playstation', 'computer', 'all'],
  };
  next();
});

app.use('/api/sessions', sessionRoutes);

describe('Session Controller Integration Tests', () => {
  let testOrganizationId;
  let testUserId;
  let testDevice;
  let testBill;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/bomba-test';
    
    // Skip if already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });
    }
  }, 15000);

  afterAll(async () => {
    // Cleanup and disconnect
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }, 15000);

  beforeEach(async () => {
    // Setup test data
    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();

    // Create test device
    testDevice = await Device.create({
      name: 'PS1',
      number: 1,
      type: 'playstation',
      status: 'available',
      controllers: 4,
      playstationRates: new Map([
        ['1', 20],
        ['2', 20],
        ['3', 25],
        ['4', 30],
      ]),
      organization: testOrganizationId,
    });

    // Update mock user to use test IDs
    app.use((req, res, next) => {
      req.user = {
        _id: testUserId,
        organization: testOrganizationId,
        permissions: ['playstation', 'computer', 'all'],
      };
      next();
    });
  }, 10000);

  afterEach(async () => {
    // Clean up test data
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Bill.deleteMany({});
  }, 10000);

  describe('POST /api/sessions - Create Session', () => {
    test('should create a new session with automatic bill creation', async () => {
      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم بدء الجلسة');
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.deviceNumber).toBe('1');
      expect(response.body.data.session.controllers).toBe(2);
      expect(response.body.data.session.status).toBe('active');
      expect(response.body.data.bill).toBeDefined();
      expect(response.body.data.bill.billType).toBe('playstation');

      // Verify session was created in database
      const session = await Session.findById(response.body.data.session._id);
      expect(session).toBeDefined();
      expect(session.controllersHistory).toHaveLength(1);
      expect(session.controllersHistory[0].controllers).toBe(2);
      expect(session.controllersHistory[0].to).toBeNull();

      // Verify bill was created and linked
      const bill = await Bill.findById(response.body.data.bill.id);
      expect(bill).toBeDefined();
      expect(bill.sessions).toContainEqual(session._id);
    });

    test('should reject session creation if device is already in use', async () => {
      // Create an active session first
      await Session.create({
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceId: testDevice._id,
        deviceType: 'playstation',
        status: 'active',
        controllers: 2,
        organization: testOrganizationId,
        createdBy: testUserId,
      });

      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('الجهاز مستخدم حالياً');
    });

    test('should reject session creation with missing required fields', async () => {
      const sessionData = {
        deviceNumber: '1',
        // Missing deviceName, deviceType, deviceId
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('مطلوب');
    });
  });

  describe('PUT /api/sessions/:sessionId/controllers - Update Controllers', () => {
    let activeSession;

    beforeEach(async () => {
      // Create an active session
      activeSession = await Session.create({
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceId: testDevice._id,
        deviceType: 'playstation',
        status: 'active',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date(),
            to: null,
          },
        ],
        organization: testOrganizationId,
        createdBy: testUserId,
      });
    });

    test('should update controllers count successfully', async () => {
      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/controllers`)
        .send({ controllers: 4 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم تحديث عدد الدراعات');
      expect(response.body.data.controllers).toBe(4);
      expect(response.body.data.controllersHistory).toHaveLength(2);

      // Verify first period was closed
      expect(response.body.data.controllersHistory[0].to).not.toBeNull();
      
      // Verify new period was created
      expect(response.body.data.controllersHistory[1].controllers).toBe(4);
      expect(response.body.data.controllersHistory[1].to).toBeNull();

      // Verify in database
      const updatedSession = await Session.findById(activeSession._id);
      expect(updatedSession.controllers).toBe(4);
      expect(updatedSession.controllersHistory).toHaveLength(2);
    });

    test('should reject invalid controller count', async () => {
      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/controllers`)
        .send({ controllers: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('عدد الدراعات يجب أن يكون بين 1 و 4');
    });

    test('should reject update for non-active session', async () => {
      // End the session
      activeSession.status = 'completed';
      await activeSession.save();

      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/controllers`)
        .send({ controllers: 3 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('لا يمكن تعديل عدد الدراعات في جلسة غير نشطة');
    });

    test('should reject update for non-existent session', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/sessions/${fakeId}/controllers`)
        .send({ controllers: 3 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('الجلسة غير موجودة');
    });
  });

  describe('PUT /api/sessions/:id/end - End Session', () => {
    let activeSession;
    let linkedBill;

    beforeEach(async () => {
      // Create a bill
      linkedBill = await Bill.create({
        billNumber: 'B-001',
        customerName: 'عميل (PS1)',
        tableNumber: 'PS1',
        subtotal: 0,
        total: 0,
        discount: 0,
        tax: 0,
        status: 'draft',
        billType: 'playstation',
        sessions: [],
        organization: testOrganizationId,
        createdBy: testUserId,
      });

      // Create an active session with bill
      activeSession = await Session.create({
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceId: testDevice._id,
        deviceType: 'playstation',
        status: 'active',
        controllers: 2,
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        controllersHistory: [
          {
            controllers: 2,
            from: new Date(Date.now() - 60 * 60 * 1000),
            to: null,
          },
        ],
        bill: linkedBill._id,
        organization: testOrganizationId,
        createdBy: testUserId,
      });

      // Link session to bill
      linkedBill.sessions.push(activeSession._id);
      await linkedBill.save();
    });

    test('should end session and update bill successfully', async () => {
      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/end`)
        .send({ customerName: 'أحمد' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم إنهاء الجلسة');
      expect(response.body.data.session.status).toBe('completed');
      expect(response.body.data.session.endTime).toBeDefined();
      expect(response.body.data.session.customerName).toBe('أحمد');

      // Verify all controller periods are closed
      expect(response.body.data.session.controllersHistory[0].to).not.toBeNull();

      // Verify session in database
      const endedSession = await Session.findById(activeSession._id);
      expect(endedSession.status).toBe('completed');
      expect(endedSession.endTime).toBeDefined();
      expect(endedSession.totalCost).toBeGreaterThan(0);

      // Verify bill was updated
      const updatedBill = await Bill.findById(linkedBill._id);
      expect(updatedBill.status).toBe('partial');
      expect(updatedBill.total).toBeGreaterThan(0);
    });

    test('should end session without customer name', async () => {
      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/end`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.status).toBe('completed');
    });

    test('should reject ending non-active session', async () => {
      // End the session first
      activeSession.status = 'completed';
      await activeSession.save();

      const response = await request(app)
        .put(`/api/sessions/${activeSession._id}/end`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('الجلسة غير نشطة');
    });

    test('should reject ending non-existent session', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/sessions/${fakeId}/end`)
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('الجلسة غير موجودة');
    });
  });

  describe('POST /api/sessions/with-existing-bill - Link Session to Table', () => {
    let existingBill;

    beforeEach(async () => {
      // Create an existing bill (table bill)
      existingBill = await Bill.create({
        billNumber: 'B-002',
        customerName: 'عميل طاولة 5',
        tableNumber: 5,
        subtotal: 50,
        total: 50,
        discount: 0,
        tax: 0,
        status: 'draft',
        billType: 'cafe',
        orders: [],
        sessions: [],
        organization: testOrganizationId,
        createdBy: testUserId,
      });
    });

    test('should create session and link to existing bill', async () => {
      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
        billId: existingBill._id.toString(),
        tableNumber: 5,
      };

      const response = await request(app)
        .post('/api/sessions/with-existing-bill')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم بدء الجلسة وربطها بالفاتورة');
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.bill).toBeDefined();

      // Verify session was linked to bill
      const updatedBill = await Bill.findById(existingBill._id);
      expect(updatedBill.sessions).toHaveLength(1);
      expect(updatedBill.sessions[0].toString()).toBe(response.body.data.session._id);
    });

    test('should reject linking to non-existent bill', async () => {
      const fakeBillId = new mongoose.Types.ObjectId();
      
      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
        billId: fakeBillId.toString(),
      };

      const response = await request(app)
        .post('/api/sessions/with-existing-bill')
        .send(sessionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('الفاتورة غير موجودة');
    });

    test('should reject linking to paid bill', async () => {
      // Mark bill as paid
      existingBill.status = 'paid';
      await existingBill.save();

      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
        billId: existingBill._id.toString(),
      };

      const response = await request(app)
        .post('/api/sessions/with-existing-bill')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('لا يمكن ربط جلسة بفاتورة مدفوعة');
    });

    test('should reject linking to bill with active session', async () => {
      // Create an active session linked to the bill
      const activeSession = await Session.create({
        deviceNumber: '2',
        deviceName: 'PS2',
        deviceId: new mongoose.Types.ObjectId(),
        deviceType: 'playstation',
        status: 'active',
        controllers: 2,
        organization: testOrganizationId,
        createdBy: testUserId,
      });

      existingBill.sessions.push(activeSession._id);
      await existingBill.save();

      const sessionData = {
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        deviceId: testDevice._id.toString(),
        controllers: 2,
        billId: existingBill._id.toString(),
      };

      const response = await request(app)
        .post('/api/sessions/with-existing-bill')
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('لا يمكن ربط جلسة بفاتورة بها جلسة نشطة');
    });
  });

  describe('Integration Flow - Complete Session Lifecycle', () => {
    test('should handle complete session lifecycle with controller changes', async () => {
      // Step 1: Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({
          deviceNumber: '1',
          deviceName: 'PS1',
          deviceType: 'playstation',
          deviceId: testDevice._id.toString(),
          controllers: 2,
        })
        .expect(201);

      const sessionId = createResponse.body.data.session._id;
      const billId = createResponse.body.data.bill.id;

      expect(createResponse.body.data.session.controllers).toBe(2);

      // Step 2: Update controllers to 4
      const updateResponse = await request(app)
        .put(`/api/sessions/${sessionId}/controllers`)
        .send({ controllers: 4 })
        .expect(200);

      expect(updateResponse.body.data.controllers).toBe(4);
      expect(updateResponse.body.data.controllersHistory).toHaveLength(2);

      // Step 3: Update controllers to 3
      const updateResponse2 = await request(app)
        .put(`/api/sessions/${sessionId}/controllers`)
        .send({ controllers: 3 })
        .expect(200);

      expect(updateResponse2.body.data.controllers).toBe(3);
      expect(updateResponse2.body.data.controllersHistory).toHaveLength(3);

      // Step 4: End session
      const endResponse = await request(app)
        .put(`/api/sessions/${sessionId}/end`)
        .send({ customerName: 'محمد' })
        .expect(200);

      expect(endResponse.body.data.session.status).toBe('completed');
      expect(endResponse.body.data.session.customerName).toBe('محمد');
      expect(endResponse.body.data.session.totalCost).toBeGreaterThan(0);

      // Verify final state in database
      const finalSession = await Session.findById(sessionId);
      expect(finalSession.status).toBe('completed');
      expect(finalSession.controllersHistory).toHaveLength(3);
      expect(finalSession.controllersHistory.every(period => period.to !== null)).toBe(true);

      // Verify bill was updated
      const finalBill = await Bill.findById(billId);
      expect(finalBill.status).toBe('partial');
      expect(finalBill.total).toBeGreaterThan(0);
    });
  });
});
