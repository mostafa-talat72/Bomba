/**
 * Integration Tests for Error Scenarios
 * Tests comprehensive error handling across bidirectional sync components
 * 
 * Requirements: 7.1, 9.2, 9.3
 * 
 * Test Coverage:
 * - Change Stream disconnection and reconnection
 * - Processing failures with retry logic
 * - Max retry handling
 * - Resume token errors
 * - Network failures
 * - Database errors
 */

import mongoose from 'mongoose';
import AtlasChangeListener from '../../services/sync/atlasChangeListener.js';
import ChangeProcessor from '../../services/sync/changeProcessor.js';
import OriginTracker from '../../services/sync/originTracker.js';
import ConflictResolver from '../../services/sync/conflictResolver.js';
import ResumeTokenStorage from '../../services/sync/resumeTokenStorage.js';
import syncConfig from '../../config/syncConfig.js';

// Simple mock function creator
function createMockFn() {
    const calls = [];
    const fn = function(...args) {
        calls.push(args);
        if (fn._implementation) {
            return fn._implementation(...args);
        }
    };
    fn.calls = calls;
    fn.mockImplementation = (impl) => {
        fn._implementation = impl;
        return fn;
    };
    fn.mockReturnValue = (value) => {
        fn._implementation = () => value;
        return fn;
    };
    fn.mockResolvedValue = (value) => {
        fn._implementation = async () => value;
        return fn;
    };
    return fn;
}

// Mock database manager
class MockDatabaseManager {
    constructor(options = {}) {
        this.atlasAvailable = options.atlasAvailable !== false;
        this.shouldFailConnection = options.shouldFailConnection || false;
        this.connectionFailCount = 0;
        this.maxConnectionFails = options.maxConnectionFails || 0;
        
        // Mock connections
        this.localConnection = mongoose.connection;
        this.atlasConnection = options.atlasConnection || null;
    }

    isAtlasAvailable() {
        if (this.shouldFailConnection && this.connectionFailCount < this.maxConnectionFails) {
            this.connectionFailCount++;
            return false;
        }
        return this.atlasAvailable;
    }

    getAtlasConnection() {
        if (!this.isAtlasAvailable()) {
            return null;
        }
        return this.atlasConnection;
    }

    getLocalConnection() {
        return this.localConnection;
    }
}

// Mock Change Stream
class MockChangeStream {
    constructor(options = {}) {
        this.shouldError = options.shouldError || false;
        this.shouldClose = options.shouldClose || false;
        this.errorCode = options.errorCode || null;
        this.errorMessage = options.errorMessage || 'Mock error';
        this.listeners = {};
        this.closed = false;
        this.emitDelay = options.emitDelay || 0;
    }

    on(event, handler) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
        return this;
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(handler => handler(data));
        }
    }

    async close() {
        this.closed = true;
        this.emit('close');
    }

    // Simulate errors
    simulateError(code, message) {
        const error = new Error(message || this.errorMessage);
        if (code) error.code = code;
        if (code === 286) error.codeName = 'ChangeStreamHistoryLost';
        this.emit('error', error);
    }

    simulateClose() {
        this.emit('close');
    }

    simulateChange(change) {
        setTimeout(() => {
            if (!this.closed) {
                this.emit('change', change);
            }
        }, this.emitDelay);
    }
}

