/**
 * Test script for OpenWeatherMap API integration
 * Run with: ts-node test-openweathermap.ts
 */

import axios from 'axios';

const OPENWEATHER_API_KEY = '6b33f16dae3587630c60ee15fcb0b4e4';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

interface TestLocation {
  name: string;
  latitude: number;
  longitude: number;
}

const testLocations: TestLocation[] = [
  { name: 'Da Nang, Vietnam', latitude: 16.0544, longitude: 108.2022 },
  { name: 'Ho Chi Minh City', latitude: 10.8231, longitude: 106.6297 },
  { name: 'Hai Phong Port', latitude: 20.8449, longitude: 106.6881 },
  { name: 'Singapore Strait', latitude: 1.2644, longitude: 103.8216 },
];

async function testOpenWeatherMapAPI(location: TestLocation): Promise<void> {
 

  try {
    const url = `${OPENWEATHER_BASE_URL}/weather`;

    const response = await axios.get(url, {
      params: {
        lat: location.latitude,
        lon: location.longitude,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 10000,
    });

    const data = response.data;

    console.log('\n✅ API Call Successful!');
    console.log('\n📍 Location Details:');
    console.log(`   City: ${data.name || 'N/A'}`);
    console.log(`   Country: ${data.sys?.country || 'N/A'}`);
    console.log(`   Coordinates: ${data.coord?.lat}, ${data.coord?.lon}`);

    console.log('\n🌡️  Weather Data:');
    console.log(`   Temperature: ${data.main?.temp || 0}°C`);
    console.log(`   Feels Like: ${data.main?.feels_like || 0}°C`);
    console.log(`   Min/Max: ${data.main?.temp_min || 0}°C / ${data.main?.temp_max || 0}°C`);
    console.log(`   Description: ${data.weather?.[0]?.description || 'Unknown'}`);
    console.log(`   Main: ${data.weather?.[0]?.main || 'Unknown'}`);

    console.log('\n💨 Wind Data:');
    const windSpeedKmh = (data.wind?.speed || 0) * 3.6;
    console.log(`   Speed: ${windSpeedKmh.toFixed(2)} km/h (${data.wind?.speed || 0} m/s)`);
    console.log(`   Direction: ${data.wind?.deg || 0}°`);
    console.log(
      `   Gust: ${data.wind?.gust ? (data.wind.gust * 3.6).toFixed(2) + ' km/h' : 'N/A'}`,
    );

    console.log('\n🌫️  Atmospheric Conditions:');
    console.log(`   Humidity: ${data.main?.humidity || 0}%`);
    console.log(`   Pressure: ${data.main?.pressure || 0} hPa`);
    console.log(`   Sea Level Pressure: ${data.main?.sea_level || 'N/A'} hPa`);
    console.log(`   Visibility: ${data.visibility || 0} meters`);
    console.log(`   Cloud Cover: ${data.clouds?.all || 0}%`);

    if (data.rain) {
      console.log('\n🌧️  Rainfall:');
      if (data.rain['1h']) console.log(`   Last 1h: ${data.rain['1h']} mm`);
      if (data.rain['3h']) console.log(`   Last 3h: ${data.rain['3h']} mm`);
    }

    console.log('\n⏰ Timestamp:');
    console.log(`   Data Time: ${new Date(data.dt * 1000).toISOString()}`);
    console.log(
      `   Timezone: UTC${data.timezone ? (data.timezone / 3600 > 0 ? '+' : '') + data.timezone / 3600 : ''}`,
    );
  } catch (error) {
    console.log('\n❌ API Call Failed!');

    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.log(`   Status Code: ${error.response.status}`);
        console.log(`   Error Message: ${error.response.data?.message || error.message}`);

        switch (error.response.status) {
          case 401:
            console.log('   ⚠️  Invalid API Key');
            break;
          case 404:
            console.log('   ⚠️  Location not found');
            break;
          case 429:
            console.log('   ⚠️  API rate limit exceeded');
            break;
        }
      } else if (error.request) {
        console.log('   ⚠️  Network Error: No response received');
        console.log(`   Details: ${error.message}`);
      } else {
        console.log(`   ⚠️  Request Error: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️  Unexpected Error: ${error}`);
    }
  }
}

async function runAllTests(): Promise<void> {
  console.log('\n🚀 OpenWeatherMap API Integration Test');
  console.log('='.repeat(60));
  console.log(`API Key: ${OPENWEATHER_API_KEY.substring(0, 8)}...`);
  console.log(`Base URL: ${OPENWEATHER_BASE_URL}`);
  console.log(`Test Locations: ${testLocations.length}`);

  for (const location of testLocations) {
    await testOpenWeatherMapAPI(location);
    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
  console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(console.error);
