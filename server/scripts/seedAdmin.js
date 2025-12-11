import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const seedAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ email: 'admin@bomba.com' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            console.log('Admin details:', {
                email: existingAdmin.email,
                role: existingAdmin.role,
                permissions: existingAdmin.permissions,
                status: existingAdmin.status
            });
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Create admin user first (without organization)
        const adminUser = new User({
            name: 'System Administrator',
            email: 'admin@bomba.com',
            password: hashedPassword,
            role: 'admin',
            permissions: ['all'], // Full permissions
            status: 'active',
            phone: '+201234567890',
            address: 'Cairo, Egypt'
        });

        await adminUser.save();
        console.log('Admin user created');

        // Create default organization with the admin as owner
        let organization = await Organization.findOne({ name: 'Bomba Default' });
        if (!organization) {
            organization = new Organization({
                name: 'Bomba Default',
                type: 'cafe',
                owner: adminUser._id
            });
            await organization.save();
            console.log('Created default organization');

            // Update admin user with organization
            adminUser.organization = organization._id;
            await adminUser.save();
            console.log('Updated admin user with organization');
        }
        console.log('Admin user created successfully!');
        console.log('Login credentials:');
        console.log('Email: admin@bomba.com');
        console.log('Password: admin123');
        console.log('Permissions:', adminUser.permissions);

    } catch (error) {
        console.error('Error seeding admin user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
};

seedAdmin();