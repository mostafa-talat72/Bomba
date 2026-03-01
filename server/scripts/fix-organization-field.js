import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Script to fix organization field in users collection
 * Converts populated organization objects back to ObjectId references
 */
async function fixOrganizationField() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Find users where organization is an object (has _id field)
        const usersWithObjectOrg = await usersCollection.find({
            'organization._id': { $exists: true }
        }).toArray();

        console.log(`\n📊 Found ${usersWithObjectOrg.length} users with organization as object`);

        if (usersWithObjectOrg.length === 0) {
            console.log('✅ No users need fixing!');
            await mongoose.connection.close();
            return;
        }

        // Fix each user
        let fixed = 0;
        for (const user of usersWithObjectOrg) {
            const organizationId = user.organization._id;
            
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { organization: organizationId } }
            );
            
            fixed++;
            console.log(`✅ Fixed user: ${user.name} (${user.email})`);
        }

        console.log(`\n🎉 Successfully fixed ${fixed} users!`);
        
        // Verify the fix
        const remainingIssues = await usersCollection.countDocuments({
            'organization._id': { $exists: true }
        });
        
        if (remainingIssues === 0) {
            console.log('✅ All users verified - organization field is now ObjectId');
        } else {
            console.log(`⚠️  Warning: ${remainingIssues} users still have issues`);
        }

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
fixOrganizationField();
