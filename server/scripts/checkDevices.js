import mongoose from 'mongoose';
import Device from '../models/Device.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './server/.env' });

const checkDevices = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all devices
        const devices = await Device.find({});
        console.log(`Found ${devices.length} devices:`);
        
        devices.forEach((device, index) => {
            console.log(`${index + 1}. ID: ${device._id}`);
            console.log(`   Name: ${device.name}`);
            console.log(`   Number: ${device.number}`);
            console.log(`   Type: ${device.type}`);
            console.log(`   Status: ${device.status}`);
            console.log(`   Organization: ${device.organization}`);
            console.log('   ---');
        });

        if (devices.length === 0) {
            console.log('No devices found in database');
        }

    } catch (error) {
        console.error('Error checking devices:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
};

checkDevices();