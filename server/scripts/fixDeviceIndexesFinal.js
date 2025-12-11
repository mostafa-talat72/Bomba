import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const fixDeviceIndexes = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the devices collection directly
        const db = mongoose.connection.db;
        const collection = db.collection('devices');

        // List current indexes
        console.log('\n📋 Current indexes:');
        const indexes = await collection.listIndexes().toArray();
        indexes.forEach(index => {
            console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
            if (index.unique) console.log(`  (unique: true)`);
        });

        // Drop the problematic unique index on 'number' field if it exists
        try {
            await collection.dropIndex('number_1');
            console.log('\n✅ Successfully dropped old number_1 index');
        } catch (error) {
            if (error.code === 27) {
                console.log('\nℹ️  number_1 index does not exist (already dropped)');
            } else {
                console.log('\n⚠️  Error dropping number_1 index:', error.message);
            }
        }

        // Ensure the compound index exists and is unique
        try {
            await collection.createIndex(
                { number: 1, organization: 1 }, 
                { 
                    unique: true, 
                    name: 'number_organization_unique',
                    background: true 
                }
            );
            console.log('✅ Created/ensured compound unique index: number + organization');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Compound index already exists with same specification');
            } else {
                console.log('⚠️  Error creating compound index:', error.message);
            }
        }

        // List indexes after changes
        console.log('\n📋 Indexes after changes:');
        const newIndexes = await collection.listIndexes().toArray();
        newIndexes.forEach(index => {
            console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
            if (index.unique) console.log(`  (unique: true)`);
        });

        console.log('\n🎉 Device indexes fixed successfully!');
        console.log('✅ Now devices can have the same number in different organizations.');
        console.log('✅ Device numbers are unique only within the same organization.');

    } catch (error) {
        console.error('❌ Error fixing device indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

console.log('🔧 Starting Device Index Fix...');
console.log('This will allow same device numbers in different organizations\n');

fixDeviceIndexes();