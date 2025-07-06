import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import QRCode from 'qrcode';

dotenv.config();

const updateQRCodeUrls = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bastira');
    console.log('✅ Database connected successfully');

    // Get all bills
    const bills = await Bill.find({});
    console.log(`📄 Found ${bills.length} bills`);

    const correctFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let updatedCount = 0;

    for (const bill of bills) {
      const expectedUrl = `${correctFrontendUrl}/bill/${bill._id}`;

      if (bill.qrCodeUrl !== expectedUrl) {
        console.log(`🔄 Updating bill ${bill.billNumber}:`);
        console.log(`  Old URL: ${bill.qrCodeUrl}`);
        console.log(`  New URL: ${expectedUrl}`);

        // Generate new QR code data
        const qrData = {
          billId: bill._id,
          billNumber: bill.billNumber,
          total: bill.total,
          url: expectedUrl
        };

        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

        // Update the bill
        await Bill.findByIdAndUpdate(bill._id, {
          qrCode: qrCodeDataURL,
          qrCodeUrl: expectedUrl
        });

        updatedCount++;
        console.log(`  ✅ Updated successfully`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total bills: ${bills.length}`);
    console.log(`  Updated bills: ${updatedCount}`);
    console.log(`  No changes needed: ${bills.length - updatedCount}`);

    if (updatedCount > 0) {
      console.log(`\n✅ Successfully updated ${updatedCount} QR code URLs!`);
    } else {
      console.log(`\nℹ️ All QR code URLs are already correct.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
  }
};

updateQRCodeUrls();
