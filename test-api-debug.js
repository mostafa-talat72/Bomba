// Simple Node.js script to test the device creation API
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

// Test data
const deviceData = {
    name: 'Test PlayStation',
    number: 999,
    type: 'playstation',
    status: 'available',
    controllers: 2,
    playstationRates: {
        1: 20,
        2: 20,
        3: 25,
        4: 30
    }
};

async function testDeviceCreation() {
    try {
        const response = await fetch(`${API_BASE}/devices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Note: This will fail due to missing auth token, but we can see the error
            },
            body: JSON.stringify(deviceData)
        });
        
        const result = await response.json();
        
    } catch (error) {
        // Error handling without console output
    }
}

testDeviceCreation();