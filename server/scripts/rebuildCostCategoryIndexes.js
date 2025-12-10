import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CostCategory from '../models/CostCategory.js';

dotenv.config({ path: './server/.env' });

const rebuildIndexes = async () => {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        console.log('🔄 Dropping existing indexes...');
        await CostCategory.collection.dropIndexes();
        console.log('✅ Indexes dropped\n');

        console.log('🔄 Creating new indexes...');
        await CostCategory.createIndexes();
        console.log('✅ Indexes created\n');

        console.log('📋 Current indexes:');
        const indexes = await CostCategory.collection.getIndexes();
        console.log(JSON.stringify(indexes, null, 2));

        console.log('\n✅ Index rebuild complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed:', error);
        process.exit(1);
    }
};

rebuildIndexes();
