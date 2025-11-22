import mongoose from 'mongoose';
import axios from 'axios';
import { performance } from 'perf_hooks';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_RESULTS = {
  baseline: {},
  optimized: {},
  improvements: {}
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log('✓ Connected to MongoDB', 'green');
  } catch (error) {
    log(`✗ MongoDB connection failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    return response.data.token;
  } catch (error) {
    log(`✗ Authentication failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function testAPIResponseTime(endpoint, token, params = {}, recordCount) {
  const start = performance.now();
  
  try {
    const response = await axios.get(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    
    const end = performance.now();
    const responseTime = end - start;
    const dataSize = JSON.stringify(response.data).length;
    const compressed = response.headers['content-encoding'] === 'gzip';
    
    return {
      success: true,
      responseTime: Math.round(responseTime),
      recordCount: response.data.data?.length || 0,
      dataSize,
      compressed,
      hasMore: response.data.pagination?.hasMore
    };
  } catch (error) {
    const end = performance.now();
    return {
      success: false,
      responseTime: Math.round(end - start),
      error: error.message
    };
  }
}

async function testDatabaseIndexes() {
  logSection('Database Index Verification');
  
  const Order = mongoose.model('Order');
  const Bill = mongoose.model('Bill');
  
  // Test Order indexes
  log('Testing Order collection indexes...', 'blue');
  const orderIndexes = await Order.collection.getIndexes();
  log(`Found ${Object.keys(orderIndexes).length} indexes on Order collection:`, 'yellow');
  Object.keys(orderIndexes).forEach(indexName => {
    console.log(`  - ${indexName}: ${JSON.stringify(orderIndexes[indexName])}`);
  });
  
  // Test Bill indexes
  log('\nTesting Bill collection indexes...', 'blue');
  const billIndexes = await Bill.collection.getIndexes();
  log(`Found ${Object.keys(billIndexes).length} indexes on Bill collection:`, 'yellow');
  Object.keys(billIndexes).forEach(indexName => {
    console.log(`  - ${indexName}: ${JSON.stringify(billIndexes[indexName])}`);
  });
  
  // Verify index usage with explain()
  log('\nVerifying index usage with explain()...', 'blue');
  
  const orgId = await Order.findOne().select('organization').lean();
  if (orgId) {
    const orderExplain = await Order.find({ 
      organization: orgId.organization 
    }).explain('executionStats');
    
    const indexUsed = orderExplain.executionStats.executionStages.indexName;
    const docsExamined = orderExplain.executionStats.totalDocsExamined;
    const docsReturned = orderExplain.executionStats.nReturned;
    
    log(`Order query used index: ${indexUsed || 'NONE (COLLECTION SCAN!)'}`, 
        indexUsed ? 'green' : 'red');
    log(`Documents examined: ${docsExamined}, returned: ${docsReturned}`, 'yellow');
    
    const billExplain = await Bill.find({ 
      organization: orgId.organization 
    }).explain('executionStats');
    
    const billIndexUsed = billExplain.executionStats.executionStages.indexName;
    const billDocsExamined = billExplain.executionStats.totalDocsExamined;
    const billDocsReturned = billExplain.executionStats.nReturned;
    
    log(`\nBill query used index: ${billIndexUsed || 'NONE (COLLECTION SCAN!)'}`, 
        billIndexUsed ? 'green' : 'red');
    log(`Documents examined: ${billDocsExamined}, returned: ${billDocsReturned}`, 'yellow');
    
    return {
      orderIndexes: Object.keys(orderIndexes).length,
      billIndexes: Object.keys(billIndexes).length,
      orderIndexUsed: !!indexUsed,
      billIndexUsed: !!billIndexUsed,
      orderEfficiency: docsExamined > 0 ? (docsReturned / docsExamined * 100).toFixed(2) : 100,
      billEfficiency: billDocsExamined > 0 ? (billDocsReturned / billDocsExamined * 100).toFixed(2) : 100
    };
  }
  
  return null;
}

async function testAPIPerformance(token) {
  logSection('API Response Time Testing');
  
  const tests = [
    { name: 'Orders (default limit)', endpoint: '/api/orders', params: {} },
    { name: 'Orders (100 records)', endpoint: '/api/orders', params: { limit: 100 } },
    { name: 'Orders (50 records)', endpoint: '/api/orders', params: { limit: 50 } },
    { name: 'Bills (default limit)', endpoint: '/api/billing', params: {} },
    { name: 'Bills (100 records)', endpoint: '/api/billing', params: { limit: 100 } },
    { name: 'Bills (50 records)', endpoint: '/api/billing', params: { limit: 50 } }
  ];
  
  const results = [];
  
  for (const test of tests) {
    log(`Testing: ${test.name}...`, 'blue');
    
    // Run test 3 times and take average
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const result = await testAPIResponseTime(test.endpoint, token, test.params);
      runs.push(result);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait between runs
    }
    
    const avgResponseTime = Math.round(
      runs.reduce((sum, r) => sum + r.responseTime, 0) / runs.length
    );
    const avgRecordCount = Math.round(
      runs.reduce((sum, r) => sum + r.recordCount, 0) / runs.length
    );
    const avgDataSize = Math.round(
      runs.reduce((sum, r) => sum + r.dataSize, 0) / runs.length
    );
    const compressed = runs[0].compressed;
    
    const status = avgResponseTime < 500 ? '✓' : avgResponseTime < 1000 ? '⚠' : '✗';
    const statusColor = avgResponseTime < 500 ? 'green' : avgResponseTime < 1000 ? 'yellow' : 'red';
    
    log(`  ${status} Response time: ${avgResponseTime}ms (${avgRecordCount} records, ${(avgDataSize / 1024).toFixed(2)}KB)`, statusColor);
    log(`  Compression: ${compressed ? 'Enabled ✓' : 'Disabled ✗'}`, compressed ? 'green' : 'red');
    
    results.push({
      name: test.name,
      responseTime: avgResponseTime,
      recordCount: avgRecordCount,
      dataSize: avgDataSize,
      compressed
    });
  }
  
  return results;
}

async function testCompressionEffectiveness(token) {
  logSection('Compression Effectiveness Testing');
  
  log('Testing with compression header...', 'blue');
  const withCompression = await axios.get(`${API_URL}/api/orders`, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Accept-Encoding': 'gzip, deflate'
    },
    params: { limit: 100 }
  });
  
  log('Testing without compression header...', 'blue');
  const withoutCompression = await axios.get(`${API_URL}/api/orders`, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Accept-Encoding': 'identity'
    },
    params: { limit: 100 }
  });
  
  const compressedSize = JSON.stringify(withCompression.data).length;
  const uncompressedSize = JSON.stringify(withoutCompression.data).length;
  const savings = ((1 - compressedSize / uncompressedSize) * 100).toFixed(2);
  
  log(`Uncompressed size: ${(uncompressedSize / 1024).toFixed(2)}KB`, 'yellow');
  log(`Compressed size: ${(compressedSize / 1024).toFixed(2)}KB`, 'yellow');
  log(`Compression savings: ${savings}%`, savings > 30 ? 'green' : 'yellow');
  
  return {
    uncompressedSize,
    compressedSize,
    savings: parseFloat(savings),
    isEffective: parseFloat(savings) > 30
  };
}

