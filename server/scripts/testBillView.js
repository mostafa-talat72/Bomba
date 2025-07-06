import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';

dotenv.config();

const testBillView = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bastira');
    console.log('✅ Database connected successfully');

    // Get a sample bill
    const bill = await Bill.findOne({}).sort({ createdAt: -1 });

    if (!bill) {
      console.log('❌ No bills found in database');
      return;
    }

    console.log('📄 Found bill:', {
      id: bill._id,
      billNumber: bill.billNumber,
      total: bill.total,
      status: bill.status,
      ordersCount: bill.orders?.length || 0,
      sessionsCount: bill.sessions?.length || 0
    });

    // Test 1: Backend API endpoint
    console.log('\n🌐 Testing Backend API endpoint...');
    const apiUrl = `http://localhost:5000/api/billing/public/${bill._id}`;
    console.log('API URL:', apiUrl);

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ Backend API working correctly!');
        console.log('Response data:', {
          id: data.data._id,
          billNumber: data.data.billNumber,
          total: data.data.total,
          status: data.data.status,
          ordersCount: data.data.orders?.length || 0,
          sessionsCount: data.data.sessions?.length || 0
        });
      } else {
        console.log('❌ Backend API error:', data.message);
        return;
      }
    } catch (apiError) {
      console.log('❌ Backend API request failed:', apiError.message);
      console.log('Make sure the server is running on port 5000');
      return;
    }

    // Test 2: Frontend URL
    console.log('\n🔗 Testing Frontend URL...');
    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/bill/${bill._id}`;
    console.log('Frontend URL:', frontendUrl);

    // Test 3: QR Code URL
    console.log('\n📱 Testing QR Code URL...');
    const qrCodeUrl = bill.qrCodeUrl;
    console.log('QR Code URL:', qrCodeUrl);

    if (qrCodeUrl === frontendUrl) {
      console.log('✅ QR Code URL is correct!');
    } else {
      console.log('❌ QR Code URL mismatch!');
      console.log('Expected:', frontendUrl);
      console.log('Actual:', qrCodeUrl);
    }

    // Test 4: Check if server is running
    console.log('\n🔍 Checking server status...');
    try {
      const serverResponse = await fetch('http://localhost:5000/api/health');
      if (serverResponse.ok) {
        console.log('✅ Server is running on port 5000');
      } else {
        console.log('⚠️ Server responded but with status:', serverResponse.status);
      }
    } catch (serverError) {
      console.log('❌ Server is not running on port 5000');
      console.log('Please start the server with: npm start');
    }

    // Test 5: Check if frontend is running
    console.log('\n🔍 Checking frontend status...');
    try {
      const frontendResponse = await fetch('http://localhost:5173');
      if (frontendResponse.ok) {
        console.log('✅ Frontend is running on port 5173');
      } else {
        console.log('⚠️ Frontend responded but with status:', frontendResponse.status);
      }
    } catch (frontendError) {
      console.log('❌ Frontend is not running on port 5173');
      console.log('Please start the frontend with: npm run dev');
    }

    console.log('\n📋 Summary:');
    console.log('1. Backend API: ✅ Working');
    console.log('2. Frontend URL:', frontendUrl);
    console.log('3. QR Code URL:', qrCodeUrl === frontendUrl ? '✅ Correct' : '❌ Incorrect');
    console.log('4. Server Status: Check above');
    console.log('5. Frontend Status: Check above');

    console.log('\n🎯 To test the bill view:');
    console.log('1. Make sure both server and frontend are running');
    console.log('2. Open this URL in your browser:', frontendUrl);
    console.log('3. Or scan the QR code from the bill');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
  }
};

testBillView();
