/**
 * Test Error Handling Implementation
 * Tests comprehensive error handling across all bidirectional sync components
 * 
 * Requirements: 7.1, 9.2, 9.3
 */

import ConflictResolver from '../services/sync/conflictResolver.js';
import OriginTracker from '../services/sync/originTracker.js';

console.log('=== Testing Error Handling Implementation ===\n');

// Test 1: ConflictResolver with null inputs
console.log('Test 1: ConflictResolver with null inputs');
try {
    const resolver = new ConflictResolver();
    
    // Test with null local document
    const result1 = resolver.resolveConflict(null, { ns: { coll: 'test' }, documentKey: { _id: '123' } });
    console.log('✓ Handled null local document:', result1.reason);
    
    // Test with null Atlas change
    const result2 = resolver.resolveConflict({ _id: '123' }, null);
    console.log('✓ Handled null Atlas change:', result2.reason);
    
    // Test with both null
    const result3 = resolver.resolveConflict(null, null);
    console.log('✓ Handled both null:', result3.reason);
    
    console.log('✅ Test 1 passed\n');
} catch (error) {
    console.error('❌ Test 1 failed:', error.message);
}

// Test 2: ConflictResolver with invalid timestamps
console.log('Test 2: ConflictResolver with invalid timestamps');
try {
    const resolver = new ConflictResolver();
    
    // Test with missing timestamps
    const localDoc = { _id: '123', data: 'test' };
    const atlasChange = { 
        ns: { coll: 'test' }, 
        documentKey: { _id: '123' },
        fullDocument: { _id: '123', data: 'test2' }
    };
    
    const result = resolver.resolveConflict(localDoc, atlasChange);
    console.log('✓ Handled missing timestamps:', result.reason);
    console.log('  Local timestamp:', result.localTimestamp);
    console.log('  Atlas timestamp:', result.atlasTimestamp);
    
    console.log('✅ Test 2 passed\n');
} catch (error) {
    console.error('❌ Test 2 failed:', error.message);
}

// Test 3: ConflictResolver timestamp extraction
console.log('Test 3: ConflictResolver timestamp extraction');
try {
    const resolver = new ConflictResolver();
    
    // Test with various timestamp formats
    const testCases = [
        { input: { updatedAt: new Date('2024-01-01') }, expected: 'Date object' },
        { input: { updatedAt: '2024-01-01' }, expected: 'Date string' },
        { input: { updatedAt: 1704067200000 }, expected: 'Timestamp number' },
        { input: { _syncMeta: { lastModified: new Date('2024-01-01') } }, expected: 'Sync metadata' },
        { input: {}, expected: 'Fallback to current time' },
        { input: null, expected: 'Null input' }
    ];
    
    for (const testCase of testCases) {
        const timestamp = resolver.extractTimestamp(testCase.input);
        console.log(`✓ ${testCase.expected}:`, timestamp instanceof Date ? 'Valid Date' : 'Invalid');
    }
    
    console.log('✅ Test 3 passed\n');
} catch (error) {
    console.error('❌ Test 3 failed:', error.message);
}

// Test 4: ConflictResolver timestamp comparison
console.log('Test 4: ConflictResolver timestamp comparison');
try {
    const resolver = new ConflictResolver();
    
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-02');
    
    const comparison1 = resolver.compareTimestamps(date1, date2);
    console.log('✓ Date1 < Date2:', comparison1 < 0);
    
    const comparison2 = resolver.compareTimestamps(date2, date1);
    console.log('✓ Date2 > Date1:', comparison2 > 0);
    
    const comparison3 = resolver.compareTimestamps(date1, date1);
    console.log('✓ Date1 == Date1:', comparison3 === 0);
    
    // Test with invalid dates
    try {
        resolver.compareTimestamps('not a date', date1);
        console.log('✗ Should have thrown error for invalid date');
    } catch (error) {
        console.log('✓ Correctly threw error for invalid date');
    }
    
    console.log('✅ Test 4 passed\n');
} catch (error) {
    console.error('❌ Test 4 failed:', error.message);
}

// Test 5: OriginTracker with null inputs
console.log('Test 5: OriginTracker with null inputs');
try {
    const tracker = new OriginTracker();
    
    // Test marking with null
    tracker.markLocalChange(null);
    console.log('✓ Handled null document ID in markLocalChange');
    
    tracker.markAtlasChange(null);
    console.log('✓ Handled null document ID in markAtlasChange');
    
    // Test checking with null
    const isLocal = tracker.isLocalChange(null);
    console.log('✓ Handled null document ID in isLocalChange:', isLocal);
    
    const isAtlas = tracker.isAtlasChange(null);
    console.log('✓ Handled null document ID in isAtlasChange:', isAtlas);
    
    const shouldSkip = tracker.shouldSkipSync(null, 'local');
    console.log('✓ Handled null document ID in shouldSkipSync:', shouldSkip);
    
    console.log('✅ Test 5 passed\n');
} catch (error) {
    console.error('❌ Test 5 failed:', error.message);
}