function generateReport(indexResults, apiResults, compressionResults) {
  logSection('Performance Test Summary');
  
  log('Database Indexes:', 'bright');
  log(`  Order indexes: ${indexResults.orderIndexes}`, 'yellow');
  log(`  Bill indexes: ${indexResults.billIndexes}`, 'yellow');
  log(`  Order index usage: ${indexResults.orderIndexUsed ? '✓ Yes' : '✗ No'}`, 
      indexResults.orderIndexUsed ? 'green' : 'red');
  log(`  Bill index usage: ${indexResults.billIndexUsed ? '✓ Yes' : '✗ No'}`, 
      indexResults.billIndexUsed ? 'green' : 'red');
  log(`  Order query efficiency: ${indexResults.orderEfficiency}%`, 'yellow');
  log(`  Bill query efficiency: ${indexResults.billEfficiency}%`, 'yellow');
  
  log('\nAPI Performance:', 'bright');
  apiResults.forEach(result => {
    const status = result.responseTime < 500 ? '✓' : result.responseTime < 1000 ? '⚠' : '✗';
    log(`  ${status} ${result.name}: ${result.responseTime}ms`, 
        result.responseTime < 500 ? 'green' : result.responseTime < 1000 ? 'yellow' : 'red');
  });
  
  log('\nCompression:', 'bright');
  log(`  Savings: ${compressionResults.savings}%`, 
      compressionResults.isEffective ? 'green' : 'yellow');
  log(`  Status: ${compressionResults.isEffective ? '✓ Effective' : '⚠ Could be better'}`, 
      compressionResults.isEffective ? 'green' : 'yellow');
  
  log('\nPerformance Targets:', 'bright');
  const under500 = apiResults.filter(r => r.responseTime < 500).length;
  const under1000 = apiResults.filter(r => r.responseTime < 1000).length;
  log(`  < 500ms: ${under500}/${apiResults.length} tests ${under500 === apiResults.length ? '✓' : '⚠'}`, 
      under500 === apiResults.length ? 'green' : 'yellow');
  log(`  < 1000ms: ${under1000}/${apiResults.length} tests ${under1000 === apiResults.length ? '✓' : '✗'}`, 
      under1000 === apiResults.length ? 'green' : 'red');
  
  // Overall assessment
  const allIndexesUsed = indexResults.orderIndexUsed && indexResults.billIndexUsed;
  const allFast = under500 === apiResults.length;
  const compressionGood = compressionResults.isEffective;
  
  log('\nOverall Assessment:', 'bright');
  if (allIndexesUsed && allFast && compressionGood) {
    log('  ✓ All optimizations working correctly!', 'green');
  } else {
    log('  ⚠ Some optimizations need attention:', 'yellow');
    if (!allIndexesUsed) log('    - Database indexes not being used effectively', 'red');
    if (!allFast) log('    - Some API responses are slower than target', 'red');
    if (!compressionGood) log('    - Compression could be more effective', 'yellow');
  }
}

async function runPerformanceTests() {
  try {
    log('Starting Performance Tests...', 'bright');
    log(`API URL: ${API_URL}`, 'blue');
    
    await connectDB();
    
    // Import models
    await import('../models/Order.js');
    await import('../models/Bill.js');
    
    const token = await getAuthToken();
    log('✓ Authenticated successfully', 'green');
    
    // Run tests
    const indexResults = await testDatabaseIndexes();
    const apiResults = await testAPIPerformance(token);
    const compressionResults = await testCompressionEffectiveness(token);
    
    // Generate report
    generateReport(indexResults, apiResults, compressionResults);
    
    await mongoose.connection.close();
    log('\n✓ Tests completed successfully', 'green');
    
  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

runPerformanceTests();
