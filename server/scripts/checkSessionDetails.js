import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });
const Session = mongoose.model('Session', sessionSchema);

async function checkSessionDetails() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const sessionId = '691ea13fab6c63640603ae41';

    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة!');
      return;
    }

    console.log('🎮 جميع بيانات الجلسة:\n');
    console.log(JSON.stringify(session, null, 2));

    console.log('\n📊 حساب التكلفة:');
    
    // Calculate cost based on duration and rate
    if (session.duration && session.hourlyRate) {
      const calculatedCost = (session.duration / 60) * session.hourlyRate;
      console.log(`   Duration: ${session.duration} دقيقة`);
      console.log(`   Hourly Rate: ${session.hourlyRate} جنيه/ساعة`);
      console.log(`   Calculated Cost: ${calculatedCost} جنيه`);
    } else if (session.startTime && session.endTime) {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);
      const durationMs = end - start;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      console.log(`   Start: ${start}`);
      console.log(`   End: ${end}`);
      console.log(`   Duration: ${durationMinutes} دقيقة`);
      
      if (session.hourlyRate) {
        const calculatedCost = (durationMinutes / 60) * session.hourlyRate;
        console.log(`   Hourly Rate: ${session.hourlyRate} جنيه/ساعة`);
        console.log(`   Calculated Cost: ${calculatedCost} جنيه`);
      }
    }

    // Check if there's a finalCost or totalCost field
    if (session.finalCost) {
      console.log(`\n💰 Final Cost: ${session.finalCost} جنيه`);
    }
    if (session.totalCost) {
      console.log(`💰 Total Cost: ${session.totalCost} جنيه`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkSessionDetails();
