import mongoose from 'mongoose';
import Device from './models/Device.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config();

async function testDeviceModel() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // اختبار إنشاء جهاز بلايستيشن جديد
        console.log('\n🎮 Testing PlayStation device creation...');
        const playstationDevice = new Device({
            name: 'بلايستيشن اختبار',
            number: 'ps99',
            type: 'playstation',
            controllers: 2,
            playstationRates: {
                '1': 20,
                '2': 20,
                '3': 25,
                '4': 30
            },
            organization: new mongoose.Types.ObjectId()
        });

        const savedPlaystation = await playstationDevice.save();
        console.log('✅ PlayStation device created successfully:', savedPlaystation.name);
        console.log('   PlaystationRates:', savedPlaystation.playstationRates);

        // اختبار إنشاء جهاز كمبيوتر جديد
        console.log('\n💻 Testing Computer device creation...');
        const computerDevice = new Device({
            name: 'كمبيوتر اختبار',
            number: 'pc99',
            type: 'computer',
            hourlyRate: 15,
            organization: new mongoose.Types.ObjectId()
        });

        const savedComputer = await computerDevice.save();
        console.log('✅ Computer device created successfully:', savedComputer.name);
        console.log('   HourlyRate:', savedComputer.hourlyRate);

        // اختبار تحديث جهاز موجود
        console.log('\n🔄 Testing device update...');
        const existingDevice = await Device.findOne({ type: 'playstation' });
        if (existingDevice) {
            existingDevice.playstationRates = {
                '1': 22,
                '2': 22,
                '3': 27,
                '4': 32
            };
            await existingDevice.save();
            console.log('✅ Device updated successfully:', existingDevice.name);
            console.log('   New PlaystationRates:', existingDevice.playstationRates);
        }

        // تنظيف الأجهزة التجريبية
        await Device.deleteOne({ number: 'ps99' });
        await Device.deleteOne({ number: 'pc99' });
        console.log('🧹 Test devices cleaned up');

        console.log('\n✅ All tests passed! Device model is working correctly.');

    } catch (error) {
        console.error('❌ Error testing device model:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الاختبار
testDeviceModel().catch(console.error);