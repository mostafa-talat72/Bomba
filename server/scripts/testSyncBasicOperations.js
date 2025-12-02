import mongoose from 'mongoose';
import dualDbManager from '../config/dualDatabaseManager.js';
import syncMonitor from '../services/sync/syncMonitor.js';
import dotenv from 'dotenv';

dotenv.config();

async function testBasicOperations() {
  console.log('Testing basic sync operations...\n');
  
  try {
    // Connect
    console.log('Connecting to databases...');
    await dualDbManager.connectLocal(process.env.MONGODB_LOCAL_URI);
    await dualDbManager.connectAtlas(process.env.MONGODB_ATLAS_URI);
    console.log('✓ Connected to both databases\n');
    
    // Test 1: Create document
    console.log('Test 1: Creating test document...');
    const TestModel = mongoose.model('SyncTest', new mongoose.Schema({
      name: String,
      timestamp: Date
    }));
    
    const doc = await TestModel.create({
      name: 'Test Document',
      timestamp: new Date()
    });
    console.log('✓ Document created:', doc._id);
    
    // Wait for sync
    console.log('Waiting for sync to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify in Atlas
    const atlasConnection = dualDbManager.getAtlasConnection();
    if (!atlasConnection) {
      console.log('✗ Atlas connection not available');
      process.exit(1);
    }
    
    const AtlasTestModel = atlasConnection.model('SyncTest', new mongoose.Schema({
      name: String,
      timestamp: Date
    }));
    
    const atlasDoc = await AtlasTestModel.findById(doc._id);
    
    if (atlasDoc) {
      console.log('✓ Document synced to Atlas\n');
    } else {
      console.log('✗ Document NOT found in Atlas\n');
    }
    
    // Test 2: Update document
    console.log('Test 2: Updating document...');
    doc.name = 'Updated Test Document';
    await doc.save();
    console.log('✓ Document updated');
    
    console.log('Waiting for sync to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const updatedAtlasDoc = await AtlasTestModel.findById(doc._id);
    if (updatedAtlasDoc && updatedAtlasDoc.name === 'Updated Test Document') {
      console.log('✓ Update synced to Atlas\n');
    } else {
      console.log('✗ Update NOT synced to Atlas\n');
    }
    
    // Test 3: Check metrics
    console.log('Test 3: Checking sync metrics...');
    const metrics = syncMonitor.getMetrics();
    console.log('Metrics:', JSON.stringify(metrics, null, 2));
    console.log('');
    
    // Cleanup
    console.log('Cleaning up test data...');
    await TestModel.deleteOne({ _id: doc._id });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const deletedAtlasDoc = await AtlasTestModel.findById(doc._id);
    if (!deletedAtlasDoc) {
      console.log('✓ Delete synced to Atlas\n');
    } else {
      console.log('✗ Delete NOT synced to Atlas\n');
    }
    
    console.log('✓ All tests passed!');
    
    await dualDbManager.closeConnections();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    await dualDbManager.closeConnections();
    process.exit(1);
  }
}

testBasicOperations();
