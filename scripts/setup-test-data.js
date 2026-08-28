// This will be run inside PocketBase container
// Skip migrations that fail and add test data

const { testDrivers, testCustomers } = require('./add-test-data.js');
const pb = require('@pocketbase/pocketbase');

async function setupTestData() {
  const pocketbase = new pb('http://localhost:8090');
  await pocketbase.admins.authWithPassword('sandbox@yucatanmx.com', 'sandbox123');
  
  // Add drivers
  for (const driver of testDrivers) {
    try {
      await pocketbase.collection('drivers').create(driver);
      console.log(`Added driver: ${driver.name}`);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.error(`Error adding driver: ${e.message}`);
      }
    }
  }
  
  // Add customers  
  for (const customer of testCustomers) {
    try {
      await pocketbase.collection('customers').create(customer);
      console.log(`Added customer: ${customer.name}`);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.error(`Error adding customer: ${e.message}`);
      }
    }
  }
  
  console.log('Test data setup complete!');
}

setupTestData().catch(console.error);
