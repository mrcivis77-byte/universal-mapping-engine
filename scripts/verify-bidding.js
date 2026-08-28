#!/usr/bin/env node3
/**
 * Verify Bidding System Configuration
 * Run this to check if all bidding system files are properly configured
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  '../pb_public/js/ride.js',
  '../pb_public/index.html',
  '../config/schema/pocketbase-schema.json',
  '../pb_public/locales/en.json',
  '../pb_public/locales/es.json'
];

const pbPublicDir = './pb_public';

console.log('🔍 Verifying Bidding System Configuration...\n');

let allGood = true;

// Check each file exists and has key functions
const checks = [
  {
    name: 'Ride.js - Bidding Methods',
    file: '../pb_public/js/ride.js',
    checks: [
      { pattern: 'submitBid', desc: 'submitBid method' },
      { pattern: 'calculatePrice', desc: 'calculatePrice method' },
      { pattern: 'updateDestinationLabel', desc: 'updateDestinationLabel method' },
      { pattern: 'isFixedRoute', desc: 'isFixedRoute check' }
    ]
  },
  {
    name: 'Index.html - Bid Elements',
    file: '../pb_public/index.html',
    checks: [
      { pattern: 'dest-label-required', desc: 'Required destination label' },
      { pattern: 'dest-label-optional', desc: 'Optional destination label' },
      { pattern: 'bid-panel', desc: 'Bid panel' }
    ]
  },
  {
    name: 'Schema - Bids Collection',
    file: '../config/schema/pocketbase-schema.json',
    checks: [
      { pattern: '"name": "bids"', desc: 'bids collection' },
      { pattern: '"bidding_status"', desc: 'bidding_status field' },
      { pattern: '"avatar"', desc: 'avatar field' }
    ]
  },
  {
    name: 'Locales - Bidding Strings',
    file: '../pb_public/locales/en.json',
    checks: [
      { pattern: 'bid_title', desc: 'Bid title' },
      { pattern: 'bid_status_pending', desc: 'Pending status' },
      { pattern: 'destination_required', desc: 'Destination required' }
    ]
  },
  {
    name: 'Locales (Spanish) - Bidding Strings',
    file: '../pb_public/locales/es.json',
    checks: [
      { pattern: 'bid_title', desc: 'Bid title' },
      { pattern: 'bid_status_pending', desc: 'Pending status' },
      { pattern: 'destination_required', desc: 'Destination required' }
    ]
  }
];

checks.forEach(check => {
  console.log(`\n📋 ${check.name}`);
  const filePath = path.join(__dirname, check.file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    check.checks.forEach(c => {
      if (content.includes(c.pattern)) {
        console.log(`  ✅ ${c.desc}`);
      } else {
        console.log(`  ❌ ${c.desc} - NOT FOUND`);
        allGood = false;
      }
    });
  } catch (e) {
    console.log(`  ❌ File not found: ${filePath}`);
    allGood = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('✅ All bidding system files are properly configured!');
  console.log('\nNext steps:');
  console.log('1. Open admin/bidding-dashboard.html to configure apps');
  console.log('2. Run: ./scripts/update-bidding-system.sh');
  console.log('3. Test the application');
  process.exit(0);
} else {
  console.log('❌ Some configuration issues found!');
  console.log('\nPlease check the missing elements above.');
  process.exit(1);
}