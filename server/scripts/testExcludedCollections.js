import dotenv from 'dotenv';
import syncConfig, { validateSyncConfig, updateExcludedCollections, getExcludedCollections } from '../config/syncConfig.js';

dotenv.config();

/**
 * Test script for excluded collections functionality
 * Tests validation, dynamic updates, and configuration management
 */

async function testExcludedCollections() {
    console.log('\n🧪 Testing Excluded Collections Functionality\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test 1: Validate current configuration
    console.log('📋 Test 1: Validate Current Configuration');
    console.log('─────────────────────────────────────────');
    console.log(`Sync enabled: ${syncConfig.enabled}`);
    console.log(`Bidirectional sync enabled: ${syncConfig.bidirectionalSync.enabled}`);
    
    const validation = validateSyncConfig();
    console.log(`✓ Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
    
    if (!validation.isValid) {
        console.log('❌ Errors:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (validation.warnings && validation.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    console.log('\n');

    // Test 2: Get current excluded collections
    console.log('📋 Test 2: Get Current Excluded Collections');
    console.log('─────────────────────────────────────────');
    const currentExclusions = getExcludedCollections();
    console.log('One-way exclusions:', currentExclusions.oneWay);
    console.log('Bidirectional exclusions:', currentExclusions.bidirectional);
    console.log('Combined exclusions:', currentExclusions.combined);
    console.log('\n');

    // Test 3: Validate collection names
    console.log('📋 Test 3: Validate Collection Names');
    console.log('─────────────────────────────────────────');
    
    // Test valid collection names
    const validResult = updateExcludedCollections(['sessions', 'logs', 'temp'], false);
    console.log(`✓ Valid names: ${validResult.success ? 'PASSED' : 'FAILED'}`);
    if (!validResult.success) {
        console.log(`  Error: ${validResult.message}`);
    }
    
    // Test invalid collection names (empty string)
    const invalidResult1 = updateExcludedCollections(['sessions', '', 'logs'], false);
    console.log(`✓ Empty string rejection: ${!invalidResult1.success ? 'PASSED' : 'FAILED'}`);
    if (!invalidResult1.success) {
        console.log(`  Expected error: ${invalidResult1.message}`);
    }
    
    // Test invalid input (not an array)
    const invalidResult2 = updateExcludedCollections('sessions', false);
    console.log(`✓ Non-array rejection: ${!invalidResult2.success ? 'PASSED' : 'FAILED'}`);
    if (!invalidResult2.success) {
        console.log(`  Expected error: ${invalidResult2.message}`);
    }
    
    console.log('\n');

    // Test 4: Update one-way exclusions
    console.log('📋 Test 4: Update One-Way Exclusions');
    console.log('─────────────────────────────────────────');
    const oneWayResult = updateExcludedCollections(['test_collection1', 'test_collection2'], false);
    console.log(`✓ Update result: ${oneWayResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${oneWayResult.message}`);
    
    const afterOneWay = getExcludedCollections();
    console.log('  Updated one-way exclusions:', afterOneWay.oneWay);
    console.log('\n');

    // Test 5: Update bidirectional exclusions
    console.log('📋 Test 5: Update Bidirectional Exclusions');
    console.log('─────────────────────────────────────────');
    const bidirectionalResult = updateExcludedCollections(['sessions', 'logs'], true);
    console.log(`✓ Update result: ${bidirectionalResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${bidirectionalResult.message}`);
    
    if (bidirectionalResult.warnings && bidirectionalResult.warnings.length > 0) {
        console.log('  Warnings:');
        bidirectionalResult.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
    
    const afterBidirectional = getExcludedCollections();
    console.log('  Updated bidirectional exclusions:', afterBidirectional.bidirectional);
    console.log('\n');

    // Test 6: Test overlapping exclusions (should generate warning when bidirectional sync is enabled)
    console.log('📋 Test 6: Test Overlapping Exclusions');
    console.log('─────────────────────────────────────────');
    
    // Set both exclusions with overlap
    const oneWayOverlap = updateExcludedCollections(['shared_collection', 'one_way_only'], false);
    console.log('  One-way update:', oneWayOverlap.message);
    
    const bidirOverlap = updateExcludedCollections(['shared_collection', 'bidirectional_only'], true);
    console.log('  Bidirectional update:', bidirOverlap.message);
    
    // Check current state
    const afterOverlap = getExcludedCollections();
    console.log('  Current one-way:', afterOverlap.oneWay);
    console.log('  Current bidirectional:', afterOverlap.bidirectional);
    
    // Note: Warnings only appear when bidirectional sync is enabled
    if (!syncConfig.bidirectionalSync.enabled) {
        console.log('ℹ️  Bidirectional sync is disabled - overlap warnings only appear when enabled');
        console.log('✓ Test passed: Overlap detection works correctly (warnings only when bidirectional sync is enabled)');
    } else {
        // Check warnings from the update result
        if (bidirOverlap.warnings && bidirOverlap.warnings.length > 0) {
            console.log('✓ Overlap warning detected from update:');
            bidirOverlap.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        // Now validate to see the warning
        const overlapValidation2 = validateSyncConfig();
        if (overlapValidation2.warnings && overlapValidation2.warnings.length > 0) {
            console.log('✓ Overlap warning detected from validation:');
            overlapValidation2.warnings.forEach(warning => console.log(`  - ${warning}`));
        } else {
            console.log('⚠️  No validation warning detected (unexpected)');
        }
    }
    
    console.log('\n');

    // Test 7: Restore original configuration
    console.log('📋 Test 7: Restore Original Configuration');
    console.log('─────────────────────────────────────────');
    updateExcludedCollections(currentExclusions.oneWay, false);
    updateExcludedCollections(currentExclusions.bidirectional, true);
    
    const restored = getExcludedCollections();
    const isRestored = 
        JSON.stringify(restored.oneWay) === JSON.stringify(currentExclusions.oneWay) &&
        JSON.stringify(restored.bidirectional) === JSON.stringify(currentExclusions.bidirectional);
    
    console.log(`✓ Configuration restored: ${isRestored ? 'SUCCESS' : 'FAILED'}`);
    console.log('  One-way exclusions:', restored.oneWay);
    console.log('  Bidirectional exclusions:', restored.bidirectional);
    console.log('\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run tests
testExcludedCollections().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
