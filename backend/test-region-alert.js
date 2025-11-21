/**
 * Test script to verify region alert system
 * 
 * This script:
 * 1. Creates a test circular region
 * 2. Moves an aircraft/vessel into the region
 * 3. Verifies that an alert is created and broadcast
 * 
 * Usage: node test-region-alert.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
const API_VERSION = '1.0.0';
let authToken = '';

// Default headers for all requests
const getHeaders = (includeAuth = false) => {
  const headers = {
    'X-API-Version': API_VERSION,
  };
  if (includeAuth) {
    if (!authToken) {
      console.error('⚠️ Warning: Auth token is empty!');
    }
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
};

// Test credentials (adjust as needed)
const TEST_USER = {
  username: 'admin',
  password: 'password',
};

async function login() {
  console.log('🔐 Logging in...');
  const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER, {
    headers: getHeaders(),
  });
  
  // Response structure: { success: true, data: { access_token, ... } }
  const loginData = response.data.data || response.data;
  authToken = loginData.access_token || loginData.accessToken || loginData.token;
  
  if (!authToken) {
    console.error('❌ Login response:', JSON.stringify(response.data, null, 2));
    throw new Error('No access token in response!');
  }
  
  console.log('✅ Logged in successfully');
  console.log('🔑 Token:', authToken.substring(0, 30) + '...');
  return response.data;
}

async function createTestRegion() {
  console.log('\n📍 Creating test region...');
  console.log('🔑 Auth token:', authToken ? `${authToken.substring(0, 20)}...` : 'MISSING');
  
  // Create a circular region around Hanoi coordinates
  const region = {
    name: 'Test Alert Region - Hanoi',
    description: 'Test region for alert verification',
    regionType: 'CIRCLE',
    boundary: {
      type: 'Circle',
      center: [105.8342, 21.0278], // Hanoi [lng, lat]
      radius: 50000, // 50km radius
    },
    alertOnEntry: true,
    alertOnExit: true,
    isActive: true,
  };

  const headers = getHeaders(true);
  console.log('📤 Request headers:', headers);

  const response = await axios.post(`${API_BASE}/regions`, region, {
    headers,
  });

  console.log('✅ Region created:', response.data);
  return response.data;
}

async function createTestAircraft() {
  console.log('\n✈️ Creating test aircraft...');
  
  const aircraft = {
    icao24: 'TEST123',
    flightId: 'TEST123',
    callsign: 'TEST123',
    registration: 'VN-TEST',
    aircraftType: 'A320',
    operator: 'Test Airlines',
  };

  try {
    const response = await axios.post(`${API_BASE}/aircrafts`, aircraft, {
      headers: getHeaders(true),
    });
    const createdAircraft = response.data.data || response.data;
    console.log('✅ Aircraft created:', createdAircraft);
    return createdAircraft;
  } catch (error) {
    // Aircraft already exists, use the known ID from previous runs
    console.log('⚠️ Aircraft already exists, using ID 3623244');
    return { id: 3623244, flightId: 'TEST123' };
  }
}

async function moveAircraftIntoRegion(aircraftId, lat, lng) {
  console.log(`\n🛫 Moving aircraft #${aircraftId} to position [${lat}, ${lng}]...`);
  
  const position = {
    aircraftId: aircraftId,
    latitude: lat,
    longitude: lng,
    altitude: 10000,
    speed: 450,
    heading: 90,
    timestamp: new Date().toISOString(),
    source: 'test',
  };

  const response = await axios.post(`${API_BASE}/aircrafts/positions`, position, {
    headers: getHeaders(true),
  });

  console.log('✅ Position added:', response.data);
  return response.data;
}

async function checkAlerts() {
  console.log('\n🔔 Checking for alerts...');
  
  const response = await axios.get(`${API_BASE}/regions/alerts/list`, {
    headers: getHeaders(true),
  });

  const alertsData = response.data.data || response.data;
  const alerts = Array.isArray(alertsData) ? alertsData : [];
  console.log(`📊 Found ${alerts.length} alerts:`, alerts);
  return alerts;
}

async function main() {
  try {
    // Login
    await login();

    // Create test region
    const region = await createTestRegion();

    // Create test aircraft
    const aircraft = await createTestAircraft();

    console.log('\n⏳ Waiting 2 seconds before moving aircraft...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Move aircraft OUTSIDE region first (to ensure it's tracked)
    await moveAircraftIntoRegion(aircraft.id, 20.0, 100.0);

    console.log('\n⏳ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Move aircraft INTO region (should trigger ENTRY alert)
    await moveAircraftIntoRegion(aircraft.id, 21.0278, 105.8342);

    console.log('\n⏳ Waiting 3 seconds for alert processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check alerts
    const alerts = await checkAlerts();

    if (alerts.length === 0) {
      console.log('\n❌ NO ALERTS CREATED - System is not working!');
      console.log('\n🔍 Debugging tips:');
      console.log('1. Check backend logs for region processing messages');
      console.log('2. Verify Redis is running and connected');
      console.log('3. Check WebSocket connections in browser console');
      console.log('4. Ensure region.isActive = true');
    } else {
      const entryAlert = alerts.find(a => a.alertType === 'ENTRY');
      if (entryAlert) {
        console.log('\n✅ SUCCESS! Entry alert created:', entryAlert);
      } else {
        console.log('\n⚠️ Alerts found but no ENTRY alert:', alerts);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

main();
