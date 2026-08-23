#!/usr/bin/env node
/**
 * Central Registry heartbeat (Node 20+, no dependencies).
 *
 * Runs forever inside the "heartbeat" container. Reads the local config
 * from the environment (config.env via docker compose env_file), gathers
 * lightweight telemetry from the local PocketBase and announces this town
 * to the central registry at {CENTRAL_REGISTRY_URL}/api/heartbeat.
 */

import os from 'node:os';

const env = (key, fallback = '') => process.env[key] ?? fallback;

const CENTRAL_REGISTRY_URL = env('CENTRAL_REGISTRY_URL', '').replace(/\/+$/, '');
const HEARTBEAT_URL = CENTRAL_REGISTRY_URL
  ? `${CENTRAL_REGISTRY_URL}/api/heartbeat`
  : '';

const INTERVAL_MS = (parseInt(env('HEARTBEAT_INTERVAL', '300'), 10) || 300) * 1000;
const PB_URL = env('POCKETBASE_URL', 'http://backend:8090');

function parseEnvFile(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function readConfigFile() {
  try {
    const fs = await import('node:fs');
    const text = fs.readFileSync('/config.env', 'utf8');
    return parseEnvFile(text);
  } catch {
    return {};
  }
}

function collectEnv() {
  return {
    TOWN_ID: env('TOWN_ID'),
    TOWN_NAME: env('TOWN_NAME'),
    INITIAL_LATITUDE: env('INITIAL_LATITUDE'),
    INITIAL_LONGITUDE: env('INITIAL_LONGITUDE'),
    WELCOME_MESSAGE: env('WELCOME_MESSAGE'),
    APP_TYPE: env('APP_TYPE'),
    PUBLIC_URL: env('PUBLIC_URL'),
  };
}

async function loadConfig() {
  const fileConfig = await readConfigFile();
  const envConfig = collectEnv();
  // env (docker) is authoritative, file is a fallback
  return { ...fileConfig, ...envConfig };
}

async function countRecords(collection) {
  try {
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records?perPage=1&page=1`);
    if (!res.ok) return 0;
    const body = await res.json();
    return body.totalItems ?? 0;
  } catch {
    return 0;
  }
}

async function buildPayload(config) {
  const [activeDrivers, activeVessels, hiddenGemsCount, totalUsers] = await Promise.all([
    countRecords('drivers'),
    countRecords('vessels'),
    countRecords('hidden_gems'),
    countRecords('users'),
  ]);

  return {
    town_id: config.TOWN_ID || 'unknown',
    town_name: config.TOWN_NAME || 'Unknown Town',
    latitude: parseFloat(config.INITIAL_LATITUDE) || 0,
    longitude: parseFloat(config.INITIAL_LONGITUDE) || 0,
    welcome_message: config.WELCOME_MESSAGE || '',
    app_type: config.APP_TYPE || 'transit',
    tunnel_url: config.PUBLIC_URL || '',
    app_stats: {
      app_type: config.APP_TYPE || 'transit',
      active_drivers: activeDrivers,
      active_vessels: activeVessels,
      hidden_gems_count: hiddenGemsCount,
      total_users: totalUsers,
    },
    system_info: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.arch()}`,
      uptime_hours: Math.round(os.uptime() / 3600),
      memory_percent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    },
    last_seen: new Date().toISOString(),
  };
}

async function sendHeartbeat(config) {
  if (!HEARTBEAT_URL) {
    console.warn('[heartbeat] CENTRAL_REGISTRY_URL not set; skipping this cycle');
    return false;
  }

  const payload = await buildPayload(config);
  try {
    const res = await fetch(HEARTBEAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log(`[heartbeat] announced ${payload.town_name} (${res.status})`);
      return true;
    }
    console.warn(`[heartbeat] registry responded ${res.status}: ${await res.text()}`);
    return false;
  } catch (err) {
    console.warn(`[heartbeat] registry unreachable: ${err.message}`);
    return false;
  }
}

async function main() {
  const config = await loadConfig();
  console.log(`[heartbeat] starting for ${config.TOWN_NAME || 'unknown'} every ${INTERVAL_MS / 1000}s`);

  while (true) {
    try {
      await sendHeartbeat(config);
    } catch (err) {
      console.error('[heartbeat] unexpected error:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('[heartbeat] fatal:', err);
  process.exit(1);
});
