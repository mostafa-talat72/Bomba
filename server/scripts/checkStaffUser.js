import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkStaffUser = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find staff user
        const staffUser = await User.findOne({ email: 'staff@bomba.com' });
        
        if (!staffUser) {
            console.log('❌ Staff user not found');
            process.exit(1);
        }

        console.log('👤 Staff User Details:');
        console.log('📧 Email:', staffUser.email);
        console.log('👨‍💼 Name:', staffUser.name);
        console.log('🎭 Role:', staffUser.role);
        console.log('🔑 Permissions:', staffUser.permissions);
        console.log('✅ Status:', staffUser.status);
        console.log('🏢 Organization:', staffUser.organization);
        
        console.log('\n🔍 Permission Check:');
        console.log('- Has "cafe" permission:', staffUser.permissions.includes('cafe'));
        console.log('- Has "billing" permission:', staffUser.permissions.includes('billing'));
        console.log('- Has "staff" permission:', staffUser.permissions.includes('staff'));
        console.log('- Has "orders" permission:', staffUser.permissions.includes('orders'));
        console.log('- Has "all" permission:', staffUser.permissions.includes('all'));

        // Test hasPermission method
        console.log('\n🧪 Testing hasPermission method:');
        console.log('- hasPermission("cafe"):', staffUser.hasPermission('cafe'));
        console.log('- hasPermission("billing"):', staffUser.hasPermission('billing'));
        console.log('- hasPermission("staff"):', staffUser.hasPermission('staff'));

    } catch (error) {
        console.error('❌ Error checking staff user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

console.log('🔍 Checking Staff User Details...\n');
checkStaffUser();