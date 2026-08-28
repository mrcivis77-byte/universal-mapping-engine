#!/usr/bin/env node3
/**
 * Bidding System Configuration Generator
 * This script processes your ideas and generates the necessary configs
 * for the full bidding system with fair pricing.
 * 
 * Usage: node3 scripts/bidding-config-generator.js
 */

const fs = require('fs');
const path = require('path');

// Configuration object - represents your ideas
const biddingConfig = {
  // Pricing formula as you specified
  pricing: {
    distanceRate: 1,        // 1 peso per km
    maintenanceCost: 30,    // Fixed maintenance cost per ride
    licenseFee: 10,         // Fixed license fee per ride
    timeRate: 2,            // 2 pesos per minute
    minTimeBuffer: 5        // Minimum time buffer in pesos
  },
  
  // App configurations
  apps: {
    moto: {
      name: "Moto Taxi",
      requiresDestination: true,
      fixedRoute: false,
      driverCanBid: true,
      minBidAmount: 50
    },
    bus: {
      name: "Community Bus",
      requiresDestination: false,  // Fixed route - no destination needed
      fixedRoute: true,
      driverCanBid: false
    },
    drive: {
      name: "Personal Driver",
      requiresDestination: true,
      fixedRoute: false,
      driverCanBid: true,
      minBidAmount: 70
    },
    parque: {
      name: "Travel",
      requiresDestination: true,
      fixedRoute: false,
      driverCanBid: true,
      minBidAmount: 60
    },
    fishing: {
      name: "Fishing",
      requiresDestination: true,
      fixedRoute: false,
      driverCanBid: true,
      minBidAmount: 80
    },
    austed: {
      name: "Express Delivery",
      requiresDestination: true,
      fixedRoute: false,
      driverCanBid: true,
      minBidAmount: 40
    }
  },
  
  // Bidding flow phases
  biddingPhases: {
    REQUEST: "request",      // Driver sees request
    BIDDING: "bidding",      // Drivers submit bids
    SELECTED: "selected",    // Customer selects a bid
    PICKED_UP: "picked_up",  // Driver picks up customer
    COMPLETED: "completed",  // Ride completed
    DISPUTED: "disputed"     // Reservation for dispute resolution
  },
  
  // UI labels and messages
  ui: {
    en: {
      destination_required: "Please enter a destination so drivers can quote you",
      destination_optional: "Destination (optional) - for fixed route services only",
      price_calculated: "Price calculated automatically based on your route",
      bid_submitted: "Your bid has been submitted",
      bid_accepted: "Bid accepted! Driver is on the way.",
      bid_rejected: "Bid rejected",
      bid_waiting: "Waiting for driver bids...",
      bid_selected: "Selected bid: ",
      driver_arriving: "Driver is arriving..."
    },
    es: {
      destination_required: "Debes ingresar un destino para que los conductores cotizen",
      destination_optional: "Destino (opcional) - solo para servicios de ruta fija",
      price_calculated: "Precio calculado automáticamente basado en tu ruta",
      bid_submitted: "Tu puja ha sido enviada",
      bid_accepted: "¡Puja aceptada! El conductor está en camino.",
      bid_rejected: "Puja rechazada",
      bid_waiting: "Esperando pujas de conductores...",
      bid_selected: "Puja seleccionada: ",
      driver_arriving: "El conductor está arribo..."
    }
  }
};

/**
 * Calculate estimated price based on distance and time
 */
function calculatePrice(distanceKm, estimatedTimeMinutes, config = biddingConfig.pricing) {
  const distancePrice = distanceKm * config.distanceRate;
  const timeBuffer = Math.max(config.minTimeBuffer, estimatedTimeMinutes * config.timeRate);
  const total = Math.round(distancePrice + config.maintenanceCost + config.licenseFee + timeBuffer);
  
  return {
    distancePrice,
    timeBuffer,
    maintenanceCost: config.maintenanceCost,
    licenseFee: config.licenseFee,
    total,
    breakdown: `${config.distanceRate} pesos/km, ${config.timeRate} pesos/min, ${config.maintenanceCost} mtto, ${config.licenseFee} lic`
  };
}

/**
 * Generate app configuration files
 */
function generateAppConfigs() {
  const configDir = './config/apps';
  const pbPublicDir = './pb_public';
  
  Object.entries(biddingConfig.apps).forEach(([appId, appConfig]) => {
    // Generate .env file
    const envContent = `# ${appConfig.name} environment configuration
APP_NAME=${appConfig.name}
REQUIRES_DESTINATION=${appConfig.requiresDestination}
FIXED_ROUTE=${appConfig.fixedRoute}
DRIVER_CAN_BID=${appConfig.driverCanBid}
MIN_BID_AMOUNT=${appConfig.minBidAmount}
`;
    
    fs.writeFileSync(
      path.join(configDir, `${appId}.env`),
      envContent
    );
    
    console.log(`✓ Generated ${appId}.env`);
  });
}

/**
 * Generate update scripts
 */
function generateUpdateScripts() {
  const script = `#!/bin/bash
# Auto-generated update script for bidding system
# Run this after making any configuration changes

echo "Updating bidding system configuration..."

# Restart services to apply changes
docker restart universal-mapping-engine_nginx_1 2>/dev/null || docker restart nginx_frontend 2>/dev/null || echo "Nginx container not found"

docker restart universal-mapping-engine_pocketbase_1 2>/dev/null || docker restart pocketbase_backend 2>/dev/null || echo "PocketBase container not found"

echo "Bidding system updates complete!"
echo "Changes applied to all configuration files."
`;
  
  fs.writeFileSync('./scripts/update-bidding-system.sh', script);
  console.log('✓ Generated update-bidding-system.sh');
}

// Main execution
console.log('🚀 Generating Bidding System Configuration...\n');

// Generate app configs
generateAppConfigs();

// Generate update scripts
generateUpdateScripts();

// Calculate example prices
console.log('\n📊 Example Pricing Calculations:');
console.log('====================================');

const examples = [
  { distance: 5, time: 10, app: 'Moto Taxi' },
  { distance: 10, time: 15, app: 'Drive' },
  { distance: 3, time: 5, app: 'Express Delivery' }
];

examples.forEach(ex => {
  const price = calculatePrice(ex.distance, ex.time);
  console.log(`\n${ex.app}:`);
  console.log(`  ${ex.distance} km, ${ex.time} min = ${price.total} pesos`);
  console.log(`  Breakdown: ${price.breakdown}`);
});

console.log('\n✅ Bidding system configuration complete!');
console.log('\nNext steps:');
console.log('1. Review generated config files in config/apps/');
console.log('2. Run: ./scripts/update-bidding-system.sh');
console.log('3. Test the bidding flow in your app');