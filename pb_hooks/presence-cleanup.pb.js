// Presence housekeeping: delete presence rows whose `last_seen` is older
// than 90s. Runs every minute so the collection only ever holds tabs that
// are live right now - nothing is kept once a user leaves.
//
// Note: keep every value inline inside the handler; top-level consts are
// not visible when PB executes cron handlers in a fresh JSVM context.

cronAdd('presence-cleanup', '*/1 * * * *', () => {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 90;
    const stale = $app.findRecordsByFilter(
      'presence',
      'last_seen < {:cutoff}',
      '',
      0,
      0,
      { cutoff }
    );
    let deleted = 0;
    for (const record of stale) {
      $app.delete(record);
      deleted++;
    }
    if (deleted > 0) {
      console.log(`[presence-cleanup] pruned ${deleted} stale presence record(s)`);
    }
  } catch (err) {
    console.error('[presence-cleanup] error:', err.message);
  }
});

// Driver expiry: any driver whose phone has been inactive for more than 90
// days is dropped from the list. "Inactive" means last_active is older than
// the cutoff (last_active is stamped on registration, on app open, and on every
// position publish). Both the drivers record and its linked users auth record
// are removed so the phone is fully deregistered.
cronAdd('driver-expiry', '0 3 * * *', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  try {
    const cutoff = Date.now() - 90 * DAY_MS;
    const stale = $app.findRecordsByFilter(
      'drivers',
      'last_active > 0 && last_active < {:cutoff}',
      '',
      0,
      0,
      { cutoff }
    );
    let deleted = 0;
    for (const driver of stale) {
      const userId = driver.get('user');
      $app.delete(driver);
      deleted++;
      if (userId) {
        try {
          $app.delete($app.findRecordById('users', userId));
        } catch (err) {
          // user already gone; fine
        }
      }
    }
    if (deleted > 0) {
      console.log(`[driver-expiry] removed ${deleted} inactive driver(s)`);
    }
  } catch (err) {
    console.error('[driver-expiry] error:', err.message);
  }
});

// Pending-request expiry: any ride_request left stuck in status="pending"
// for longer than TRANSIT_MAX_WAIT_TIME (minutes) is auto-cancelled so it
// drops off every driver's map. Expiry is HEARTBEAT-based: a waiting
// customer's phone re-PATCHes its request (customer_lat/lng) on every GPS
// tick, which bumps `updated`. So an actively-waiting request NEVER expires
// no matter how long the customer waits; only requests whose phone went
// silent for TRANSIT_MAX_WAIT_TIME minutes (tab closed/crashed) are cleaned.
cronAdd('pending-request-expiry', '*/1 * * * *', () => {
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

  try {
    let waitMin = 15;
    const envText = readText('/config.env');
    if (envText) {
      const m = envText.match(/^TRANSIT_MAX_WAIT_TIME\s*=\s*"?(\d+)"?/m);
      if (m) waitMin = parseInt(m[1], 10);
    }
    const cutoffMs = Date.now() - waitMin * 60 * 1000;
    // NOTE: must use "YYYY-MM-DD HH:MM:SS.mmmZ" (space, not ISO "T").
    // PocketBase does not parse the ISO T-format in filters and falls back
    // to a string comparison where ' ' < 'T', which made EVERY pending
    // request on the same day match as stale and get cancelled instantly.
    const cutoff = new Date(cutoffMs).toISOString().replace('T', ' ');
    const stale = $app.findRecordsByFilter(
      'ride_requests',
      'status = "pending" && updated < {:cutoff}',
      '',
      0,
      0,
      { cutoff }
    );
    let changed = 0;
    for (const request of stale) {
      request.set('status', 'cancelled');
      $app.save(request);
      changed++;
    }
    if (changed > 0) {
      console.log(`[pending-request-expiry] cancelled ${changed} stale pending request(s)`);
    }
  } catch (err) {
    console.error('[pending-request-expiry] error:', err.message);
  }
});

// Duty reset: any driver whose heartbeat (last_active) is older than a couple
// of minutes but is still flagged on_duty is flipped back to offline. This
// stops a driver who closed the app (or lost the phone) from showing up as a
// live "available" marker on customers' maps. The 45s client-side stale sweep
// hides them visually, but this clears the underlying DB flag too.
cronAdd('duty-reset', '*/1 * * * *', () => {
  try {
    // Locked-in model: drivers stay on duty until they cancel; this long
    // window only reaps devices that have been silent for hours.
    const cutoff = Date.now() - 240 * 60 * 1000;
    const stale = $app.findRecordsByFilter(
      'drivers',
      'on_duty = true && last_active > 0 && last_active < {:cutoff}',
      '',
      0,
      0,
      { cutoff }
    );
    let changed = 0;
    for (const driver of stale) {
      driver.set('on_duty', false);
      driver.set('status', 'offline');
      $app.save(driver);
      changed++;
    }
    if (changed > 0) {
      console.log(`[duty-reset] took ${changed} stale driver(s) off duty`);
    }
  } catch (err) {
    console.error('[duty-reset] error:', err.message);
  }
});
