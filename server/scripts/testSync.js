import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ATLAS_URI = process.env.MONGODB_ATLAS_URI;
const LOCAL_URI = process.env.MONGODB_LOCAL_URI || "mongodb://localhost:27017/bomba";

console.log("🔍 Testing connections...");
console.log("Atlas URI:", ATLAS_URI ? "✅ Found" : "❌ Missing");
console.log("Local URI:", LOCAL_URI);

async function test() {
    try {
        console.log("\n📡 Connecting to Atlas...");
        const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
        console.log("✅ Atlas connected!");
        
        const collections = await atlasConn.db.listCollections().toArray();
        console.log(`📦 Found ${collections.length} collections on Atlas`);
        collections.forEach(c => console.log(`   - ${c.name}`));
        
        console.log("\n📡 Connecting to Local...");
        const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
        console.log("✅ Local connected!");
        
        const localCollections = await localConn.db.listCollections().toArray();
        console.log(`📦 Found ${localCollections.length} collections on Local`);
        
        await atlasConn.close();
        await localConn.close();
        
        console.log("\n✅ Test completed!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
