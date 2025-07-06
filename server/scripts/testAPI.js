import fetch from 'node-fetch';

const testAPI = async () => {
  try {
    console.log('Testing sessions API...');

    // Test GET /api/sessions
    const response = await fetch('http://localhost:5000/api/sessions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to get a real token
      }
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('API test error:', error);
  }
};

testAPI();