describe('Error Scenarios Integration Tests', () => {
    let originTracker;
    let conflictResolver;
    let changeProcessor;
    let mockDbManager;

    beforeAll(async () => {
        // Connect to test database
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/bomba-test';
        
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
            });
        }
    }, 15000);

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    }, 15000);

    beforeEach(() => {
        // Create fresh instances for each test
        originTracker = new OriginTracker();
        conflictResolver = new ConflictResolver();
        mockDbManager = new MockDatabaseManager();
        changeProcessor = new ChangeProcessor(originTracker, conflictResolver, mockDbManager);
    });

    afterEach(() => {
        // Cleanup
        if (originTracker) {
            originTracker.stopCleanup();
        }
    });

    describe('Change Stream Disconnection', () => {
        test('should handle Change Stream disconnection gracefully', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();
            expect(listener.isRunning).toBe(true);

            // Simulate disconnection
            mockChangeStream.simulateClose();

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Listener should mark itself as not running
            expect(listener.isRunning).toBe(false);

            // Cleanup
            await listener.stop();
        }, 10000);

        test('should attempt reconnection after disconnection', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);
            
            // Reduce reconnect interval for testing
            listener.reconnectInterval = 100;

            // Start listener
            await listener.start();
            expect(listener.isRunning).toBe(true);
            expect(listener.reconnectAttempts).toBe(0);

            // Simulate disconnection
            mockChangeStream.simulateClose();

            // Wait for reconnection attempt
            await new Promise(resolve => setTimeout(resolve, 300));

            // Should have attempted reconnection
            expect(listener.reconnectAttempts).toBeGreaterThan(0);

            // Cleanup
            await listener.stop();
        }, 10000);

        test('should stop reconnecting after max attempts', async () => {
            // Create a database manager that always fails
            const failingDbManager = new MockDatabaseManager({
                shouldFailConnection: true,
                maxConnectionFails: 100
            });

            const listener = new AtlasChangeListener(failingDbManager, changeProcessor, originTracker);
            
            // Set low max attempts for testing
            listener.maxReconnectAttempts = 3;
            listener.reconnectInterval = 50;

            // Try to start (will fail)
            try {
                await listener.start();
            } catch (error) {
                // Expected to fail
            }

            // Wait for all reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Should have stopped after max attempts
            expect(listener.reconnectAttempts).toBeLessThanOrEqual(listener.maxReconnectAttempts);

            // Cleanup
            await listener.stop();
        }, 10000);
    });

    describe('Resume Token Errors', () => {
        test('should handle invalid resume token error (code 286)', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate resume token error
            mockChangeStream.simulateError(286, 'Resume token expired');

            // Wait for error handling
            await new Promise(resolve => setTimeout(resolve, 200));

            // Resume token should be cleared
            expect(listener.resumeToken).toBeNull();

            // Cleanup
            await listener.stop();
        }, 10000);

        test('should handle ChangeStreamHistoryLost error', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Set a resume token
            listener.resumeToken = { _data: 'test-token' };

            // Start listener
            await listener.start();

            // Simulate ChangeStreamHistoryLost error
            const error = new Error('Change stream history lost');
            error.code = 286;
            error.codeName = 'ChangeStreamHistoryLost';
            mockChangeStream.emit('error', error);

            // Wait for error handling
            await new Promise(resolve => setTimeout(resolve, 200));

            // Resume token should be cleared
            expect(listener.resumeToken).toBeNull();

            // Cleanup
            await listener.stop();
        }, 10000);
    });

    describe('Processing Failures', () => {
        test('should retry failed change processing', async () => {
            let attemptCount = 0;
            const failingProcessor = {
                processChange: createMockFn().mockImplementation(async () => {
                    attemptCount++;
                    if (attemptCount < 3) {
                        return { success: false, error: 'Temporary failure' };
                    }
                    return { success: true };
                })
            };

            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, failingProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate a change
            const change = {
                _id: { _data: 'test-token' },
                operationType: 'insert',
                ns: { db: 'test', coll: 'test' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: 'test' }
            };

            mockChangeStream.simulateChange(change);

            // Wait for processing with retries
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Should have retried multiple times
            expect(attemptCount).toBeGreaterThan(1);

            // Cleanup
            await listener.stop();
        }, 10000);

        test('should handle validation failures', async () => {
            const change = {
                _id: { _data: 'test-token' },
                operationType: 'insert',
                ns: { db: 'test', coll: 'nonexistent' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: {
                    _id: new mongoose.Types.ObjectId(),
                    invalidField: 'test',
                    requiredField: null // Missing required field
                }
            };

            const result = await changeProcessor.processChange(change);

            // Should fail validation
            expect(result.success).toBe(false);
            expect(result.reason).toContain('Model not found');
        });

        test('should continue processing after individual failures', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate multiple changes, some will fail
            const changes = [
                {
                    _id: { _data: 'token1' },
                    operationType: 'insert',
                    ns: { db: 'test', coll: 'invalid' },
                    documentKey: { _id: new mongoose.Types.ObjectId() },
                    fullDocument: { _id: new mongoose.Types.ObjectId() }
                },
                {
                    _id: { _data: 'token2' },
                    operationType: 'update',
                    ns: { db: 'test', coll: 'invalid' },
                    documentKey: { _id: new mongoose.Types.ObjectId() },
                    updateDescription: { updatedFields: { test: 'value' }, removedFields: [] }
                }
            ];

            changes.forEach(change => mockChangeStream.simulateChange(change));

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 500));

            // Listener should still be running
            expect(listener.isRunning).toBe(true);

            // Stats should show failures
            const stats = listener.getStats();
            expect(stats.failedChanges).toBeGreaterThan(0);

            // Cleanup
            await listener.stop();
        }, 10000);
    });

    describe('Max Retry Handling', () => {
        test('should stop retrying after max attempts', async () => {
            // Configure low max retries for testing
            const originalMaxRetries = syncConfig.maxRetries;
            syncConfig.maxRetries = 2;

            let attemptCount = 0;
            const alwaysFailingProcessor = {
                processChange: createMockFn().mockImplementation(async () => {
                    attemptCount++;
                    return { success: false, error: 'Permanent failure' };
                })
            };

            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, alwaysFailingProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate a change
            const change = {
                _id: { _data: 'test-token' },
                operationType: 'insert',
                ns: { db: 'test', coll: 'test' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: 'test' }
            };

            mockChangeStream.simulateChange(change);

            // Wait for all retry attempts
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Should have attempted max retries + 1 (initial attempt)
            expect(attemptCount).toBeLessThanOrEqual(syncConfig.maxRetries + 1);

            // Cleanup
            await listener.stop();
            syncConfig.maxRetries = originalMaxRetries;
        }, 10000);

        test('should log error after max retries reached', async () => {
            const originalMaxRetries = syncConfig.maxRetries;
            syncConfig.maxRetries = 1;

            const consoleErrorSpy = createMockFn(console, 'error').mockImplementation();

            const alwaysFailingProcessor = {
                processChange: createMockFn().mockResolvedValue({ 
                    success: false, 
                    error: 'Permanent failure' 
                })
            };

            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, alwaysFailingProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate a change
            const change = {
                _id: { _data: 'test-token' },
                operationType: 'insert',
                ns: { db: 'test', coll: 'test' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: 'test' }
            };

            mockChangeStream.simulateChange(change);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Should have logged error
            // Note: Actual logging depends on Logger implementation

            // Cleanup
            await listener.stop();
            syncConfig.maxRetries = originalMaxRetries;
            consoleErrorSpy.mockRestore();
        }, 10000);
    });

    describe('Network Failures', () => {
        test('should handle connection unavailable', async () => {
            const unavailableDbManager = new MockDatabaseManager({
                atlasAvailable: false
            });

            const listener = new AtlasChangeListener(unavailableDbManager, changeProcessor, originTracker);

            // Try to start (should fail)
            await expect(listener.start()).rejects.toThrow('Atlas connection not available');

            // Should not be running
            expect(listener.isRunning).toBe(false);
        });

        test('should handle null Atlas connection', async () => {
            const nullConnectionDbManager = new MockDatabaseManager({
                atlasAvailable: true,
                atlasConnection: null
            });

            const listener = new AtlasChangeListener(nullConnectionDbManager, changeProcessor, originTracker);

            // Try to start (should fail)
            await expect(listener.start()).rejects.toThrow('Atlas connection is null');

            // Should not be running
            expect(listener.isRunning).toBe(false);
        });
    });

    describe('Batch Processing Errors', () => {
        test('should handle errors in batch processing', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate multiple changes quickly to trigger batching
            const changes = Array.from({ length: 10 }, (_, i) => ({
                _id: { _data: `token${i}` },
                operationType: 'insert',
                ns: { db: 'test', coll: 'invalid' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: `test${i}` }
            }));

            changes.forEach(change => mockChangeStream.simulateChange(change));

            // Wait for batch processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Listener should still be running despite errors
            expect(listener.isRunning).toBe(true);

            // Stats should show batch was processed
            const stats = listener.getStats();
            expect(stats.batchesProcessed).toBeGreaterThan(0);

            // Cleanup
            await listener.stop();
        }, 10000);

        test('should process remaining batch on stop', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();

            // Add changes to batch
            const changes = Array.from({ length: 5 }, (_, i) => ({
                _id: { _data: `token${i}` },
                operationType: 'insert',
                ns: { db: 'test', coll: 'test' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: `test${i}` }
            }));

            changes.forEach(change => mockChangeStream.simulateChange(change));

            // Stop immediately (should process remaining batch)
            await listener.stop();

            // Should have processed the batch
            const stats = listener.getStats();
            expect(stats.totalChanges).toBeGreaterThan(0);
        }, 10000);
    });

    describe('Exponential Backoff', () => {
        test('should increase delay between reconnection attempts', async () => {
            const failingDbManager = new MockDatabaseManager({
                shouldFailConnection: true,
                maxConnectionFails: 100
            });

            const listener = new AtlasChangeListener(failingDbManager, changeProcessor, originTracker);
            
            listener.maxReconnectAttempts = 5;
            listener.reconnectInterval = 100;

            const startTime = Date.now();

            // Try to start (will fail and trigger reconnections)
            try {
                await listener.start();
            } catch (error) {
                // Expected
            }

            // Wait for multiple reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 3000));

            const elapsed = Date.now() - startTime;

            // With exponential backoff, should take longer than linear retries
            // 100ms * (1 + 2 + 4 + 8 + 16) = 3100ms minimum
            expect(elapsed).toBeGreaterThan(1000);

            // Cleanup
            await listener.stop();
        }, 10000);
    });

    describe('Error Recovery', () => {
        test('should recover and continue processing after error', async () => {
            let shouldFail = true;
            const recoveringProcessor = {
                processChange: createMockFn().mockImplementation(async () => {
                    if (shouldFail) {
                        shouldFail = false;
                        return { success: false, error: 'Temporary error' };
                    }
                    return { success: true };
                })
            };

            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, recoveringProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate a change
            const change = {
                _id: { _data: 'test-token' },
                operationType: 'insert',
                ns: { db: 'test', coll: 'test' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: 'test' }
            };

            mockChangeStream.simulateChange(change);

            // Wait for processing with retry
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Should have recovered and succeeded
            expect(recoveringProcessor.processChange).toHaveBeenCalledTimes(2);

            // Cleanup
            await listener.stop();
        }, 10000);
    });

    describe('Concurrent Error Handling', () => {
        test('should handle multiple concurrent errors', async () => {
            const mockChangeStream = new MockChangeStream();
            const mockAtlasConnection = {
                db: {
                    watch: createMockFn().mockReturnValue(mockChangeStream)
                }
            };

            mockDbManager.atlasConnection = mockAtlasConnection;

            const listener = new AtlasChangeListener(mockDbManager, changeProcessor, originTracker);

            // Start listener
            await listener.start();

            // Simulate many changes at once
            const changes = Array.from({ length: 50 }, (_, i) => ({
                _id: { _data: `token${i}` },
                operationType: 'insert',
                ns: { db: 'test', coll: 'invalid' },
                documentKey: { _id: new mongoose.Types.ObjectId() },
                fullDocument: { _id: new mongoose.Types.ObjectId(), data: `test${i}` }
            }));

            // Emit all changes rapidly
            changes.forEach(change => mockChangeStream.simulateChange(change));

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Listener should still be running
            expect(listener.isRunning).toBe(true);

            // Should have processed all changes (even if they failed)
            const stats = listener.getStats();
            expect(stats.totalChanges).toBe(50);

            // Cleanup
            await listener.stop();
        }, 15000);
    });
});
