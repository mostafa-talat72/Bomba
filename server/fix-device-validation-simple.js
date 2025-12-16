import mongoose from 'mongoose';
import Device from './models/Device.js';
import Logger from './middleware/logger.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config();

async function fixDeviceValidation() {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await mongoose.connect(MONGODB_URI);
        Logger.info('🔗 Connected to MongoDB');

        // البحث في مجموعة devices مباشرة
        const db = mongoose.connection.db;
        const devicesCollection = db.collection('devices');
        
        const devices = await devicesCollection.find({}).toArray();
        Logger.info(`📱 Found ${devices.length} devices in database`);

        let fixedCount = 0;
        let errorCount = 0;

        for (const device of devices) {
            try {
                const updates = {};
                let needsUpdate = false;

                Logger.info(`\n🔍 Checking device: ${device.name || 'Unknown'} (${device._id})`);
                Logger.info(`   Type: ${device.type}`);
                Logger.info(`   Current hourlyRate: ${device.hourlyRate}`);
                Logger.info(`   Current playstationRates: ${JSON.stringify(device.playstationRates)}`);

                // إصلاح أجهزة الكمبيوتر
                if (device.type === 'computer') {
                    // التأكد من وجود hourlyRate
                    if (!device.hourlyRate || device.hourlyRate <= 0) {
                        updates.hourlyRate = 15;
                        needsUpdate = true;
                        Logger.info(`   ✓ Setting hourlyRate to 15 for computer`);
                    }

                    // إزالة playstationRates إذا كان موجوداً
                    if (device.playstationRates) {
                        updates.$unset = { playstationRates: 1 };
                        needsUpdate = true;
                        Logger.info(`   ✓ Removing playstationRates from computer`);
                    }
                }

                // إصلاح أجهزة البلايستيشن
                if (device.type === 'playstation') {
                    // التأكد من وجود playstationRates
                    if (!device.playstationRates || typeof device.playstationRates !== 'object') {
                        // إنشاء Object بدلاً من Map للتوافق مع MongoDB
                        const defaultRates = {
                            '1': 20,
                            '2': 20,
                            '3': 25,
                            '4': 30
                        };
                        
                        updates.playstationRates = defaultRates;
                        needsUpdate = true;
                        Logger.info(`   ✓ Setting default playstationRates for PlayStation`);
                    }

                    // إزالة hourlyRate إذا كان موجوداً
                    if (device.hourlyRate !== undefined) {
                        if (!updates.$unset) updates.$unset = {};
                        updates.$unset.hourlyRate = 1;
                        needsUpdate = true;
                        Logger.info(`   ✓ Removing hourlyRate from PlayStation`);
                    }
                }

                // تطبيق التحديثات مباشرة على المجموعة
                if (needsUpdate) {
                    await devicesCollection.updateOne({ _id: device._id }, updates);
                    fixedCount++;
                    Logger.info(`   ✅ Fixed device: ${device.name}`);
                } else {
                    Logger.info(`   ✓ Device is already valid: ${device.name}`);
                }

            } catch (deviceError) {
                errorCount++;
                Logger.error(`   ❌ Error fixing device ${device.name}:`, deviceError);
            }
        }

        Logger.info(`\n📊 Summary:`);
        Logger.info(`   Total devices: ${devices.length}`);
        Logger.info(`   Fixed devices: ${fixedCount}`);
        Logger.info(`   Errors: ${errorCount}`);

        Logger.info('✅ Device validation fix completed');

    } catch (error) {
        Logger.error('❌ Error fixing device validation:', error);
    } finally {
        await mongoose.disconnect();
        Logger.info('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الإصلاح
fixDeviceValidation().catch(console.error);