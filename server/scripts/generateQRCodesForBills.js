import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function generateQRCodesForBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billIds = [
      '69211b72fca149529c1a7d14', // 248 جنيه
      '692122c3fca149529c1a93df', // 230 جنيه
      '691e9e70ab6c636406038ace', // 550 جنيه
      '6922483a4611677dc2823b34'  // 33 جنيه
    ];

    console.log('🔄 إنشاء QR Codes للفواتير...\n');

    for (const billId of billIds) {
      const bill = await billsCollection.findOne({ _id: new mongoose.Types.ObjectId(billId) });
      
      if (!bill) {
        console.log(`❌ الفاتورة ${billId} غير موجودة!\n`);
        continue;
      }

      console.log(`📋 ${bill.billNumber}:`);

      // Generate QR code URL (the URL that customers will scan)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrCodeUrl = `${frontendUrl}/bill/${billId}`;

      // Generate QR code data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

      // Update bill with QR code
      await billsCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(billId) },
        {
          $set: {
            qrCode: qrCodeDataUrl,
            qrCodeUrl: qrCodeUrl,
            updatedAt: new Date()
          }
        }
      );

      console.log(`   ✅ تم إنشاء QR Code`);
      console.log(`   URL: ${qrCodeUrl}\n`);
    }

    console.log('='  .repeat(80));
    console.log('✅ تم إنشاء QR Codes لجميع الفواتير!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

generateQRCodesForBills();
