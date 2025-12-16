const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAuth() {
  try {
    console.log('Testing Authentication API...\n');

    // 1. Register
    console.log('1. Testing registration...');
    const registerRes = await axios.post(`${API_URL}/auth/register`, {
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123',
    });
    console.log('✅ Registration successful:', registerRes.data.message);
    const token = registerRes.data.token;
    console.log('Token:', token.substring(0, 20) + '...\n');

    // 2. Login
    console.log('2. Testing login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'test2@example.com',
      password: 'password123',
    });
    console.log('✅ Login successful:', loginRes.data.message);
    console.log('User:', loginRes.data.user.username, '\n');

    // 3. Get profile
    console.log('3. Testing profile retrieval...');
    const profileRes = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('✅ Profile retrieved:', profileRes.data.user.username, '\n');

    // 4. Search users
    console.log('4. Testing user search...');
    const searchRes = await axios.get(`${API_URL}/auth/search?q=test`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('✅ Search successful. Found:', searchRes.data.users.length, 'users\n');

    console.log('🎉 All authentication tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAuth();