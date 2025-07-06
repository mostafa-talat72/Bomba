import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';

dotenv.config();

const testQRCode = async () => {
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
      qrCodeUrl: bill.qrCodeUrl
    });

    // Test the QR code URL generation
    const expectedUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/bill/${bill._id}`;
    console.log('🔗 Expected URL:', expectedUrl);
    console.log('🔗 Actual URL:', bill.qrCodeUrl);

    if (bill.qrCodeUrl === expectedUrl) {
      console.log('✅ QR code URL is correct!');
    } else {
      console.log('❌ QR code URL mismatch!');
      console.log('Updating QR code URL...');

      // Update the QR code URL
      const qrData = {
        billId: bill._id,
        billNumber: bill.billNumber,
        total: bill.total,
        url: expectedUrl
      };

      const QRCode = await import('qrcode');
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

      await Bill.findByIdAndUpdate(bill._id, {
        qrCode: qrCodeDataURL,
        qrCodeUrl: expectedUrl
      });

      console.log('✅ QR code URL updated successfully!');
    }

    // Test API endpoint
    console.log('\n🌐 Testing API endpoint...');
    const apiUrl = `http://localhost:5000/api/billing/public/${bill._id}`;
    console.log('API URL:', apiUrl);

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ API endpoint working correctly!');
        console.log('Bill data:', {
          id: data.data._id,
          billNumber: data.data.billNumber,
          total: data.data.total,
          status: data.data.status
        });
      } else {
        console.log('❌ API endpoint error:', data.message);
      }
    } catch (apiError) {
      console.log('❌ API request failed:', apiError.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
  }
};

testQRCode();
