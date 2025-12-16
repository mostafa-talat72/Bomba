import mongoose from 'mongoose';
import Session from './models/Session.js';
import Device from './models/Device.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config();

async function testSessionCalculation() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // البحث عن جلسة نشطة
        const activeSessions = await Session.find({ status: 'active' }).limit(1);
        
        if (activeSessions.length === 0) {
            console.log('ℹ️ No active sessions found. Creating a test session...');
            
            // البحث عن جهاز بلايستيشن
            const device = await Device.findOne({ type: 'playstation' });
            if (!device) {
                console.log('❌ No PlayStation device found');
                return;
            }

            console.log('📱 Found device:', device.name);
            console.log('   PlaystationRates:', device.playstationRates);
            console.log('   PlaystationRates type:', typeof device.playstationRates);

            // إنشاء جلسة اختبار
            const testSession = new Session({
                deviceId: device._id,
                deviceName: device.name,
                deviceNumber: device.number,
                deviceType: device.type,
                controllers: 2,
                startTime: new Date(Date.now() - 30 * 60 * 1000), // بدأت منذ 30 دقيقة
                status: 'active',
                organization: new mongoose.Types.ObjectId()
            });

            await testSession.save();
            console.log('✅ Test session created:', testSession._id);

            // اختبار حساب التكلفة الحالية
            console.log('\n🧮 Testing current cost calculation...');
            try {
                const currentCost = await testSession.calculateCurrentCost();
                console.log('✅ Current cost calculated successfully:', currentCost);
            } catch (error) {
                console.error('❌ Error calculating current cost:', error.message);
            }

            // حذف الجلسة التجريبية
            await Session.deleteOne({ _id: testSession._id });
            console.log('🧹 Test session cleaned up');

        } else {
            const session = activeSessions[0];
            console.log('🎮 Found active session:', session.deviceName);
            
            // اختبار حساب التكلفة الحالية
            console.log('\n🧮 Testing current cost calculation...');
            try {
                const currentCost = await session.calculateCurrentCost();
                console.log('✅ Current cost calculated successfully:', currentCost);
            } catch (error) {
                console.error('❌ Error calculating current cost:', error.message);
            }
        }

        // اختبار جميع الأجهزة
        console.log('\n🔍 Testing all devices...');
        const devices = await Device.find({});
        
        for (const device of devices) {
            console.log(`\n📱 Device: ${device.name} (${device.type})`);
            console.log(`   PlaystationRates: ${JSON.stringify(device.playstationRates)}`);
            console.log(`   HourlyRate: ${device.hourlyRate}`);
            
            if (device.type === 'playstation' && device.playstationRates) {
                // اختبار الوصول للأسعار
                for (let controllers = 1; controllers <= 4; controllers++) {
                    const rate = device.playstationRates[String(controllers)];
                    console.log(`   Rate for ${controllers} controllers: ${rate}`);
                }
            }
        }

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Error testing session calculation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الاختبار
testSessionCalculation().catch(console.error);