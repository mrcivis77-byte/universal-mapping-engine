#!/usr/bin/env node3
/**
 * Test script to verify destination label logic
 */

// Simulate the logic
function testDestinationLabel(vehicleTypes, appName) {
    const vehicleTypeArray = vehicleTypes.split(',').map(s => s.trim());
    
    // isFixedRoute = true means BUS (destination is optional)
    // isFixedRoute = false means MOTO/DRIVE (destination is required)
    const isFixedRoute = vehicleTypeArray.length === 1 && vehicleTypeArray[0] === 'bus';
    
    let label = isFixedRoute ? 'Destino (opcional)' : 'Destino (obligatorio)';
    let reason = isFixedRoute ? 'BUS app - fixed route' : 'MOTO/DRIVE app - door-to-door';
    
    console.log(`${appName}: ${label}`);
    console.log(`  Reason: ${reason}`);
    console.log(`  Vehicle types: ${vehicleTypeArray.join(', ')}`);
    console.log(`  isFixedRoute: ${isFixedRoute}`);
    console.log('');
}

console.log('🧪 Testing Destination Label Logic\n');
console.log('='.repeat(50) + '\n');

// Test cases
testDestinationLabel('bus', 'Community Bus');
testDestinationLabel('mototaxi', 'Moto Taxi');
testDestinationLabel('drive', 'Personal Driver');
testDestinationLabel('mototaxi,bus', 'Combined (Moto + Bus)');

console.log('✅ All tests complete!');
console.log('\nExpected behavior:');
console.log('- Bus apps: "Destino (opcional)"');
console.log('- Moto/Drive apps: "Destino (obligatorio)"');
console.log('- Combined apps: "Destino (obligatorio)" (since not purely bus)');