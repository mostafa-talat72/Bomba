import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from '../models/Session.js';
import Device from '../models/Device.js';

// Load environment variables
dotenv.config();

const fixSessionCosts = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all completed sessions with zero or invalid costs
        const sessions = await Session.find({
            status: 'completed',
            $or: [
                { totalCost: 0 },
                { totalCost: null },
                { finalCost: 0 },
                { finalCost: null },
                { totalCost: { $exists: false } },
                { finalCost: { $exists: false } }
            ]
        }).populate('deviceId');

        console.log(`\n📊 Found ${sessions.length} sessions with zero/invalid costs\n`);

        let fixed = 0;
        let skipped = 0;
        let errors = 0;

        for (const session of sessions) {
            try {
                console.log(`\n🔧 Processing session: ${session._id}`);
                console.log(`   Device: ${session.deviceName || session.deviceNumber}`);
                console.log(`   Start: ${session.startTime}`);
                console.log(`   End: ${session.endTime}`);
                console.log(`   Current totalCost: ${session.totalCost}`);
                console.log(`   Current finalCost: ${session.finalCost}`);

                // Skip if no end time
                if (!session.endTime) {
                    console.log('   ⚠️  Skipped: No end time');
                    skipped++;
                    continue;
                }

                // Skip if no device
                if (!session.deviceId) {
                    console.log('   ⚠️  Skipped: No device reference');
                    skipped++;
                    continue;
                }

                // Recalculate cost
                await session.calculateCost();
                
                console.log(`   ✅ Recalculated totalCost: ${session.totalCost}`);
                console.log(`   ✅ Recalculated finalCost: ${session.finalCost}`);

                // Save the session
                await session.save();
                
                console.log('   💾 Saved successfully');
                fixed++;

            } catch (error) {
                console.error(`   ❌ Error processing session ${session._id}:`, error.message);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📈 Summary:');
        console.log(`   ✅ Fixed: ${fixed}`);
        console.log(`   ⚠️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log('='.repeat(50) + '\n');

        // Disconnect
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        
        process.exit(0);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
};

// Run the script
fixSessionCosts();
