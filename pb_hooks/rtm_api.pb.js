// RTM custom API endpoints, served by the local PocketBase instance.
//
//   GET  /api/rtm/health     - liveness + identity of this town node
//   GET  /api/rtm/combined   - cross-app snapshot (drivers, vessels,
//                              hidden_gems, attractions) for a town
//   GET  /api/rtm/config     - current frontend config (from config.json)
//   POST /api/rtm/config     - merge partial JSON config; persists to
//                              config.json and best-effort into config.env
//
// Field lists are explicit per collection so the combined payload stays
// stable regardless of how the admin UI evolves the schema.
//
// PocketBase JSVM constraint: request handlers run in an isolated context and
// do NOT see top-level file bindings (const/var/function). Every handler must
// therefore be fully self-contained; only the runtime globals ($app, $os,
// $apis, console, c, ...) are shared.

routerAdd('GET', '/api/rtm/health', (c) => {  const ENV_FILE = '/config.env';

  const readText = (path) => {
    try {
      const bytes = $os.readFile(path);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    } catch (err) {
      return null;
    }
  };

  const parseEnv = (text) => String(text).split('\n').map((line) => ({ line: line.replace(/\r$/, '') }));

  const envToObject = (entries) => {
    const out = {};
    for (const { line } of entries) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[trimmed.slice(0, eq).trim()] = value;
    }
    return out;
  };

  try {
    const town = envToObject(parseEnv(readText(ENV_FILE) || ''));
    return c.json(200, {
      ok: true,
      town_id: town.TOWN_ID || 'unknown',
      town_name: town.TOWN_NAME || 'unknown',
      app_type: town.APP_TYPE || 'transit',
      time: new Date().toISOString()
    });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('GET', '/api/rtm/combined', (c) => {
  const FIELDS = {
    drivers: [
      'id', 'town', 'name', 'vehicle_type', 'license_plate',
      'latitude', 'longitude', 'heading', 'speed', 'status', 'rating'
    ],
    vessels: [
      'id', 'town', 'vessel_name', 'vessel_type', 'registration_number',
      'latitude', 'longitude', 'heading', 'speed', 'status', 'crew_size'
    ],
    hidden_gems: [
      'id', 'town', 'title', 'description', 'latitude', 'longitude',
      'image', 'rarity', 'category', 'created'
    ],
    attractions: [
      'id', 'town', 'name', 'type', 'icon', 'latitude', 'longitude',
      'description', 'proximity_radius'
    ]
  };

  const pick = (record, keys) => {
    const out = {};
    for (const key of keys) {
      if (record.has(key)) {
        const value = record.get(key);
        out[key] = (typeof value !== 'undefined' && value !== null) ? value : null;
      }
    }
    return out;
  };

  try {
    const info = c.requestInfo();
    const town = (info && info.query && info.query.town) ? String(info.query.town) : '';
    const result = {
      town: town || null,
      drivers: [],
      vessels: [],
      hidden_gems: [],
      attractions: []
    };

    const filter = town ? 'town = {:town}' : '';
    const params = town ? { town } : {};

    for (const name of Object.keys(FIELDS)) {
      const records = $app.findRecordsByFilter(name, filter, '', 1000, 0, params);
      result[name] = records.map((r) => pick(r, FIELDS[name]));
    }

    return c.json(200, result);
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('GET', '/api/rtm/config', (c) => {
  const ENV_FILE = '/config.env';
  const CONFIG_JSON = '/pb/pb_public/config.json';

  const readText = (path) => {
    try {
      const bytes = $os.readFile(path);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    } catch (err) {
      return null;
    }
  };

  const parseEnv = (text) => String(text).split('\n').map((line) => ({ line: line.replace(/\r$/, '') }));

  const envToObject = (entries) => {
    const out = {};
    for (const { line } of entries) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[trimmed.slice(0, eq).trim()] = value;
    }
    return out;
  };

  try {
    const raw = readText(CONFIG_JSON);
    if (raw) {
      return c.json(200, JSON.parse(raw));
    }
    const env = envToObject(parseEnv(readText(ENV_FILE) || ''));
    return c.json(200, env);
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/config', (c) => {
  const ENV_FILE = '/config.env';
  const CONFIG_JSON = '/pb/pb_public/config.json';

  const readText = (path) => {
    try {
      const bytes = $os.readFile(path);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    } catch (err) {
      return null;
    }
  };

  const writeText = (path, content) => {
    try {
      $os.writeFile(path, content, 0o644);
      return true;
    } catch (err) {
      return false;
    }
  };

  const parseEnv = (text) => String(text).split('\n').map((line) => ({ line: line.replace(/\r$/, '') }));

  const updateEnvText = (entries, updates) => {
    const updatedKeys = Object.keys(updates);
    let changed = false;

    const result = entries.map(({ line }) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const eq = trimmed.indexOf('=');
      if (eq <= 0) return line;

      const key = trimmed.slice(0, eq).trim();
      if (!updatedKeys.includes(key)) return line;

      changed = true;
      const value = String(updates[key]);
      return `${key}="${value.replace(/"/g, '\\"')}"`;
    });

    return { content: result.join('\n') + '\n', changed };
  };

  try {
    const body = c.requestInfo().body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return c.json(400, { ok: false, error: 'expected a JSON object' });
    }

    // 1. Persist to pb_public/config.json (what nginx serves).
    let config = {};
    const currentRaw = readText(CONFIG_JSON);
    if (currentRaw) {
      try {
        config = JSON.parse(currentRaw);
      } catch (err) {
        config = {};
      }
    }
    Object.assign(config, body);
    writeText(CONFIG_JSON, JSON.stringify(config, null, 2) + '\n');

    // 2. Best-effort merge into config.env so the change survives restarts.
    const envText = readText(ENV_FILE);
    if (envText !== null) {
      const entries = parseEnv(envText);
      const { content } = updateEnvText(entries, config);
      writeText(ENV_FILE, content);
    }

    return c.json(200, { ok: true, config });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

// POST /api/rtm/register-driver
// Registers a driver using just a name, phone and invite code. No passwords,
// no email, no login screen. The phone IS the identity:
//   - First time  -> creates a users auth record (role=driver) plus the linked
//                    drivers record. An auto-generated password (never shown to
//                    the driver) is returned once so the frontend can establish
//                    a persisted session (localStorage). From then on the app
//                    auto-logs-in; the driver never types credentials again.
//   - Re-register -> if a driver with this phone already exists (e.g. driver got
//                    a new phone), the existing user/driver is reused and a
//                    fresh password is issued so the new device can sign in.
// last_active is stamped so the 90-day inactivity cleanup can prune old phones.
routerAdd('POST', '/api/rtm/register-driver', (c) => {
  const ENV_FILE = '/config.env';

  const readText = (path) => {
    try {
      const bytes = $os.readFile(path);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return out;
    } catch (err) {
      return null;
    }
  };

  const parseEnv = (text) => String(text).split('\n').map((line) => ({ line: line.replace(/\r$/, '') }));

  const envToObject = (entries) => {
    const out = {};
    for (const { line } of entries) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[trimmed.slice(0, eq).trim()] = value;
    }
    return out;
  };

  const genPassword = () => {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 8; i++) {
      out += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return out + '!';
  };

  try {
    const info = c.requestInfo();
    const body = info.body || {};
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const vehicleType = String(body.vehicle_type || '').trim();

    if (!name || !phone || !vehicleType) {
      return c.json(400, {
        ok: false,
        error: 'name, phone and vehicle_type are required'
      });
    }

    if (phone.length !== 10) {
      return c.json(400, { ok: false, error: 'phone must be a 10-digit number' });
    }

    if (!['mototaxi', 'bus', 'drive', 'austed'].includes(vehicleType)) {
      return c.json(400, { ok: false, error: 'vehicle_type must be mototaxi, bus, drive or austed' });
    }

    const env = envToObject(parseEnv(readText(ENV_FILE) || ''));
    const townId = env.TOWN_ID || '';
    if (!townId) return c.json(500, { ok: false, error: 'TOWN_ID missing in config.env' });

    const towns = $app.findRecordsByFilter('towns', 'town_id = {:tid}', '', 1, 0, { tid: townId });
    if (towns.length === 0) return c.json(500, { ok: false, error: 'town not found: ' + townId });

    const now = Date.now();

    // Look up an existing driver by phone (re-registration on a new phone).
    const existingUsers = $app.findRecordsByFilter(
      'users',
      'phone = {:phone} && role = {:role}',
      '', 1, 0, { phone, role: 'driver' }
    );

    let user;
    let driver;
    let issuedEmail;
    const newPass = genPassword();

    if (existingUsers.length > 0) {
      user = existingUsers[0];
      issuedEmail = user.get('email');

      // Re-registration: refresh the password so THIS device can sign in, and
      // reuse the existing linked driver record (keeps rating/history/route).
      user.set('password', newPass);
      user.set('passwordConfirm', newPass);
      user.set('name', name);
      $app.save(user);

      const existingDrivers = $app.findRecordsByFilter('drivers', 'user = {:uid}', '', 1, 0, { uid: user.id });
      if (existingDrivers.length > 0) {
        driver = existingDrivers[0];
      } else {
        const driversColl = $app.findCollectionByNameOrId('drivers');
        driver = new Record(driversColl);
        driver.set('town', towns[0].id);
        driver.set('user', user.id);
        driver.set('name', name);
        driver.set('vehicle_type', vehicleType);
        driver.set('license_plate', 'SIN-PLACA');
        driver.set('latitude', towns[0].get('latitude'));
        driver.set('longitude', towns[0].get('longitude'));
        driver.set('status', 'offline');
        driver.set('on_duty', false);
      }
    } else {
      // Brand-new registration.
      const usersColl = $app.findCollectionByNameOrId('users');
      user = new Record(usersColl);
      issuedEmail = phone + '@driver.local';
      user.set('email', issuedEmail);
      user.set('password', newPass);
      user.set('passwordConfirm', newPass);
      user.set('emailVisibility', false);
      user.set('name', name);
      user.set('role', 'driver');
      user.set('phone', phone);
      $app.save(user);

      const driversColl = $app.findCollectionByNameOrId('drivers');
      driver = new Record(driversColl);
      driver.set('town', towns[0].id);
      driver.set('user', user.id);
      driver.set('name', name);
      driver.set('vehicle_type', vehicleType);
      driver.set('license_plate', 'SIN-PLACA');
      driver.set('latitude', towns[0].get('latitude'));
      driver.set('longitude', towns[0].get('longitude'));
      driver.set('status', 'offline');
      driver.set('on_duty', false);
    }

    driver.set('last_active', now);
    $app.save(driver);

    // Referral code (first 6 chars of the generated id, uppercased). Assigned
    // after the first save because new records only get their id on save.
    if (!driver.get('referral_code')) {
      let code = String(driver.id).slice(0, 6).toUpperCase();
      try {
        const clash = $app.findRecordsByFilter('drivers', 'referral_code = {:c}', '', 1, 0, { c: code });
        if (clash.length > 0 && clash[0].id !== driver.id) {
          code = String(driver.id).slice(9, 15).toUpperCase();
        }
      } catch (err) {}
      driver.set('referral_code', code);
      $app.save(driver);
    }

    // Referral credit: the app captures ?ref=CODE on first visit and sends it
    // here at registration. Credit the referring driver exactly once.
    const refCode = String(body.ref || '').trim().toUpperCase();
    if (refCode) {
      try {
        const referrers = $app.findRecordsByFilter('drivers', 'referral_code = {:c}', '', 1, 0, { c: refCode });
        if (referrers.length > 0 && referrers[0].id !== driver.id) {
          driver.set('referred_by', referrers[0].id);
          referrers[0].set('referral_count', (Number(referrers[0].get('referral_count')) || 0) + 1);
          $app.save(referrers[0]);
        }
      } catch (err) {}
    }

    return c.json(200, {
      ok: true,
      driver_id: driver.id,
      user_id: user.id,
      email: issuedEmail,
      password: newPass,
      phone,
      referral_code: driver.get('referral_code') || ''
    });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});
// ---------------------------------------------------------------------------
// Map icon management (theme-park community map)
//
//   GET  /api/rtm/admin-map-points   - list attractions (+icon file name)
//   POST /api/rtm/admin-set-icon     - multipart: id + icon (image upload)
//   POST /api/rtm/admin-clear-icon   - json {id}: remove custom icon
//   POST /api/rtm/admin-add-point    - json {name,type,latitude,longitude,description}
//   POST /api/rtm/admin-delete-point - json {id}
//   POST /api/rtm/admin-seed-points  - seed the default map points once
//
// All routes require x-admin-token matching ADMIN_RESET_TOKEN from /config.env.
// JSVM constraint: handlers are fully self-contained (no shared helpers).
// ---------------------------------------------------------------------------

routerAdd('GET', '/api/rtm/admin-map-points', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const records = $app.findRecordsByFilter('attractions', "id != ''", '-id', 500, 0);
    const items = records.map((r) => ({
      id: r.id,
      name: r.get('name'),
      type: r.get('type'),
      latitude: r.get('latitude'),
      longitude: r.get('longitude'),
      description: r.get('description') || '',
      icon: r.get('icon') || ''
    }));
    return c.json(200, { ok: true, items: items });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-set-icon', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const info = c.requestInfo();
    const body = info.body || {};
    const id = body.id || '';
    if (!id) return c.json(400, { ok: false, error: 'missing id' });

    let files = [];
    try { files = c.findUploadedFiles('icon') || []; } catch (err) { files = []; }
    if (!files.length) return c.json(400, { ok: false, error: 'missing icon file' });

    const record = $app.findRecordById('attractions', id);
    record.set('icon', files);
    $app.save(record);

    return c.json(200, { ok: true, id: record.id, icon: record.get('icon') });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-clear-icon', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const body = c.requestInfo().body || {};
    const id = body.id || '';
    if (!id) return c.json(400, { ok: false, error: 'missing id' });
    const record = $app.findRecordById('attractions', id);
    record.set('icon', '');
    $app.save(record);
    return c.json(200, { ok: true, id: record.id });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-add-point', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const body = c.requestInfo().body || {};
    const name = String(body.name || '').trim();
    const type = String(body.type || 'monument');
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!name) return c.json(400, { ok: false, error: 'missing name' });
    if (!isFinite(lat) || !isFinite(lng)) return c.json(400, { ok: false, error: 'bad coordinates' });

    // TOWN_ID from env file (env vars of the process may not be set)
    let envFull = envText;
    const tmm = String(envFull).match(/^TOWN_ID="?([^"\r\n]+)"?/m);
    const townId = tmm ? tmm[1] : '';
    if (!townId) return c.json(500, { ok: false, error: 'TOWN_ID not configured' });

    let town;
    try {
      town = $app.findFirstRecordByFilter('towns', 'town_id = {:tid}', { tid: townId });
    } catch (err) {
      return c.json(500, { ok: false, error: 'town record not found for ' + townId });
    }

    const collection = $app.findCollectionByNameOrId('attractions');
    const record = new Record(collection);
    record.set('town', town.id);
    record.set('name', name);
    record.set('type', type);
    record.set('latitude', lat);
    record.set('longitude', lng);
    record.set('description', String(body.description || ''));
    record.set('proximity_radius', Number(body.proximity_radius) || 3000);
    $app.save(record);

    return c.json(200, { ok: true, id: record.id });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-delete-point', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const body = c.requestInfo().body || {};
    const id = body.id || '';
    if (!id) return c.json(400, { ok: false, error: 'missing id' });
    const record = $app.findRecordById('attractions', id);
    $app.delete(record);
    return c.json(200, { ok: true });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-seed-points', (c) => {
  try {
    let envText = '';
    const bytes = $os.readFile('/config.env');
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) return c.json(401, { ok: false, error: 'unauthorized' });

    const existing = $app.findRecordsByFilter('attractions', "id != ''", '', 1, 0);
    if (existing.length > 0) {
      return c.json(200, { ok: true, seeded: 0, note: 'collection not empty' });
    }

    const tmm = String(envText).match(/^TOWN_ID="?([^"\r\n]+)"?/m);
    const townId = tmm ? tmm[1] : '';
    const town = $app.findFirstRecordByFilter('towns', 'town_id = {:tid}', { tid: townId });

    const defaults = [
      { name: 'Olmec Head Monument', type: 'olmec', latitude: 20.9794, longitude: -89.5926, description: 'Ancient Olmec colossal head sculpture', proximity_radius: 5000 },
      { name: 'Mayan Pyramid Ruins', type: 'pyramid', latitude: 20.6843, longitude: -88.5678, description: 'Ancient Mayan temple complex', proximity_radius: 5000 },
      { name: 'Sacred Cenote', type: 'cenote', latitude: 20.9680, longitude: -89.5800, description: 'Natural freshwater sinkhole', proximity_radius: 3000 },
      { name: 'Colonial Cathedral', type: 'church', latitude: 20.9674, longitude: -89.5926, description: '16th century Spanish colonial cathedral', proximity_radius: 2000 }
    ];

    const collection = $app.findCollectionByNameOrId('attractions');
    let n = 0;
    defaults.forEach((d) => {
      const r = new Record(collection);
      r.set('town', town.id);
      r.set('name', d.name);
      r.set('type', d.type);
      r.set('latitude', d.latitude);
      r.set('longitude', d.longitude);
      r.set('description', d.description);
      r.set('proximity_radius', d.proximity_radius);
      $app.save(r);
      n++;
    });
    return c.json(200, { ok: true, seeded: n });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});
// ---------------------------------------------------------------------------
// Driver admin (used by /admin.html) - these endpoints were referenced by the
// frontend but never implemented server-side.
//
//   GET  /api/rtm/admin-list-drivers    - x-admin-token header required
//   POST /api/rtm/admin-reset-password  - json {driver_id}, returns new password
// ---------------------------------------------------------------------------

routerAdd('GET', '/api/rtm/admin-list-drivers', (c) => {
  const ENV_FILE = '/config.env';

  try {
    // Auth: header must match ADMIN_RESET_TOKEN from /config.env
    let envText = '';
    const bytes = $os.readFile(ENV_FILE);
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) {
      return c.json(401, { ok: false, error: 'unauthorized' });
    }

    const drivers = $app.findRecordsByFilter('drivers', "id != ''", '-last_active', 500, 0);
    const out = [];
    drivers.forEach((d) => {
      let email = '';
      let phone = '';
      try {
        const u = $app.findRecordById('users', d.get('user'));
        email = u.get('email') || '';
        phone = u.get('phone') || '';
      } catch (err) {}
      out.push({
        id: d.id,
        name: d.get('name') || '',
        email: email,
        phone: phone,
        vehicle_type: d.get('vehicle_type') || '',
        on_duty: !!d.get('on_duty'),
        status: d.get('status') || '',
        duty_count: Number(d.get('duty_count')) || 0,
        last_hit_at: Number(d.get('last_hit_at')) || 0,
        last_active: Number(d.get('last_active')) || 0,
        referral_code: d.get('referral_code') || '',
        referred_by: d.get('referred_by') || '',
        referral_count: Number(d.get('referral_count')) || 0,
        share_count: Number(d.get('share_count')) || 0
      });
    });
    return c.json(200, { ok: true, drivers: out });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/rtm/admin-reset-password', (c) => {
  const ENV_FILE = '/config.env';

  try {
    let envText = '';
    const bytes = $os.readFile(ENV_FILE);
    for (let i = 0; i < bytes.length; i++) envText += String.fromCharCode(bytes[i]);
    const tm = String(envText).match(/^ADMIN_RESET_TOKEN="?([^"\r\n]+)"?/m);
    const expected = tm ? tm[1] : '';
    const got = (() => {
          const hh2 = c.requestInfo().headers || {};
          const raw = hh2['x_admin_token'] || hh2['x-admin-token'] || '';
          return String(Array.isArray(raw) ? (raw[0] || '') : raw).trim();
        })();
    if (!expected || got !== expected) {
      return c.json(401, { ok: false, error: 'unauthorized' });
    }

    const body = c.requestInfo().body || {};
    const driverId = String(body.driver_id || '');
    if (!driverId) return c.json(400, { ok: false, error: 'missing driver_id' });

    const driver = $app.findRecordById('drivers', driverId);
    const user = $app.findRecordById('users', driver.get('user'));

    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let newPass = '';
    for (let i = 0; i < 8; i++) {
      newPass += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    newPass += '!';

    user.set('password', newPass);
    user.set('passwordConfirm', newPass);
    $app.save(user);

    return c.json(200, {
      ok: true,
      driver_id: driver.id,
      email: user.get('email'),
      password: newPass
    });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Driver engagement
//
// One "hit" per driver per calendar day (Merida, UTC-6): when a driver turns
// ON duty and their last counted hit was on a different local day,
// duty_count is incremented server-side. Toggling on/off repeatedly cannot
// inflate it. Runs inside the standard record update API so it also covers
// the SDK PATCHes used by ride.js.
// ---------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const DAY_MS = 86400000;
  const MERIDA_OFFSET_MS = 6 * 3600000;
  const dayNum = (ms) => Math.floor((ms + MERIDA_OFFSET_MS) / DAY_MS);

  const orig = e.record.original();
  const wasOn = orig && orig.get('on_duty') === true;
  const nowOn = e.record.get('on_duty') === true;
  if (!wasOn && nowOn) {
    const now = Date.now();
    const last = Number(e.record.get('last_hit_at')) || 0;
    if (!last || dayNum(last) !== dayNum(now)) {
      e.record.set('duty_count', (Number(e.record.get('duty_count')) || 0) + 1);
      e.record.set('last_hit_at', now);
    }
  }
  return e.next();
}, 'drivers');

// POST /api/rtm/driver-share - json {driver_id}: counts share-button uses.
routerAdd('POST', '/api/rtm/driver-share', (c) => {
  try {
    const body = c.requestInfo().body || {};
    const driverId = String(body.driver_id || '');
    if (!driverId) return c.json(400, { ok: false, error: 'missing driver_id' });
    const d = $app.findRecordById('drivers', driverId);
    d.set('share_count', (Number(d.get('share_count')) || 0) + 1);
    $app.save(d);
    return c.json(200, { ok: true, share_count: Number(d.get('share_count')) || 0 });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Marketplace bidding (drive + a-usted). A customer post attracts competing
// driver offers (price + how soon they can be there). Guards below enforce
// ownership server-side because collection rules cannot traverse driver.user.
// IMPORTANT: PocketBase rebuilds the JSVM runtime between file load and hook
// execution, so NOTHING defined at file scope is visible inside a hook --
// every helper must be declared inside its own handler.
// ---------------------------------------------------------------------------

// CREATE bid: authenticated user bidding from their OWN driver profile onto an
// OPEN matching request; status forced to pending.
onRecordCreateRequest((e) => {
  const ownerOf = (driverId) => {
    try { return $app.findRecordById('drivers', driverId).getString('user'); }
    catch (err) { return ''; }
  };
  try {
    const rec = e.record;
    const driverId = rec.getString('driver');
    if (!e.auth || !driverId || ownerOf(driverId) !== e.auth.id) throw new Error('not your driver profile');

    let reqRec;
    try { reqRec = $app.findRecordById('ride_requests', rec.getString('request')); }
    catch (err) { throw new Error('unknown request'); }
    if (reqRec.getString('status') !== 'pending' || reqRec.getString('accepted_driver') !== '') {
      throw new Error('request is no longer taking bids');
    }
    let drvRec;
    try { drvRec = $app.findRecordById('drivers', driverId); }
    catch (err) { throw new Error('unknown driver'); }
    if (drvRec.getString('vehicle_type') !== reqRec.getString('vehicle_type')) {
      throw new Error('vehicle type mismatch');
    }

    rec.set('status', 'pending');
    return e.next();
  } catch (err) {
    console.log('[bid-create] rejected: ' + err.message);
    throw err;
  }
}, 'bids');

// UPDATE bid: owner only, only while still pending; protected fields restored.
onRecordUpdateRequest((e) => {
  const ownerOf = (driverId) => {
    try { return $app.findRecordById('drivers', driverId).getString('user'); }
    catch (err) { return ''; }
  };
  try {
    const rec = e.record;
    const orig = rec.original();
    if (!e.auth || !ownerOf(rec.getString('driver')) || ownerOf(rec.getString('driver')) !== e.auth.id) {
      throw new Error('not your bid');
    }
    if (orig.getString('status') !== 'pending') throw new Error('bid already resolved');
    rec.set('request', orig.getString('request'));
    rec.set('driver', orig.getString('driver'));
    rec.set('status', 'pending');
    return e.next();
  } catch (err) {
    console.log('[bid-update] rejected: ' + err.message);
    throw err;
  }
}, 'bids');

// DELETE bid: owner only (withdraw an outstanding offer).
onRecordDeleteRequest((e) => {
  const ownerOf = (driverId) => {
    try { return $app.findRecordById('drivers', driverId).getString('user'); }
    catch (err) { return ''; }
  };
  try {
    const driverId = e.record.getString('driver');
    if (!e.auth || !driverId || ownerOf(driverId) !== e.auth.id) throw new Error('not your bid');
    return e.next();
  } catch (err) {
    console.log('[bid-delete] rejected: ' + err.message);
    throw err;
  }
}, 'bids');

// Accept cascade on the REQUEST: customer sets accepted_driver -> winner's bid
// becomes accepted, all other pending bids decline. Cancel/complete declines
// leftovers. Runs AFTER save by letting e.next() persist first.
onRecordUpdateRequest((e) => {
  const res = e.next();
  try {
    const rec = e.record;
    const rid = rec.getString('id');
    const winnerId = rec.getString('accepted_driver');
    const status = rec.getString('status');
    let bids;
    if (winnerId !== '') {
      bids = $app.findRecordsByFilter('bids', 'request = {:r}', '', 0, 0, { r: rid });
    } else if (status === 'cancelled' || status === 'completed') {
      bids = $app.findRecordsByFilter('bids', 'request = {:r} && status = "pending"', '', 0, 0, { r: rid });
    } else {
      return res;
    }
    for (const b of bids) {
      const want = winnerId === ''
        ? 'declined'
        : (b.getString('driver') === winnerId ? 'accepted' : 'declined');
      if (b.getString('status') !== want) {
        b.set('status', want);
        $app.save(b);
      }
    }
  } catch (err) { console.log('[bids-cascade] ' + err); }
  return res;
}, 'ride_requests');

// ------------------------------------------------------------------
// Vehicle photo gate: a driver cannot switch from off-duty to on-duty
// until a photo of their vehicle is on file. Drivers who are already on
// duty keep updating freely so GPS ticks never break mid-shift.
onRecordUpdateRequest((e) => {
  const rec = e.record;
  if (rec.getBool('on_duty') && rec.getString('photo') === '') {
    let previouslyOn = false;
    try {
      previouslyOn = $app.findRecordById('drivers', rec.getString('id')).getBool('on_duty');
    } catch (_) { /* record vanished; let persist handle it */ }
    if (!previouslyOn) {
      throw new Error('vehicle photo required before going on duty');
    }
  }
  return e.next();
}, 'drivers');

// ------------------------------------------------------------------
// Duplicate-request cleanup: when a device creates a new pending request
// for the same vehicle type, cancel its older pending ones so stale pins
// never stack up on drivers' maps (e.g. page refreshes on old clients).
onRecordAfterCreateSuccess((e) => {
  const rec = e.record;
  const dev = rec.getString('device_id');
  if (dev === '') return;
  try {
    const older = $app.findRecordsByFilter(
      'ride_requests',
      'device_id = {:dev} && vehicle_type = {:vt} && status = "pending" && id != {:id}',
      '', 0, 0,
      { dev: dev, vt: rec.getString('vehicle_type'), id: rec.getString('id') }
    );
    for (const o of older) {
      o.set('status', 'cancelled');
      $app.save(o);
    }
  } catch (err) { console.log('[req-dedupe] ' + err); }
}, 'ride_requests');

// ------------------------------------------------------------------
// POST /api/rtm/request-action  (driver-only)
// body: { request_id, action: 'accept' | 'release' | 'complete' }
// Lets a driver take a waiting customer, put it back, or finish it.
// The pin lifecycle the drivers see depends on these transitions.
// Self-contained: no outer-scope helpers (JSVM limitation).
// ------------------------------------------------------------------
routerAdd('POST', '/api/rtm/request-action', (e) => {
  try {
    const body0 = e.requestInfo().body || {};
    // Manual auth: no $requireAuth in this JSVM and e.request.header is a
    // bridged property (not callable), so the client passes its token in the
    // JSON body instead of an Authorization header.
    const token = String(body0.token || '');
    // Full signature + expiry validation built into PocketBase:
    const authUser = $app.findAuthRecordByToken(token);
    if (!authUser || !authUser.get('id')) throw new Error('auth required');
    const uid = authUser.get('id');
    const body = e.requestInfo().body || {};
    const id = String(body.request_id || '');
    const action = String(body.action || '');
    if (!id || !action) throw new Error('missing fields');

    let drv;
    try {
      drv = $app.findFirstRecordByFilter('drivers', 'user = {:u}', { u: uid });
    } catch (err) { throw new Error('no driver profile'); }

    const rec = $app.findRecordById('ride_requests', id);

    if (action === 'accept') {
      if (rec.getString('status') !== 'pending' || rec.getString('accepted_driver') !== '') {
        throw new Error('ride already taken');
      }
      rec.set('status', 'accepted');
      rec.set('accepted_driver', drv.getString('id'));
    } else if (action === 'release') {
      if (rec.getString('accepted_driver') !== drv.getString('id')) throw new Error('not your ride');
      rec.set('status', 'pending');
      rec.set('accepted_driver', '');
    } else if (action === 'complete') {
      if (rec.getString('accepted_driver') !== drv.getString('id')) throw new Error('not your ride');
      rec.set('status', 'completed');
    } else {
      throw new Error('unknown action');
    }

    $app.save(rec);
    return e.json(200, { ok: true, status: rec.getString('status'), accepted_driver: rec.getString('accepted_driver') });
  } catch (err) {
    return e.json(400, { ok: false, error: String(err && err.message ? err.message : err) });
  }
});
