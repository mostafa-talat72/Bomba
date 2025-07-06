import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Use local MongoDB if MONGODB_URI is not provided
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bastira';

    if (!process.env.MONGODB_URI) {
      console.log('⚠️ MONGODB_URI not set, using local MongoDB');
    }

    console.log('🔄 Connecting to MongoDB...');

    // Connection options
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

    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`🔌 Port: ${conn.connection.port}`);
    console.log(`📈 Ready State: ${conn.connection.readyState}`);

    // Test database operations
    try {
      await mongoose.connection.db.admin().ping();
      console.log('✅ Database ping successful');
    } catch (pingError) {
      console.warn('⚠️ Database ping failed, but connection established');
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed through app termination');
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed through SIGTERM');
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('📝 Error details:', error.message);

    // Provide specific error guidance
    if (error.message.includes('authentication failed')) {
      console.error('\n🔐 Authentication Error:');
      console.error('- Check your username and password in the connection string');
      console.error('- Make sure the database user has proper permissions');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n🌐 Network Error:');
      console.error('- Check your internet connection');
      console.error('- Verify the cluster hostname in your connection string');
      console.error('- Make sure MongoDB is running locally if using local connection');
    } else if (error.message.includes('timeout') || error.message.includes('Could not connect to any servers')) {
      console.error('\n⏰ Connection Timeout:');
      console.error('- This is likely an IP whitelisting issue for Atlas');
      console.error('- Add your current IP to MongoDB Atlas Network Access');
      console.error('- Or add 0.0.0.0/0 for development (not recommended for production)');
      console.error('- For local MongoDB, make sure the service is running');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n🔌 Connection Refused:');
      console.error('- Make sure MongoDB is running locally');
      console.error('- Start MongoDB service: mongod');
      console.error('- Or install MongoDB if not installed');
    }

    if (!process.env.MONGODB_URI) {
      console.error('\n🔧 Local MongoDB Setup:');
      console.error('1. Install MongoDB Community Server');
      console.error('2. Start MongoDB service: mongod');
      console.error('3. Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo');
    } else {
      console.error('\n🔧 Atlas Setup Instructions:');
      console.error('1. Go to https://cloud.mongodb.com/');
      console.error('2. Create a cluster or use existing one');
      console.error('3. Go to Database Access and create a user');
      console.error('4. Go to Network Access and add your IP (or 0.0.0.0/0 for development)');
      console.error('5. Get connection string from Connect > Connect your application');
      console.error('6. Replace <username>, <password>, and <cluster-name> in your .env file');
      console.error('7. Make sure to replace <database-name> with your actual database name (e.g., "bastira")');
    }

    process.exit(1);
  }
};

export default connectDB;
