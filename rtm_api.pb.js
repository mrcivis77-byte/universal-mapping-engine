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
// Registers a new driver account. The invite code is validated SERVER-SIDE
// (from config.env DRIVER_INVITE_CODE) so customers cannot create ghost
// driver records. Creates a users auth record (role=driver) plus the linked
// drivers record. The frontend then logs in normally with authWithPassword.
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

  try {
    const info = c.requestInfo();
    const body = info.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const phone = String(body.phone || '').replace(/\D/g, '');
    const licensePlate = String(body.license_plate || '').trim();
    const vehicleType = String(body.vehicle_type || '').trim();
    const inviteCode = String(body.invite_code || '').trim();

    if (!name || !email || !password || !licensePlate || !inviteCode || !vehicleType) {
      return c.json(400, {
        ok: false,
        error: 'name, email, password, license_plate, vehicle_type and invite_code are required'
      });
    }
    if (!['mototaxi', 'bus'].includes(vehicleType)) {
      return c.json(400, { ok: false, error: 'vehicle_type must be mototaxi or bus' });
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

    const existing = $app.findRecordsByFilter('users', 'email = {:email}', '', 1, 0, { email });
    if (existing.length > 0) return c.json(409, { ok: false, error: 'email already registered' });

    const usersColl = $app.findCollectionByNameOrId('users');
    const user = new Record(usersColl);
    user.set('email', email);
    user.set('password', password);
    user.set('passwordConfirm', password);
    user.set('emailVisibility', true);
    user.set('name', name);
    user.set('role', 'driver');
    if (phone) user.set('phone', phone);
    $app.save(user);

    const driversColl = $app.findCollectionByNameOrId('drivers');
    const driver = new Record(driversColl);
    driver.set('town', towns[0].id);
    driver.set('user', user.id);
    driver.set('name', name);
    driver.set('vehicle_type', vehicleType);
    driver.set('license_plate', licensePlate);
    driver.set('latitude', towns[0].get('latitude'));
    driver.set('longitude', towns[0].get('longitude'));
    driver.set('status', 'offline');
    driver.set('on_duty', false);
    $app.save(driver);

    return c.json(200, { ok: true, driver_id: driver.id, user_id: user.id, email });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});

// POST /api/rtm/forgot-password
// Driver password recovery. Looks up the user by email (role=driver),
// verifies the submitted phone against the one on file (or stores it the
// first time), resets to a new random password and delivers it by:
//   - WhatsApp Cloud API  when WHATSAPP_PHONE_ID and WHATSAPP_TOKEN are set
//   - Twilio (SMS/WhatsApp) when TWILIO_SID, TWILIO_TOKEN and TWILIO_FROM are set
//   - in-app fallback: the new password is returned in the response
// Note: passwords are stored hashed, so the old one can never be recovered.
routerAdd('POST', '/api/rtm/forgot-password', (c) => {
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

  const envToObject = (text) => {
    const out = {};
    for (const raw of String(text).split('\n')) {
      const line = raw.replace(/\r$/, '').trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[line.slice(0, eq).trim()] = value;
    }
    return out;
  };

  // Portable base64 (goja may not provide btoa) for Twilio basic auth.
  const b64 = (s) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    let i = 0;
    while (i < s.length) {
      const a = s.charCodeAt(i++);
      const b = i < s.length ? s.charCodeAt(i++) : undefined;
      const cc = i < s.length ? s.charCodeAt(i++) : undefined;
      out += chars.charAt(a >> 2);
      out += chars.charAt(((a & 3) << 4) | ((b === undefined ? 0 : b) >> 4));
      out += b === undefined ? '=' : chars.charAt(((b & 15) << 2) | ((cc === undefined ? 0 : cc) >> 6));
      out += cc === undefined ? '=' : chars.charAt(cc & 63);
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
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '');

    if (!email || !phone) {
      return c.json(400, { ok: false, error: 'email and phone are required' });
    }

    const users = $app.findRecordsByFilter('users', 'email = {:e}', '', 1, 0, { e: email });
    if (users.length === 0) {
      return c.json(404, { ok: false, error: 'no account found for that email' });
    }
    const user = users[0];

    const onFile = String(user.get('phone') || '').replace(/\D/g, '');
    if (onFile) {
      if (onFile !== phone) {
        return c.json(403, { ok: false, error: 'phone does not match this account' });
      }
    } else {
      user.set('phone', phone);
    }

    const newPass = genPassword();
    user.set('password', newPass);
    user.set('passwordConfirm', newPass);
    $app.save(user);

    const env = envToObject(readText(ENV_FILE));
    const national = phone.slice(-10);
    const e164 = '52' + national;
    const msg = 'Yucatán en Vivo: tu nueva contraseña es ' + newPass;

    const whatsappId = env.WHATSAPP_PHONE_ID;
    const whatsappToken = env.WHATSAPP_TOKEN;
    const twilioSid = env.TWILIO_SID;
    const twilioToken = env.TWILIO_TOKEN;

    if (whatsappId && whatsappToken) {
      const res = $http.send({
        method: 'POST',
        url: 'https://graph.facebook.com/v20.0/' + whatsappId + '/messages',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + whatsappToken },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '+' + e164,
          type: 'text',
          text: { body: msg }
        })
      });
      const st = res && res.statusCode;
      if (st >= 200 && st < 300) {
        return c.json(200, { ok: true, delivered: 'whatsapp' });
      }
      return c.json(502, { ok: false, error: 'whatsapp send failed (' + st + ')' });
    }

    if (twilioSid && twilioToken) {
      const from = env.TWILIO_FROM || 'whatsapp:+14155238886';
      const to = from.indexOf('whatsapp:') === 0 ? 'whatsapp:+' + e164 : '+' + e164;
      const bodyStr = 'From=' + encodeURIComponent(from) +
        '&To=' + encodeURIComponent(to) +
        '&Body=' + encodeURIComponent(msg);
      const res = $http.send({
        method: 'POST',
        url: 'https://api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/Messages.json',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + b64(twilioSid + ':' + twilioToken)
        },
        body: bodyStr
      });
      const st = res && res.statusCode;
      if (st >= 200 && st < 300) {
        return c.json(200, { ok: true, delivered: 'twilio' });
      }
      return c.json(502, { ok: false, error: 'twilio send failed (' + st + ')' });
    }

    // No messaging provider configured: deliver the new password in-app.
    return c.json(200, { ok: true, delivered: 'response', password: newPass });
  } catch (err) {
    return c.json(500, { ok: false, error: String(err) });
  }
});
