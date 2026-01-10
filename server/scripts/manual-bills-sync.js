#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔄 Manual Bills Sync from Atlas to Local\n');

async function main() {
    try {
        // Connect to Local
        console.log('🔌 Connecting to Local...');
        const localConn = await mongoose.createConnection(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000
        });
        console.log('✅ Local connected');

        // Connect to Atlas
        console.log('🔌 Connecting to Atlas...');
        const atlasConn = await mongoose.createConnection(process.env.MONGODB_ATLAS_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000
        });
        
        await new Promise((resolve, reject) => {
            atlasConn.once('open', resolve);
            atlasConn.once('error', reject);
            setTimeout(() => reject(new Error('Atlas timeout')), 35000);
        });
        
        console.log('✅ Atlas connected');

        // Get collections
        const localBills = localConn.collection('bills');
        const atlasBills = atlasConn.collection('bills');
        
        // Check current counts
        const localCount = await localBills.countDocuments();
        const atlasCount = await atlasBills.countDocuments();
        
        console.log('\n📊 Current Status:');
        console.log(`   Local Bills:  ${localCount}`);
        console.log(`   Atlas Bills:  ${atlasCount}`);
        console.log(`   Difference:   ${atlasCount - localCount}`);
        
        if (atlasCount === localCount) {
            console.log('✅ Bills are already in sync!');
            await localConn.close();
            await atlasConn.close();
            return;
        }
        
        console.log('\n🔄 Starting manual sync...');
        
        // Get all bills from Atlas in batches
        const batchSize = 100;
        let processed = 0;
        let inserted = 0;
        let skipped = 0;
        
        const cursor = atlasBills.find({}).batchSize(batchSize);
        
        while (await cursor.hasNext()) {
            const bill = await cursor.next();
            processed++;
            
            // Check if bill already exists in Local
            const existingBill = await localBills.findOne({ _id: bill._id });
            
            if (existingBill) {
                skipped++;
                if (processed % 100 === 0) {
                    console.log(`   📊 Processed: ${processed}, Inserted: ${inserted}, Skipped: ${skipped}`);
                }
                continue;
            }
            
            try {
                // Insert bill into Local
                await localBills.insertOne(bill);
                inserted++;
                
                if (processed % 100 === 0) {
                    console.log(`   📊 Processed: ${processed}, Inserted: ${inserted}, Skipped: ${skipped}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Failed to insert bill ${bill._id}:`, error.message);
            }
        }
        
        console.log('\n✅ Manual sync completed!');
        console.log(`   📊 Final Stats:`);
        console.log(`      Processed: ${processed}`);
        console.log(`      Inserted:  ${inserted}`);
        console.log(`      Skipped:   ${skipped}`);
        
        // Verify final counts
        const finalLocalCount = await localBills.countDocuments();
        const finalAtlasCount = await atlasBills.countDocuments();
        
        console.log('\n📊 Final Verification:');
        console.log(`   Local Bills:  ${finalLocalCount}`);
        console.log(`   Atlas Bills:  ${finalAtlasCount}`);
        console.log(`   Difference:   ${finalAtlasCount - finalLocalCount}`);
        
        if (finalLocalCount === finalAtlasCount) {
            console.log('🎉 SUCCESS: Bills are now fully synced!');
        } else {
            console.log('⚠️  Some bills may not have synced. Check logs above.');
        }
        
        await localConn.close();
        await atlasConn.close();
        console.log('\n✅ Manual sync completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();