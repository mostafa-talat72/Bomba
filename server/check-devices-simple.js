import mongoose from 'mongoose';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config();

async function checkDevices() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // البحث في مجموعة devices مباشرة
        const db = mongoose.connection.db;
        const devicesCollection = db.collection('devices');
        
        const devices = await devicesCollection.find({}).toArray();
        console.log(`📱 Found ${devices.length} devices in database`);

        let issueCount = 0;

        for (const device of devices) {
            console.log(`\n🔍 Device: ${device.name || 'Unknown'} (${device._id})`);
            console.log(`   Type: ${device.type}`);
            console.log(`   Number: ${device.number}`);
            console.log(`   HourlyRate: ${device.hourlyRate}`);
            console.log(`   PlaystationRates: ${JSON.stringify(device.playstationRates)}`);
            console.log(`   PlaystationRates type: ${typeof device.playstationRates}`);

            const issues = [];

            // فحص أجهزة الكمبيوتر
            if (device.type === 'computer') {
                if (!device.hourlyRate || device.hourlyRate <= 0) {
                    issues.push(`Missing or invalid hourlyRate: ${device.hourlyRate}`);
                }
                if (device.playstationRates) {
                    issues.push(`Computer should not have playstationRates`);
                }
            }

            // فحص أجهزة البلايستيشن
            if (device.type === 'playstation') {
                if (!device.playstationRates) {
                    issues.push(`Missing playstationRates`);
                } else if (typeof device.playstationRates !== 'object') {
                    issues.push(`PlaystationRates should be object, got: ${typeof device.playstationRates}`);
                }
                if (device.hourlyRate !== undefined) {
                    issues.push(`PlayStation should not have hourlyRate`);
                }
            }

            if (issues.length > 0) {
                issueCount++;
                console.log(`   ❌ Issues found:`);
                issues.forEach(issue => console.log(`      - ${issue}`));
            } else {
                console.log(`   ✅ No issues found`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total devices: ${devices.length}`);
        console.log(`   Devices with issues: ${issueCount}`);
        console.log(`   Devices without issues: ${devices.length - issueCount}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الفحص
checkDevices().catch(console.error);