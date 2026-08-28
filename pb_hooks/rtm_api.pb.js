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
    const inviteCode = String(body.invite_code || '').trim();
    const vehicleType = String(body.vehicle_type || '').trim();

    if (!name || !phone || !inviteCode || !vehicleType) {
      return c.json(400, {
        ok: false,
        error: 'name, phone, invite_code and vehicle_type are required'
      });
    }

    if (phone.length !== 10) {
      return c.json(400, { ok: false, error: 'phone must be a 10-digit number' });
    }

    if (!['mototaxi', 'bus', 'drive'].includes(vehicleType)) {
      return c.json(400, { ok: false, error: 'vehicle_type must be mototaxi, bus or drive' });
    }

    const env = envToObject(parseEnv(readText(ENV_FILE) || ''));
    const expectedCode = env.DRIVER_INVITE_CODE || 'TracKer';
    if (inviteCode !== expectedCode) {
      return c.json(403, { ok: false, error: 'invalid invite code' });
    }

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

    return c.json(200, {
      ok: true,
      driver_id: driver.id,
      user_id: user.id,
      email: issuedEmail,
      password: newPass,
      phone
    });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});
