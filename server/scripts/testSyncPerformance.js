import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import dotenv from 'dotenv';

dotenv.config();

async function testPerformance() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/bomba');
    console.log('Connected to database\n');
    
    const TestModel = mongoose.model('PerfTest', new mongoose.Schema({
      data: String,
      index: Number,
      timestamp: Date
    }));
    
    console.log('Testing operation performance with sync enabled...\n');
    
    // Test write performance
    const iterations = 1000;
    console.log(`Creating ${iterations} documents...`);
    const start = performance.now();
    
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(TestModel.create({
        data: `Test data ${i}`,
        index: i,
        timestamp: new Date()
      }));
    }
    
    await Promise.all(promises);
    
    const end = performance.now();
    const duration = end - start;
    const avgTime = duration / iterations;
    
    console.log(`\nResults:`);
    console.log(`  Total documents: ${iterations}`);
    console.log(`  Total time: ${duration.toFixed(2)}ms`);
    console.log(`  Average time per operation: ${avgTime.toFixed(2)}ms`);
    console.log(`  Operations per second: ${(1000 / avgTime * iterations / (duration / 1000)).toFixed(2)}`);
    
    if (avgTime < 10) {
      console.log('\n✓ Performance excellent (< 10ms per operation)');
    } else if (avgTime < 50) {
      console.log('\n✓ Performance acceptable (< 50ms per operation)');
    } else {
      console.log('\n⚠ Performance slower than expected (> 50ms per operation)');
    }
    
    // Test read performance
    console.log('\nTesting read performance...');
    const readStart = performance.now();
    
    const docs = await TestModel.find().limit(100);
    
    const readEnd = performance.now();
    const readDuration = readEnd - readStart;
    
    console.log(`  Read 100 documents in ${readDuration.toFixed(2)}ms`);
    console.log(`  Average: ${(readDuration / 100).toFixed(2)}ms per document`);
    
    // Cleanup
    console.log('\nCleaning up test data...');
    await TestModel.deleteMany({});
    console.log('✓ Cleanup complete');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Performance test failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

testPerformance();
