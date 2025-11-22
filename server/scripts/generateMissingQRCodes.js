import mongoose from 'mongoose';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function generateMissingQRCodes() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Import Bill model
        const Bill = (await import('../models/Bill.js')).default;

        // Find all bills without QR code
        const billsWithoutQR = await Bill.find({ qrCode: { $exists: false } });
        console.log(`\n📋 Found ${billsWithoutQR.length} bills without QR code`);

        if (billsWithoutQR.length === 0) {
            console.log('✅ All bills already have QR codes!');
            await mongoose.connection.close();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const bill of billsWithoutQR) {
            try {
                const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                const qrData = {
                    billId: bill._id,
                    billNumber: bill.billNumber,
                    total: bill.total,
                    url: `${baseUrl}/bill/${bill._id}`,
                };

                const qrCodeDataURL = await QRCode.toDataURL(
                    JSON.stringify(qrData)
                );

                await Bill.updateOne(
                    { _id: bill._id },
                    {
                        $set: {
                            qrCode: qrCodeDataURL,
                            qrCodeUrl: qrData.url,
                        }
                    },
                    { timestamps: false }
                );

                successCount++;
                console.log(`✅ Generated QR code for bill: ${bill.billNumber}`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error generating QR code for bill ${bill.billNumber}:`, error.message);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📋 Total: ${billsWithoutQR.length}`);

        await mongoose.connection.close();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

generateMissingQRCodes();
