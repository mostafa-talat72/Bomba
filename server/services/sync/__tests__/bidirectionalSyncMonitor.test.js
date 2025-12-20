import { BidirectionalSyncMonitor } from "../bidirectionalSyncMonitor.js";
import syncConfig from "../../../config/syncConfig.js";

describe("BidirectionalSyncMonitor", () => {
    let monitor;
    let originalBidirectionalEnabled;

    beforeEach(() => {
        // Create a fresh instance for each test
        monitor = new BidirectionalSyncMonitor();
        monitor.resetMetrics();
        
        // Save original bidirectional sync setting
        originalBidirectionalEnabled = syncConfig.bidirectionalSync.enabled;
    });

    afterEach(() => {
        // Restore original bidirectional sync setting
        syncConfig.bidirectionalSync.enabled = originalBidirectionalEnabled;
    });

    describe("Atlas→Local metrics tracking", () => {
        test("should record successful Atlas→Local operations", () => {
            const change = {
                operationType: "insert",
                ns: { coll: "bills" },
            };

            monitor.recordAtlasToLocal(change, 50);

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.totalOperations).toBe(1);
            expect(metrics.atlasToLocal.successfulSyncs).toBe(1);
            expect(metrics.atlasToLocal.failedSyncs).toBe(0);
            expect(metrics.atlasToLocal.avgProcessTime).toBe(50);
        });

        test("should record failed Atlas→Local operations", () => {
            const change = {
                operationType: "update",
                ns: { coll: "orders" },
                _id: "test-id",
                documentKey: { _id: "doc-id" },
            };
            const error = new Error("Test error");

            monitor.recordAtlasToLocalFailure(change, error);

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.totalOperations).toBe(1);
            expect(metrics.atlasToLocal.successfulSyncs).toBe(0);
            expect(metrics.atlasToLocal.failedSyncs).toBe(1);
        });

        test("should calculate average process time correctly", () => {
            const change = { operationType: "insert", ns: { coll: "test" } };

            monitor.recordAtlasToLocal(change, 100);
            monitor.recordAtlasToLocal(change, 200);
            monitor.recordAtlasToLocal(change, 300);

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.avgProcessTime).toBe(200);
        });
    });

    describe("Conflict metrics tracking", () => {
        test("should record conflicts", () => {
            const conflict = {
                collection: "bills",
                documentId: "doc-123",
                strategy: "last-write-wins",
                winner: "atlas",
            };

            monitor.recordConflict(conflict);

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.conflicts.totalConflicts).toBe(1);
            expect(metrics.conflicts.resolvedConflicts).toBe(1);
            expect(metrics.conflicts.conflictsByCollection.bills).toBe(1);
        });

        test("should track conflicts by collection", () => {
            monitor.recordConflict({ collection: "bills", documentId: "1" });
            monitor.recordConflict({ collection: "bills", documentId: "2" });
            monitor.recordConflict({ collection: "orders", documentId: "3" });

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.conflicts.conflictsByCollection.bills).toBe(2);
            expect(metrics.conflicts.conflictsByCollection.orders).toBe(1);
        });
    });

    describe("Change Stream status tracking", () => {
        test("should update Change Stream status", () => {
            monitor.updateChangeStreamStatus("connected");

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.changeStreamStatus).toBe("connected");
        });

        test("should track reconnect attempts", () => {
            monitor.updateChangeStreamStatus("reconnecting");
            monitor.updateChangeStreamStatus("reconnecting");
            monitor.updateChangeStreamStatus("reconnecting");

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.reconnectAttempts).toBe(3);
        });

        test("should reset reconnect attempts on successful connection", () => {
            monitor.updateChangeStreamStatus("reconnecting");
            monitor.updateChangeStreamStatus("reconnecting");
            monitor.updateChangeStreamStatus("connected");

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.reconnectAttempts).toBe(0);
        });
    });

    describe("Directional metrics", () => {
        test("should provide separate metrics for both directions", () => {
            // Record Local→Atlas operation (via parent class)
            monitor.recordSuccess({ type: "insert", collection: "bills" }, 100);

            // Record Atlas→Local operation
            monitor.recordAtlasToLocal(
                { operationType: "update", ns: { coll: "orders" } },
                50
            );

            const metrics = monitor.getDirectionalMetrics();

            expect(metrics.localToAtlas.totalOperations).toBe(1);
            expect(metrics.atlasToLocal.totalOperations).toBe(1);
        });

        test("should calculate success rates correctly", () => {
            // Local→Atlas
            monitor.recordSuccess({ type: "insert", collection: "test" }, 100);
            monitor.recordSuccess({ type: "update", collection: "test" }, 100);
            monitor.recordFailure(
                { type: "delete", collection: "test" },
                new Error("Test")
            );

            // Atlas→Local
            const change = { operationType: "insert", ns: { coll: "test" } };
            monitor.recordAtlasToLocal(change, 50);
            monitor.recordAtlasToLocalFailure(change, new Error("Test"));

            const metrics = monitor.getDirectionalMetrics();

            expect(metrics.localToAtlas.successRate).toBe("66.67%");
            expect(metrics.atlasToLocal.successRate).toBe("50.00%");
        });
    });

    describe("Bidirectional health check", () => {
        test("should include Change Stream status in health check when bidirectional sync is enabled", () => {
            // Enable bidirectional sync for this test
            syncConfig.bidirectionalSync.enabled = true;

            monitor.updateChangeStreamStatus("connected");

            const health = monitor.checkBidirectionalHealth();

            expect(health.checks.changeStream).toBeDefined();
            expect(health.checks.changeStream.status).toBe("pass");
        });

        test("should warn on high Atlas→Local failure rate when bidirectional sync is enabled", () => {
            // Enable bidirectional sync for this test
            syncConfig.bidirectionalSync.enabled = true;

            const change = { operationType: "insert", ns: { coll: "test" } };

            // Create high failure rate (>10%)
            for (let i = 0; i < 10; i++) {
                monitor.recordAtlasToLocalFailure(change, new Error("Test"));
            }
            monitor.recordAtlasToLocal(change, 50);

            const health = monitor.checkBidirectionalHealth();

            expect(health.checks.atlasToLocalFailureRate.status).toBe("warn");
        });

        test("should warn on high conflict rate when bidirectional sync is enabled", () => {
            // Enable bidirectional sync for this test
            syncConfig.bidirectionalSync.enabled = true;

            const change = { operationType: "update", ns: { coll: "test" } };

            // Create operations
            for (let i = 0; i < 10; i++) {
                monitor.recordAtlasToLocal(change, 50);
            }

            // Create high conflict rate (>5%)
            monitor.recordConflict({ collection: "test", documentId: "1" });

            const health = monitor.checkBidirectionalHealth();

            expect(health.checks.conflictRate.status).toBe("warn");
        });
    });

    describe("Bidirectional report generation", () => {
        test("should generate comprehensive bidirectional report", async () => {
            monitor.updateChangeStreamStatus("connected");
            monitor.recordAtlasToLocal(
                { operationType: "insert", ns: { coll: "test" } },
                50
            );
            monitor.recordConflict({ collection: "test", documentId: "1" });

            const report = await monitor.generateBidirectionalReport();

            expect(report.bidirectional).toBeDefined();
            expect(report.bidirectional.enabled).toBeDefined();
            expect(report.bidirectional.directionalMetrics).toBeDefined();
            expect(report.bidirectional.changeStream).toBeDefined();
            expect(report.bidirectional.conflicts).toBeDefined();
        });
    });

    describe("Metrics reset", () => {
        test("should reset all metrics including bidirectional", () => {
            // Add some data
            monitor.recordAtlasToLocal(
                { operationType: "insert", ns: { coll: "test" } },
                50
            );
            monitor.recordConflict({ collection: "test", documentId: "1" });
            monitor.updateChangeStreamStatus("connected");

            // Reset
            monitor.resetMetrics();

            const metrics = monitor.getDirectionalMetrics();
            expect(metrics.atlasToLocal.totalOperations).toBe(0);
            expect(metrics.conflicts.totalConflicts).toBe(0);
            // Change Stream status should be preserved
            expect(metrics.atlasToLocal.changeStreamStatus).toBe("connected");
        });
    });
});
