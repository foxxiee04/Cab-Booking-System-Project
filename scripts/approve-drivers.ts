/**
 * Approve Test Drivers Script
 * Approves all pending drivers for testing
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000';
const ADMIN_CREDS = { email: 'admin@cabsystem.vn', password: 'Admin@123' };

async function approveDrivers() {
  try {
    console.log('🔐 Logging in as admin...');
    
    // Login as admin
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, ADMIN_CREDS);
    const adminToken = loginRes.data.data.tokens.accessToken;
    console.log('✅ Admin login successful\n');

    // Get all drivers
    console.log('👥 Fetching all drivers...');
    const driversRes = await axios.get(`${API_BASE}/api/admin/drivers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    let drivers = driversRes.data.drivers || driversRes.data.data?.drivers || driversRes.data;
    if (!Array.isArray(drivers)) {
      drivers = [];
    }
    console.log(`Found ${drivers.length} drivers`);
    console.log('Response:', JSON.stringify(driversRes.data, null, 2));

    // Filter pending drivers
    const pendingDrivers = drivers.filter((d: any) => d.status === 'PENDING');
    console.log(`📋 Pending drivers: ${pendingDrivers.length}\n`);

    if (pendingDrivers.length === 0) {
      console.log('✅ No pending drivers to approve');
      return;
    }

    // Approve each pending driver
    for (const driver of pendingDrivers) {
      try {
        console.log(`⏳ Approving driver: ${driver.email || driver.userId}...`);
        
        await axios.patch(
          `${API_BASE}/api/admin/drivers/${driver.id}/approve`,
          {},
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        
        console.log(`✅ Approved: ${driver.email || driver.userId}\n`);
      } catch (error: any) {
        console.error(`❌ Failed to approve ${driver.email}: ${error.message}\n`);
      }
    }

    console.log('\n🎉 Driver approval completed!');

    // Set driver1 online
    console.log('\n🚗 Setting driver1 online...');
    try {
      const driverLoginRes = await axios.post(`${API_BASE}/api/auth/login`, {
        email: 'driver1@cabsystem.vn',
        password: 'Driver@123'
      });
      const driverToken = driverLoginRes.data.data.tokens.accessToken;

      await axios.patch(
        `${API_BASE}/api/drivers/availability`,
        {
          availabilityStatus: 'ONLINE',
          currentLat: 10.8186,
          currentLng: 106.6517
        },
        { headers: { Authorization: `Bearer ${driverToken}` } }
      );
      
      console.log('✅ Driver1 is now ONLINE');
    } catch (error: any) {
      console.log('⚠️  Could not set driver online (may need approval first)');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

approveDrivers();
