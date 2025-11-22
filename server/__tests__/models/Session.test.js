/**
 * Unit Tests for Session Model
 * Testing core calculation and update logic
 */

import mongoose from 'mongoose';
import Session from '../../models/Session.js';
import Device from '../../models/Device.js';

describe('Session Model - Core Logic Tests', () => {
  let mockDevice;
  let mockOrganizationId;
  let mockUserId;
  let mockDeviceId;

  beforeAll(() => {
    // Setup mock IDs
    mockOrganizationId = new mongoose.Types.ObjectId();
    mockUserId = new mongoose.Types.ObjectId();
    mockDeviceId = new mongoose.Types.ObjectId();

    // Setup mock device with PlayStation rates
    mockDevice = {
      _id: mockDeviceId,
      name: 'PS1',
      type: 'playstation',
      playstationRates: new Map([
        ['1', 20],
        ['2', 20],
        ['3', 25],
        ['4', 30],
      ]),
    };

    // Mock Device.findById to return our mock device
    Device.findById = () => Promise.resolve(mockDevice);
  });

  describe('calculateCost', () => {
    test('should calculate cost for 1 hour with 2 controllers', async () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'), // 1 hour
        status: 'completed',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: new Date('2024-01-01T11:00:00Z'),
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      await session.calculateCost();

      // 1 hour * 20 EGP/hour = 20 EGP
      expect(session.totalCost).toBe(20);
      expect(session.finalCost).toBe(20);
    });

    test('should calculate cost with multiple controller changes', async () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'), // 2 hours total
        status: 'completed',
        controllers: 4,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: new Date('2024-01-01T11:00:00Z'), // 1 hour at 20 EGP
          },
          {
            controllers: 4,
            from: new Date('2024-01-01T11:00:00Z'),
            to: new Date('2024-01-01T12:00:00Z'), // 1 hour at 30 EGP
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      await session.calculateCost();

      // (1 hour * 20 EGP) + (1 hour * 30 EGP) = 50 EGP
      expect(session.totalCost).toBe(50);
      expect(session.finalCost).toBe(50);
    });

    test('should apply discount correctly', async () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        status: 'completed',
        controllers: 2,
        discount: 5,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: new Date('2024-01-01T11:00:00Z'),
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      await session.calculateCost();

      // 1 hour * 20 EGP = 20 EGP, minus 5 EGP discount = 15 EGP
      expect(session.totalCost).toBe(20);
      expect(session.finalCost).toBe(15);
    });

    test('should calculate cost for 30 minutes', async () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:30:00Z'), // 30 minutes
        status: 'completed',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: new Date('2024-01-01T10:30:00Z'),
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      await session.calculateCost();

      // 0.5 hour * 20 EGP/hour = 10 EGP
      expect(session.totalCost).toBe(10);
    });
  });

  describe('updateControllers', () => {
    test('should update controllers and create new period', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'active',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: null,
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      session.updateControllers(4);

      expect(session.controllers).toBe(4);
      expect(session.controllersHistory).toHaveLength(2);
      expect(session.controllersHistory[0].to).not.toBeNull();
      expect(session.controllersHistory[1].controllers).toBe(4);
      expect(session.controllersHistory[1].to).toBeNull();
    });

    test('should throw error if session is not active', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'completed',
        controllers: 2,
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      expect(() => session.updateControllers(4)).toThrow(
        'لا يمكن تعديل عدد الدراعات في جلسة غير نشطة'
      );
    });

    test('should throw error for invalid controller count', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'active',
        controllers: 2,
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      expect(() => session.updateControllers(0)).toThrow(
        'عدد الدراعات يجب أن يكون بين 1 و 4'
      );
      expect(() => session.updateControllers(5)).toThrow(
        'عدد الدراعات يجب أن يكون بين 1 و 4'
      );
    });
  });

  describe('endSession', () => {
    test('should end active session and close all periods', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'active',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: new Date('2024-01-01T10:00:00Z'),
            to: null,
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      session.endSession();

      expect(session.status).toBe('completed');
      expect(session.endTime).not.toBeNull();
      expect(session.controllersHistory[0].to).toEqual(session.endTime);
    });

    test('should throw error if session is not active', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'completed',
        controllers: 2,
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      expect(() => session.endSession()).toThrow('الجلسة غير نشطة');
    });

    test('should create controllersHistory if missing', () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'active',
        controllers: 2,
        controllersHistory: [],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      session.endSession();

      expect(session.controllersHistory).toHaveLength(1);
      expect(session.controllersHistory[0].controllers).toBe(2);
      expect(session.controllersHistory[0].from).toEqual(session.startTime);
      expect(session.controllersHistory[0].to).toEqual(session.endTime);
    });
  });

  describe('calculateCurrentCost', () => {
    test('should calculate current cost for active session', async () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime,
        status: 'active',
        controllers: 2,
        controllersHistory: [
          {
            controllers: 2,
            from: startTime,
            to: null,
          },
        ],
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      const currentCost = await session.calculateCurrentCost();

      // Should be approximately 20 EGP for 1 hour (with some tolerance for timing)
      expect(currentCost).toBeGreaterThanOrEqual(19);
      expect(currentCost).toBeLessThanOrEqual(21);
    });

    test('should return totalCost for completed session', async () => {
      const session = new Session({
        deviceId: mockDeviceId,
        deviceNumber: '1',
        deviceName: 'PS1',
        deviceType: 'playstation',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        status: 'completed',
        controllers: 2,
        totalCost: 50,
        organization: mockOrganizationId,
        createdBy: mockUserId,
      });

      const currentCost = await session.calculateCurrentCost();

      expect(currentCost).toBe(50);
    });
  });
});
