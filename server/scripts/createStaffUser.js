import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const createStaffUser = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if staff user already exists
        const existingStaff = await User.findOne({ email: 'staff@bomba.com' });
        if (existingStaff) {
            console.log('ℹ️  Staff user already exists');
            console.log('Staff details:', {
                email: existingStaff.email,
                role: existingStaff.role,
                permissions: existingStaff.permissions,
                status: existingStaff.status
            });
            process.exit(0);
        }

        // Get the default organization
        const organization = await Organization.findOne({ name: 'Bomba Default' });
        if (!organization) {
            console.log('❌ Default organization not found. Please run seed:admin first.');
            process.exit(1);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('staff123', salt);

        // Create staff user with appropriate permissions
        const staffUser = new User({
            name: 'موظف النظام',
            email: 'staff@bomba.com',
            password: hashedPassword,
            role: 'staff',
            permissions: ['staff', 'cafe', 'menu', 'orders', 'billing'], // صلاحيات الموظف
            status: 'active',
            organization: organization._id,
            phone: '+201234567891',
            address: 'Cairo, Egypt'
        });

        await staffUser.save();
        console.log('✅ Staff user created successfully!');
        console.log('📋 Login credentials:');
        console.log('Email: staff@bomba.com');
        console.log('Password: staff123');
        console.log('🔑 Permissions:', staffUser.permissions);
        console.log('');
        console.log('🎯 This user can now:');
        console.log('- ✅ View and manage orders');
        console.log('- ✅ View and manage tables');
        console.log('- ✅ View and manage bills');
        console.log('- ✅ Create new orders');
        console.log('- ✅ Process payments');

    } catch (error) {
        console.error('❌ Error creating staff user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

console.log('👤 Creating Staff User...');
console.log('This user will have access to orders, tables, and billing\n');

createStaffUser();