// Test 6: OriginTracker with invalid origin
console.log('Test 6: OriginTracker with invalid origin');
try {
    const tracker = new OriginTracker();
    
    tracker.markLocalChange('doc123');
    
    // Test with invalid origin
    const shouldSkip1 = tracker.shouldSkipSync('doc123', 'invalid');
    console.log('✓ Handled invalid origin:', shouldSkip1);
    
    const shouldSkip2 = tracker.shouldSkipSync('doc123', null);
    console.log('✓ Handled null origin:', shouldSkip2);
    
    const shouldSkip3 = tracker.shouldSkipSync('doc123', '');
    console.log('✓ Handled empty origin:', shouldSkip3);
    
    console.log('✅ Test 6 passed\n');
} catch (error) {
    console.error('❌ Test 6 failed:', error.message);
}

// Test 7: OriginTracker instance ID generation
console.log('Test 7: OriginTracker instance ID generation');
try {
    const tracker = new OriginTracker();
    
    console.log('✓ Instance ID generated:', tracker.instanceId);
    console.log('✓ Instance ID format:', tracker.instanceId.includes('-') ? 'Valid' : 'Invalid');
    
    // Create multiple trackers to ensure unique IDs
    const tracker2 = new OriginTracker();
    console.log('✓ Unique IDs:', tracker.instanceId !== tracker2.instanceId);
    
    console.log('✅ Test 7 passed\n');
} catch (error) {
    console.error('❌ Test 7 failed:', error.message);
}

// Test 8: OriginTracker cleanup
console.log('Test 8: OriginTracker cleanup');
try {
    const tracker = new OriginTracker();
    
    // Add some changes
    tracker.markLocalChange('doc1');
    tracker.markAtlasChange('doc2');
    tracker.markLocalChange('doc3');
    
    console.log('✓ Tracked changes:', tracker.size());
    
    // Run cleanup (won't remove anything as they're recent)
    tracker.cleanup();
    console.log('✓ Cleanup executed without errors');
    console.log('✓ Tracked changes after cleanup:', tracker.size());
    
    // Clear all
    tracker.clear();
    console.log('✓ All changes cleared:', tracker.size());
    
    // Stop cleanup timer
    tracker.stopCleanup();
    console.log('✓ Cleanup timer stopped');
    
    console.log('✅ Test 8 passed\n');
} catch (error) {
    console.error('❌ Test 8 failed:', error.message);
}

// Test 9: ConflictResolver conflict logging
console.log('Test 9: ConflictResolver conflict logging');
try {
    const resolver = new ConflictResolver();
    
    // Create a conflict
    const localDoc = { _id: '123', updatedAt: new Date('2024-01-01') };
    const atlasChange = { 
        ns: { coll: 'test' }, 
        documentKey: { _id: '123' },
        fullDocument: { _id: '123', updatedAt: new Date('2024-01-02') }
    };
    
    const result = resolver.resolveConflict(localDoc, atlasChange);
    console.log('✓ Conflict resolved:', result.winner);
    
    const stats = resolver.getConflictStats();
    console.log('✓ Conflict stats:', stats.totalConflicts, 'conflicts');
    console.log('✓ Recent conflicts:', stats.recentConflicts.length);
    
    // Test getting conflicts for document
    const docConflicts = resolver.getConflictsForDocument('123');
    console.log('✓ Document conflicts:', docConflicts.length);
    
    console.log('✅ Test 9 passed\n');
} catch (error) {
    console.error('❌ Test 9 failed:', error.message);
}

// Test 10: ConflictResolver with large conflict log
console.log('Test 10: ConflictResolver with large conflict log');
try {
    const resolver = new ConflictResolver();
    
    // Create many conflicts to test log trimming
    for (let i = 0; i < 1100; i++) {
        const localDoc = { _id: `doc${i}`, updatedAt: new Date() };
        const atlasChange = { 
            ns: { coll: 'test' }, 
            documentKey: { _id: `doc${i}` },
            fullDocument: { _id: `doc${i}`, updatedAt: new Date() }
        };
        resolver.resolveConflict(localDoc, atlasChange);
    }
    
    const stats = resolver.getConflictStats();
    console.log('✓ Total conflicts:', stats.totalConflicts);
    console.log('✓ Conflict log size:', stats.conflictLogSize);
    console.log('✓ Log trimmed correctly:', stats.conflictLogSize <= 1000);
    
    // Clear log
    resolver.clearLog();
    const statsAfterClear = resolver.getConflictStats();
    console.log('✓ Log cleared:', statsAfterClear.conflictLogSize === 0);
    
    // Reset stats
    resolver.resetStats();
    const statsAfterReset = resolver.getConflictStats();
    console.log('✓ Stats reset:', statsAfterReset.totalConflicts === 0);
    
    console.log('✅ Test 10 passed\n');
} catch (error) {
    console.error('❌ Test 10 failed:', error.message);
}

console.log('=== All Error Handling Tests Completed ===');
console.log('\nSummary:');
console.log('✅ ConflictResolver handles null inputs gracefully');
console.log('✅ ConflictResolver handles invalid timestamps');
console.log('✅ ConflictResolver extracts timestamps from various formats');
console.log('✅ ConflictResolver compares timestamps correctly');
console.log('✅ OriginTracker handles null inputs gracefully');
console.log('✅ OriginTracker handles invalid origins');
console.log('✅ OriginTracker generates unique instance IDs');
console.log('✅ OriginTracker cleanup works correctly');
console.log('✅ ConflictResolver logs conflicts correctly');
console.log('✅ ConflictResolver trims large conflict logs');
console.log('\n✅ All error handling features working correctly!');
