import mongoose from 'mongoose';
import Logger from './server/middleware/logger.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config({ path: './server/.env' });

// الاتصال بقاعدة البيانات
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';

async function checkDeviceIssues() {
    try {
        await mongoose.connect(MONGODB_URI);
        Logger.info('🔗 Connected to MongoDB');

        // البحث في مجموعة devices مباشرة
        const db = mongoose.connection.db;
        const devicesCollection = db.collection('devices');
        
        const devices = await devicesCollection.find({}).toArray();
        Logger.info(`📱 Found ${devices.length} devices in database`);

        let issueCount = 0;

        for (const device of devices) {
            const issues = [];
            
            Logger.info(`\n🔍 Checking device: ${device.name || 'Unknown'} (${device._id})`);
            Logger.info(`   Type: ${device.type}`);
            Logger.info(`   Number: ${device.number}`);
            Logger.info(`   Status: ${device.status}`);
            Logger.info(`   HourlyRate: ${device.hourlyRate}`);
            Logger.info(`   PlaystationRates: ${JSON.stringify(device.playstationRates)}`);
            Logger.info(`   PlaystationRates type: ${typeof device.playstationRates}`);

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
                    issues.push(`PlaystationRates should be object/Map, got: ${typeof device.playstationRates}`);
                } else {
                    // فحص إذا كان Object بدلاً من Map
                    if (device.playstationRates.constructor === Object) {
                        issues.push(`PlaystationRates is Object, should be Map`);
                    }
                }
                if (device.hourlyRate) {
                    issues.push(`PlayStation should not have hourlyRate`);
                }
            }

            if (issues.length > 0) {
                issueCount++;
                Logger.error(`   ❌ Issues found:`);
                issues.forEach(issue => Logger.error(`      - ${issue}`));
            } else {
                Logger.info(`   ✅ No issues found`);
            }
        }

        Logger.info(`\n📊 Summary:`);
        Logger.info(`   Total devices: ${devices.length}`);
        Logger.info(`   Devices with issues: ${issueCount}`);
        Logger.info(`   Devices without issues: ${devices.length - issueCount}`);

        if (issueCount > 0) {
            Logger.info(`\n💡 To fix these issues, run: node fix-device-validation.js`);
        }

    } catch (error) {
        Logger.error('❌ Error checking device issues:', error);
    } finally {
        await mongoose.disconnect();
        Logger.info('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الفحص
checkDeviceIssues().catch(console.error);