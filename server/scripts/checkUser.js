import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const token = "b32ec43bc8cbd34df0c54ec5e339b39c4db6353779706992ffb1d0e383928f09";

async function checkUser() {
    try {
        console.log("🔍 Connecting to database...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected\n");

        // Check if user with this token exists
        console.log("🔍 Searching for user with token:", token);
        const user = await User.findOne({ verificationToken: token });
        
        if (!user) {
            console.log("❌ No user found with this token\n");
            
            // Check all users
            console.log("📋 All users in database:");
            const allUsers = await User.find({});
            console.log(`Found ${allUsers.length} users total:\n`);
            allUsers.forEach(u => {
                console.log(`  - Email: ${u.email}`);
                console.log(`    Name: ${u.name}`);
                console.log(`    Status: ${u.status}`);
                console.log(`    Token: ${u.verificationToken || 'NO TOKEN'}`);
                console.log(`    Token Match: ${u.verificationToken === token ? 'YES ✅' : 'NO'}\n`);
            });
        } else {
            console.log("✅ User found!");
            console.log(`  - Email: ${user.email}`);
            console.log(`  - Name: ${user.name}`);
            console.log(`  - Status: ${user.status}`);
            console.log(`  - Token: ${user.verificationToken}`);
            console.log(`  - Role: ${user.role}`);
        }

        await mongoose.disconnect();
        console.log("\n✅ Done!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

checkUser();
