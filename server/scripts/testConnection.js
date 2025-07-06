import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const testDatabaseConnection = async () => {
  try {
    console.log('🔄 Testing MongoDB Atlas connection...');
    console.log('📍 Connection URI:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@') || 'Not found in .env');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables. Please check your .env file.');
    }
    
    // Connection options optimized for Atlas
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    };

    // Connect to MongoDB Atlas
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ MongoDB Atlas connection successful!');
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`🔌 Port: ${conn.connection.port}`);
    console.log(`📈 Ready State: ${conn.connection.readyState}`);

    // Test database operations
    console.log('\n🧪 Testing database operations...');
    
    // Test ping
    await mongoose.connection.db.admin().ping();
    console.log('✅ Database ping successful');

    // Test collections access
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Collections accessible: ${collections.length} found`);

    // Test write operation
    const testCollection = mongoose.connection.db.collection('connection_test');
    const testDoc = { 
      test: true, 
      timestamp: new Date(),
      message: 'Connection test successful' 
    };
    
    const insertResult = await testCollection.insertOne(testDoc);
    console.log('✅ Write operation successful');

    // Test read operation
    const readResult = await testCollection.findOne({ _id: insertResult.insertedId });
    console.log('✅ Read operation successful');

    // Clean up test document
    await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Cleanup successful');

    console.log('\n🎉 All database tests passed!');
    console.log('🚀 Your MongoDB Atlas connection is working perfectly.');

  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('📝 Error details:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('🔐 Authentication Error: Please check your username and password');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 Network Error: Please check your internet connection');
    } else if (error.message.includes('timeout') || error.message.includes('Could not connect to any servers')) {
      console.error('⏰ Connection Error: This is likely an IP whitelisting issue');
      console.error('\n🔧 To fix this issue:');
      console.error('1. Go to your MongoDB Atlas dashboard');
      console.error('2. Navigate to Network Access');
      console.error('3. Click "Add IP Address"');
      console.error('4. Either:');
      console.error('   - Add your current IP address');
      console.error('   - Add 0.0.0.0/0 to allow access from anywhere (for development only)');
      console.error('5. Save the changes and wait a few minutes');
    }
    
    console.error('\n🔧 Additional troubleshooting tips:');
    console.error('1. Verify your MongoDB Atlas credentials');
    console.error('2. Check if your IP address is whitelisted');
    console.error('3. Ensure your cluster is running');
    console.error('4. Verify network connectivity');
    console.error('5. Make sure your connection string is correct');
    
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔒 Connection closed');
    process.exit(0);
  }
};

// Run the test
testDatabaseConnection();