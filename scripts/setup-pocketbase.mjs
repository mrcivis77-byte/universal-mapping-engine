#!/usr/bin/env node
/**
 * PocketBase setup script (Node 20+, no dependencies).
 *
 * Boots up against the backend service, authenticates as the configured
 * superuser and creates the RTM collections if they are missing. Safe to
 * re-run: existing collections are left untouched.
 *
 * Reads POCKETBASE_URL, PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD from
 * the environment (docker compose env_file from config.env).
 */

const BACKOFF = 2000;
const MAX_WAIT_MS = 120000;

function env(key, fallback = '') {
  return process.env[key] ?? fallback;
}

async function waitForHealth(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        const body = await res.json();
        console.log(`[setup] PocketBase is healthy (${body.code ?? 'ok'})`);
        return;
      }
    } catch (err) {
      // backend not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, BACKOFF));
  }
  throw new Error(`PocketBase did not become healthy within ${MAX_WAIT_MS / 1000}s`);
}

async function superuserToken(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!res.ok) {
    throw new Error(`superuser auth failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  return body.token;
}

async function api(baseUrl, token, method, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function collectionExists(baseUrl, token, name) {
  const { status, body } = await api(baseUrl, token, 'GET', `/api/collections?page=1&perPage=500`);
  if (status !== 200 || !body || !body.items) return false;
  return body.items.some((c) => c.name === name);
}

async function createCollection(baseUrl, token, def) {
  const { status, body } = await api(baseUrl, token, 'POST', '/api/collections', def);
  if (status !== 200) {
    throw new Error(`failed to create "${def.name}": ${JSON.stringify(body ?? {})}`);
  }
  console.log(`[setup] created collection "${def.name}"`);
  return body;
}

// ---- Collection definitions (PocketBase 0.39 "fields" format) ----------
// NB: since 0.23-ish the field options (values/maxSelect/min/max/...) live
// directly on the field object, NOT nested under an `options` key.

function text(name, opts = {}) {
  return { name, type: 'text', required: !!opts.required };
}

function number(name, opts = {}) {
  const field = { name, type: 'number', required: !!opts.required };
  if (opts.min !== undefined) field.min = opts.min;
  if (opts.max !== undefined) field.max = opts.max;
  return field;
}

function select(name, values, opts = {}) {
  return {
    name,
    type: 'select',
    required: !!opts.required,
    values,
    maxSelect: opts.maxSelect ?? 1,
  };
}

function relation(name, collectionId, opts = {}) {
  return {
    name,
    type: 'relation',
    required: !!opts.required,
    collectionId,
    cascadeDelete: !!opts.cascadeDelete,
    minSelect: opts.minSelect ?? 0,
    maxSelect: opts.maxSelect ?? 1,
  };
}

function file(name, opts = {}) {
  return {
    name,
    type: 'file',
    required: !!opts.required,
    maxSelect: opts.maxSelect ?? 1,
    maxSize: opts.maxSize ?? 5242880,
    mimeTypes: opts.mimeTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  };
}

function autodate(name, opts = {}) {
  const field = { name, type: 'autodate', required: !!opts.required };
  if (opts.onCreate) field.onCreate = true;
  if (opts.onUpdate) field.onUpdate = true;
  return field;
}

function json(name, opts = {}) {
  return { name, type: 'json', required: !!opts.required };
}

function url(name, opts = {}) {
  return { name, type: 'url', required: !!opts.required };
}

const PUBLIC = ''; // empty string = accessible to everyone

async function run() {
  const baseUrl = env('POCKETBASE_URL', 'http://backend:8090');
  const email = env('PB_SUPERUSER_EMAIL');
  const password = env('PB_SUPERUSER_PASSWORD');

  if (!email || !password) {
    throw new Error('PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD are required');
  }

  console.log(`[setup] connecting to ${baseUrl}`);
  await waitForHealth(baseUrl);
  const token = await superuserToken(baseUrl, email, password);
  console.log('[setup] superuser authenticated');

  // towns first - other collections relate to it
  if (!(await collectionExists(baseUrl, token, 'towns'))) {
    await createCollection(baseUrl, token, {
      name: 'towns',
      type: 'base',
      listRule: PUBLIC,
      viewRule: PUBLIC,
      createRule: PUBLIC,
      updateRule: PUBLIC,
      deleteRule: PUBLIC,
      fields: [
        text('town_id', { required: true }),
        text('town_name', { required: true }),
        number('latitude', { required: true }),
        number('longitude', { required: true }),
        text('max_bounds'),
        text('welcome_message'),
        select('app_type', ['transit', 'fishing', 'travel'], { required: true }),
        url('tunnel_url'),
        json('settings'),
      ],
    });
  }

  const townsId = (await api(baseUrl, token, 'GET', '/api/collections?page=1&perPage=500')).body.items.find((c) => c.name === 'towns').id;

  if (!(await collectionExists(baseUrl, token, 'users'))) {
    await createCollection(baseUrl, token, {
      name: 'users',
      type: 'auth',
      listRule: PUBLIC,
      viewRule: PUBLIC,
      createRule: PUBLIC,
      updateRule: 'id = @request.auth.id',
      deleteRule: 'id = @request.auth.id',
      options: {
        authRule: '',
        manageRule: 'id = @request.auth.id',
        passwordAuth: { enabled: true, identityFields: ['email'] },
      },
      fields: [
        text('name', { required: true }),
        select('role', ['passenger', 'driver', 'admin'], { required: true }),
        text('phone'),
        select('preferred_language', ['es', 'en', 'maya']),
        file('avatar'),
      ],
    });
  }

  // Create in dependency order so relations can reference existing collections.
  await ensureCollection(baseUrl, token, {
    name: 'drivers',
    fields: [
      relation('town', townsId, { required: true }),
      text('name'),
      select('vehicle_type', ['mototaxi', 'bus'], { required: true }),
      text('license_plate', { required: true }),
      number('latitude', { required: true, min: -90, max: 90 }),
      number('longitude', { required: true, min: -180, max: 180 }),
      number('heading', { min: 0, max: 360 }),
      number('speed', { min: 0 }),
      select('status', ['available', 'busy', 'offline'], { required: true }),
      number('rating', { min: 0, max: 5 }),
    ],
  });

  const usersId = await resolveId(baseUrl, token, 'users');
  const driversId = await resolveId(baseUrl, token, 'drivers');

  // users may have been created before the custom fields existed.
  await ensureFields(baseUrl, token, 'users', [
    select('role', ['passenger', 'driver', 'admin'], { required: true }),
    text('phone'),
    select('preferred_language', ['es', 'en', 'maya']),
  ]);

  // Driver records are only managed by the user linked via the `user` field
  // (created through the invite-code-gated /api/rtm/register-driver hook).
  await ensureRules(baseUrl, token, 'drivers', {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: '@request.auth.id != "" && user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
  });

  // Ride-request fields added to the existing drivers collection when missing.
  await ensureFields(baseUrl, token, 'drivers', [
    relation('user', usersId),
    { name: 'on_duty', type: 'bool' },
    { name: 'is_full', type: 'bool' },
    { name: 'route', type: 'text' },
  ]);

  // Ride requests (transit apps): a pending pickup shown to on-duty drivers.
  await ensureCollection(baseUrl, token, {
    name: 'ride_requests',
    fields: [
      relation('town', townsId, { required: true }),
      text('customer_name', { required: true }),
      number('customer_lat', { required: true, min: -90, max: 90 }),
      number('customer_lng', { required: true, min: -180, max: 180 }),
      number('dest_lat', { min: -90, max: 90 }),
      number('dest_lng', { min: -180, max: 180 }),
      text('destination'),
      select('status', ['pending', 'completed', 'cancelled'], { required: true }),
    ],
  });

  // Destination is optional for customers (they can request without one).
  await ensureFields(baseUrl, token, 'ride_requests', [
    number('dest_lat'),
    number('dest_lng'),
    // App isolation: each transit app only sees requests for its own
    // vehicle type (bus.yucatanmx.com = bus, moto.yucatanmx.com = mototaxi).
    select('vehicle_type', ['mototaxi', 'bus']),
    // Stamp the creation time so a cron can expire pending requests that a
    // customer abandoned (TRANSIT_MAX_WAIT_TIME). Old requests without this
    // field get no timestamp and are left alone.
    autodate('created', { onCreate: true }),
  ]);

  await ensureCollection(baseUrl, token, {
    name: 'vessels',
    fields: [
      relation('town', townsId, { required: true }),
      text('vessel_name', { required: true }),
      select('vessel_type', ['panga', 'boat', 'yacht'], { required: true }),
      text('registration_number', { required: true }),
      number('latitude', { required: true, min: -90, max: 90 }),
      number('longitude', { required: true, min: -180, max: 180 }),
      number('heading', { min: 0, max: 360 }),
      number('speed', { min: 0 }),
      select('status', ['fishing', 'returning', 'docked', 'emergency'], { required: true }),
      number('crew_size', { min: 0 }),
    ],
  });

  const vesselsId = await resolveId(baseUrl, token, 'vessels');

  await ensureCollection(baseUrl, token, {
    name: 'hidden_gems',
    fields: [
      relation('town', townsId, { required: true }),
      relation('driver', driversId),
      relation('vessel', vesselsId),
      text('title', { required: true }),
      text('description', { required: true }),
      number('latitude', { required: true, min: -90, max: 90 }),
      number('longitude', { required: true, min: -180, max: 180 }),
      file('image'),
      select('rarity', ['common', 'rare', 'legendary'], { required: true }),
      select('category', ['food', 'nature', 'culture', 'adventure', 'relaxation']),
    ],
  });

  const hiddenGemsId = await resolveId(baseUrl, token, 'hidden_gems');

  await ensureCollection(baseUrl, token, {
    name: 'attractions',
    fields: [
      relation('town', townsId, { required: true }),
      relation('hidden_gem', hiddenGemsId),
      text('name', { required: true }),
      select('type', ['olmec', 'pyramid', 'cenote', 'church', 'museum', 'park', 'monument'], { required: true }),
      text('icon'),
      number('latitude', { required: true, min: -90, max: 90 }),
      number('longitude', { required: true, min: -180, max: 180 }),
      text('description'),
      number('proximity_radius', { min: 0 }),
    ],
  });

  await ensureCollection(baseUrl, token, {
    name: 'network_stats',
    fields: [
      relation('town', townsId, { required: true }),
      number('active_drivers', { min: 0 }),
      number('active_vessels', { min: 0 }),
      number('hidden_gems_count', { min: 0 }),
      number('total_users', { min: 0 }),
      json('system_info'),
    ],
  });

  // Live presence: one transient record per open app tab. Clients beat their
  // own session (create once, then update) and a pb_hooks cron prunes stale
  // rows, so nothing is kept after a user leaves. Used only by the dashboard.
  await ensureCollection(baseUrl, token, {
    name: 'presence',
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: '@request.body.session_id != "" && @request.body.app_id != ""',
    updateRule: 'session_id = @request.body.session_id && @request.body.session_id != ""',
    deleteRule: PUBLIC,
    fields: [
      text('app_id', { required: true }),
      text('session_id', { required: true }),
      number('last_seen', { required: true, min: 0 }),
    ],
  });
  await ensureFields(baseUrl, token, 'presence', [
    text('app_id', { required: true }),
    text('session_id', { required: true }),
    number('last_seen', { required: true, min: 0 }),
  ]);

  // Seed this town's record (ride requests / drivers require a town relation).
  await ensureTown(baseUrl, token, {
    town_id: env('TOWN_ID', ''),
    town_name: env('TOWN_NAME', ''),
    latitude: Number(env('INITIAL_LATITUDE', '20.9674')),
    longitude: Number(env('INITIAL_LONGITUDE', '-89.5926')),
    max_bounds: env('MAX_BOUNDS', ''),
    welcome_message: env('WELCOME_MESSAGE', ''),
    app_type: env('APP_TYPE', 'transit'),
  });

  console.log('[setup] done');
}

async function ensureCollection(baseUrl, token, def) {
  if (await collectionExists(baseUrl, token, def.name)) {
    console.log(`[setup] collection "${def.name}" already exists, skipping`);
    return;
  }
  await createCollection(baseUrl, token, {
    name: def.name,
    type: 'base',
    listRule: def.listRule ?? PUBLIC,
    viewRule: def.viewRule ?? PUBLIC,
    createRule: def.createRule ?? PUBLIC,
    updateRule: def.updateRule ?? PUBLIC,
    deleteRule: def.deleteRule ?? PUBLIC,
    fields: def.fields,
  });
}

// Seed the town record for this deployment if it does not exist yet.
async function ensureTown(baseUrl, token, town) {
  if (!town.town_id) return;
  const filter = encodeURIComponent(`town_id = "${town.town_id}"`);
  const { status, body } = await api(baseUrl, token, 'GET', `/api/collections/towns/records?filter=${filter}&perPage=1`);
  if (status === 200 && body && body.items && body.items.length > 0) {
    console.log(`[setup] town "${town.town_id}" exists`);
    return;
  }
  const created = await api(baseUrl, token, 'POST', '/api/collections/towns/records', {
    town_id: town.town_id,
    town_name: town.town_name,
    latitude: town.latitude,
    longitude: town.longitude,
    max_bounds: town.max_bounds || null,
    welcome_message: town.welcome_message || null,
    app_type: town.app_type,
  });
  if (created.status !== 200) {
    throw new Error(`failed to create town "${town.town_id}": ${JSON.stringify(created.body ?? {})}`);
  }
  console.log(`[setup] created town "${town.town_id}"`);
}

// Add missing fields to an existing collection without touching the rest,
// and repair relation fields whose target collection id has drifted.
async function ensureFields(baseUrl, token, collectionName, fields) {
  const { status, body } = await api(baseUrl, token, 'GET', '/api/collections?page=1&perPage=500');
  if (status !== 200 || !body || !body.items) return;
  const coll = body.items.find((c) => c.name === collectionName);
  if (!coll) {
    console.log(`[setup] collection "${collectionName}" not found, skipping field check`);
    return;
  }
  const existingByName = new Map(coll.fields.map((f) => [f.name, f]));
  let changed = [];
  for (const want of fields) {
    const have = existingByName.get(want.name);
    if (!have) {
      coll.fields.push({ ...want, collectionId: want.collectionId || coll.id });
      changed.push(want.name);
    } else if (want.type === 'relation' && have.collectionId !== want.collectionId) {
      // PB forbids changing an existing relation target, so drop + re-add it.
      coll.fields = coll.fields.filter((f) => f.name !== want.name);
      coll.fields.push({ ...want, collectionId: want.collectionId });
      changed.push(want.name);
    } else if (want.required !== undefined && have.required !== want.required) {
      // Other field flags (e.g. required) can be updated in place.
      have.required = want.required;
      changed.push(want.name);
    }
  }
  if (changed.length === 0) {
    console.log(`[setup] collection "${collectionName}" fields up to date`);
    return;
  }
  // New fields need the collectionId stamped for the PATCH validation;
  // per-field id/collectionId are kept (PB validates they are present).
  delete coll.created;
  delete coll.updated;
  delete coll.collectionId;
  const res = await api(baseUrl, token, 'PATCH', `/api/collections/${coll.id}`, coll);
  if (res.status !== 200) {
    throw new Error(`failed to add fields to "${collectionName}": ${JSON.stringify(res.body ?? {})}`);
  }
  console.log(`[setup] updated fields on "${collectionName}": ${changed.join(', ')}`);
}

async function resolveId(baseUrl, token, name) {
  const { body } = await api(baseUrl, token, 'GET', '/api/collections?page=1&perPage=500');
  const coll = body.items.find((c) => c.name === name);
  return coll ? coll.id : '';
}

// Align collection access rules (authz) without touching its fields.
async function ensureRules(baseUrl, token, collectionName, rules) {
  const { status, body } = await api(baseUrl, token, 'GET', `/api/collections/${collectionName}`);
  if (status !== 200 || !body) {
    throw new Error(`failed to load collection "${collectionName}" for rules update`);
  }
  const coll = body;
  let changed = [];
  for (const [ruleKey, value] of Object.entries(rules)) {
    if ((coll[ruleKey] ?? '') !== (value ?? '')) {
      coll[ruleKey] = value;
      changed.push(ruleKey);
    }
  }
  if (changed.length === 0) {
    console.log(`[setup] collection "${collectionName}" rules up to date`);
    return;
  }
  delete coll.created;
  delete coll.updated;
  delete coll.collectionId;
  const res = await api(baseUrl, token, 'PATCH', `/api/collections/${coll.id}`, coll);
  if (res.status !== 200) {
    throw new Error(`failed to update rules on "${collectionName}": ${JSON.stringify(res.body ?? {})}`);
  }
  console.log(`[setup] updated rules on "${collectionName}": ${changed.join(', ')}`);
}

run().catch((err) => {
  console.error(`[setup] FAILED: ${err.message}`);
  process.exit(1);
});
