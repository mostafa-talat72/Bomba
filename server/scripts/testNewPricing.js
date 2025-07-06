import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const testNewPricing = async () => {
  try {
    await connectDB();

    console.log('🧮 Testing new pricing formula...\n');

    // Test cases for PlayStation
    console.log('🎮 PlayStation Pricing:');
    console.log('Base rate: 20 ج.م/ساعة (لدراع واحد أو دراعين)');
    console.log('Additional rate: 5 ج.م/ساعة لكل دراعة زائدة عن 2\n');

    const testCases = [
      { minutes: 30, controllers: 1, deviceType: 'playstation' },
      { minutes: 45, controllers: 2, deviceType: 'playstation' },
      { minutes: 60, controllers: 3, deviceType: 'playstation' },
      { minutes: 90, controllers: 4, deviceType: 'playstation' },
      { minutes: 15, controllers: 1, deviceType: 'computer' },
      { minutes: 30, controllers: 1, deviceType: 'computer' },
      { minutes: 60, controllers: 1, deviceType: 'computer' },
    ];

    testCases.forEach(testCase => {
      const { minutes, controllers, deviceType } = testCase;

      if (deviceType === 'playstation') {
        const baseRate = 20; // 20 ج.م/ساعة لدراع واحد أو دراعين
        const additionalRate = Math.max(0, (controllers - 2)) * 5; // 5 ج.م إضافية لكل دراعة زائدة عن 2
        const hourlyRate = baseRate + additionalRate;
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const cost = Math.round(minutes * minuteRate * 100) / 100;

        console.log(`⏱️ ${minutes} دقيقة × ${controllers} دراعة = ${cost} ج.م`);
        console.log(`   (${hourlyRate} ج.م/ساعة ÷ 60 = ${minuteRate.toFixed(2)} ج.م/دقيقة)`);
      } else if (deviceType === 'computer') {
        const hourlyRate = 20; // 20 ج.م/ساعة للكمبيوتر
        const minuteRate = hourlyRate / 60; // تكلفة الدقيقة
        const cost = Math.round(minutes * minuteRate * 100) / 100;

        console.log(`⏱️ ${minutes} دقيقة × كمبيوتر = ${cost} ج.م`);
        console.log(`   (${hourlyRate} ج.م/ساعة ÷ 60 = ${minuteRate.toFixed(2)} ج.م/دقيقة)`);
      }
      console.log('');
    });

    console.log('✅ New pricing formula test completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

testNewPricing();
