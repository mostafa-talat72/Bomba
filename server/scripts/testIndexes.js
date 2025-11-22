import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Order from '../models/Order.js';
import Bill from '../models/Bill.js';

const testIndexes = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get a sample organization ID from existing data
        const sampleOrder = await Order.findOne();
        const organizationId = sampleOrder ? sampleOrder.organization : new mongoose.Types.ObjectId();

        console.log('📊 Testing Order Model Indexes\n');
        console.log('=' .repeat(60));

        // Test 1: Query by organization, status, and createdAt
        console.log('\n1️⃣  Test: Query Orders by organization, status, and createdAt');
        const orderQuery1 = Order.find({
            organization: organizationId,
            status: 'pending',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).explain('executionStats');
        
        const orderExplain1 = await orderQuery1;
        console.log('   Index Used:', orderExplain1.executionStats.executionStages.inputStage?.indexName || 'NONE');
        console.log('   Execution Time:', orderExplain1.executionStats.executionTimeMillis, 'ms');
        console.log('   Documents Examined:', orderExplain1.executionStats.totalDocsExamined);
        console.log('   Documents Returned:', orderExplain1.executionStats.nReturned);

        // Test 2: Query by organization and tableNumber
        console.log('\n2️⃣  Test: Query Orders by organization and tableNumber');
        const orderQuery2 = Order.find({
            organization: organizationId,
            tableNumber: 1
        }).sort({ createdAt: -1 }).explain('executionStats');
        
        const orderExplain2 = await orderQuery2;
        console.log('   Index Used:', orderExplain2.executionStats.executionStages.inputStage?.indexName || 'NONE');
        console.log('   Execution Time:', orderExplain2.executionStats.executionTimeMillis, 'ms');
        console.log('   Documents Examined:', orderExplain2.executionStats.totalDocsExamined);
        console.log('   Documents Returned:', orderExplain2.executionStats.nReturned);

        console.log('\n' + '=' .repeat(60));
        console.log('📊 Testing Bill Model Indexes\n');
        console.log('=' .repeat(60));

        // Test 3: Query Bills by organization, status, and createdAt
        console.log('\n3️⃣  Test: Query Bills by organization, status, and createdAt');
        const billQuery1 = Bill.find({
            organization: organizationId,
            status: 'draft',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).explain('executionStats');
        
        const billExplain1 = await billQuery1;
        console.log('   Index Used:', billExplain1.executionStats.executionStages.inputStage?.indexName || 'NONE');
        console.log('   Execution Time:', billExplain1.executionStats.executionTimeMillis, 'ms');
        console.log('   Documents Examined:', billExplain1.executionStats.totalDocsExamined);
        console.log('   Documents Returned:', billExplain1.executionStats.nReturned);

        // Test 4: Query Bills by organization and tableNumber
        console.log('\n4️⃣  Test: Query Bills by organization and tableNumber');
        const billQuery2 = Bill.find({
            organization: organizationId,
            tableNumber: 1
        }).sort({ createdAt: -1 }).explain('executionStats');
        
        const billExplain2 = await billQuery2;
        console.log('   Index Used:', billExplain2.executionStats.executionStages.inputStage?.indexName || 'NONE');
        console.log('   Execution Time:', billExplain2.executionStats.executionTimeMillis, 'ms');
        console.log('   Documents Examined:', billExplain2.executionStats.totalDocsExamined);
        console.log('   Documents Returned:', billExplain2.executionStats.nReturned);

        // Test 5: Text search on Bill customerName
        console.log('\n5️⃣  Test: Text search on Bill customerName');
        const billQuery3 = Bill.find({
            $text: { $search: 'customer' }
        }).explain('executionStats');
        
        const billExplain3 = await billQuery3;
        console.log('   Index Used:', billExplain3.executionStats.executionStages.inputStage?.indexName || 'NONE');
        console.log('   Execution Time:', billExplain3.executionStats.executionTimeMillis, 'ms');
        console.log('   Documents Examined:', billExplain3.executionStats.totalDocsExamined);
        console.log('   Documents Returned:', billExplain3.executionStats.nReturned);

        console.log('\n' + '=' .repeat(60));
        console.log('📋 Index Summary\n');
        console.log('=' .repeat(60));

        // List all indexes
        const orderIndexes = await Order.collection.getIndexes();
        const billIndexes = await Bill.collection.getIndexes();

        console.log('\n📦 Order Model Indexes:');
        Object.keys(orderIndexes).forEach(indexName => {
            console.log(`   - ${indexName}:`, JSON.stringify(orderIndexes[indexName]));
        });

        console.log('\n📦 Bill Model Indexes:');
        Object.keys(billIndexes).forEach(indexName => {
            console.log(`   - ${indexName}:`, JSON.stringify(billIndexes[indexName]));
        });

        console.log('\n✅ Index testing completed successfully!\n');

    } catch (error) {
        console.error('❌ Error testing indexes:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
};

// Run the test
testIndexes();
