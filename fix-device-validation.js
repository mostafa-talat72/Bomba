import mongoose from 'mongoose';
import Device from './server/models/Device.js';
import Logger from './server/middleware/logger.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config({ path: './server/.env' });

// الاتصال بقاعدة البيانات
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';

async function fixDeviceValidation() {
    try {
        await mongoose.connect(MONGODB_URI);
        Logger.info('🔗 Connected to MongoDB');

        // البحث عن جميع الأجهزة
        const devices = await Device.find({});
        Logger.info(`📱 Found ${devices.length} devices to check`);

        let fixedCount = 0;
        let errorCount = 0;

        for (const device of devices) {
            try {
                let needsUpdate = false;
                const updates = {};

                Logger.info(`🔍 Checking device: ${device.name} (${device._id})`);
                Logger.info(`   Type: ${device.type}`);
                Logger.info(`   Current hourlyRate: ${device.hourlyRate}`);
                Logger.info(`   Current playstationRates: ${JSON.stringify(device.playstationRates)}`);

                // إصلاح أجهزة الكمبيوتر
                if (device.type === 'computer') {
                    // التأكد من وجود hourlyRate
                    if (!device.hourlyRate || device.hourlyRate <= 0) {
                        updates.hourlyRate = 15; // السعر الافتراضي للكمبيوتر
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
                        // إنشاء Map صحيح للأسعار
                        const defaultRates = new Map();
                        defaultRates.set('1', 20);
                        defaultRates.set('2', 20);
                        defaultRates.set('3', 25);
                        defaultRates.set('4', 30);
                        
                        updates.playstationRates = defaultRates;
                        needsUpdate = true;
                        Logger.info(`   ✓ Setting default playstationRates for PlayStation`);
                    } else {
                        // التحقق من أن playstationRates هو Map صحيح
                        const rates = device.playstationRates;
                        if (!(rates instanceof Map)) {
                            // تحويل Object إلى Map
                            const newRates = new Map();
                            if (typeof rates === 'object') {
                                for (const [key, value] of Object.entries(rates)) {
                                    newRates.set(key, value);
                                }
                            } else {
                                // إنشاء أسعار افتراضية
                                newRates.set('1', 20);
                                newRates.set('2', 20);
                                newRates.set('3', 25);
                                newRates.set('4', 30);
                            }
                            updates.playstationRates = newRates;
                            needsUpdate = true;
                            Logger.info(`   ✓ Converting playstationRates to Map for PlayStation`);
                        }
                    }

                    // إزالة hourlyRate إذا كان موجوداً
                    if (device.hourlyRate) {
                        if (!updates.$unset) updates.$unset = {};
                        updates.$unset.hourlyRate = 1;
                        needsUpdate = true;
                        Logger.info(`   ✓ Removing hourlyRate from PlayStation`);
                    }
                }

                // تطبيق التحديثات
                if (needsUpdate) {
                    await Device.updateOne({ _id: device._id }, updates);
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

        // التحقق من النتائج
        Logger.info(`\n🔍 Verifying fixes...`);
        const updatedDevices = await Device.find({});
        
        for (const device of updatedDevices) {
            const isValid = await validateDevice(device);
            if (!isValid) {
                Logger.error(`❌ Device still invalid: ${device.name} (${device._id})`);
            } else {
                Logger.info(`✅ Device valid: ${device.name}`);
            }
        }

        Logger.info('✅ Device validation fix completed');

    } catch (error) {
        Logger.error('❌ Error fixing device validation:', error);
    } finally {
        await mongoose.disconnect();
        Logger.info('🔌 Disconnected from MongoDB');
    }
}

async function validateDevice(device) {
    try {
        if (device.type === 'computer') {
            if (!device.hourlyRate || device.hourlyRate <= 0) {
                Logger.error(`   Computer ${device.name} missing or invalid hourlyRate: ${device.hourlyRate}`);
                return false;
            }
            if (device.playstationRates) {
                Logger.error(`   Computer ${device.name} should not have playstationRates`);
                return false;
            }
        }

        if (device.type === 'playstation') {
            if (!device.playstationRates) {
                Logger.error(`   PlayStation ${device.name} missing playstationRates`);
                return false;
            }
            if (device.hourlyRate) {
                Logger.error(`   PlayStation ${device.name} should not have hourlyRate`);
                return false;
            }
        }

        return true;
    } catch (error) {
        Logger.error(`   Error validating device ${device.name}:`, error);
        return false;
    }
}

// تشغيل الإصلاح
fixDeviceValidation().catch(console.error);