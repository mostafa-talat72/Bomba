import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const updateBillUrls = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Finding all bills...');
    const bills = await Bill.find({});
    console.log(`📊 Found ${bills.length} bills to update`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const bill of bills) {
      try {
        console.log(`🔄 Updating bill: ${bill.billNumber} (${bill._id})`);

        // Generate new QR code data with correct URL
        const qrData = {
          billId: bill._id,
          billNumber: bill.billNumber,
          total: bill.total,
          url: `http://localhost:3000/bill/${bill._id}`
        };

        // Generate new QR code
        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

        // Update the bill
        await Bill.findByIdAndUpdate(bill._id, {
          qrCode: qrCodeDataURL,
          qrCodeUrl: qrData.url
        });

        console.log(`✅ Updated bill: ${bill.billNumber}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating bill ${bill.billNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} bills`);
    console.log(`❌ Errors: ${errorCount} bills`);
    console.log(`📄 Total bills processed: ${bills.length}`);

    if (errorCount === 0) {
      console.log('🎉 All bills updated successfully!');
    } else {
      console.log('⚠️ Some bills failed to update. Check the errors above.');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
updateBillUrls();
