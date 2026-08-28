/**
 * Live presence heartbeat (dashboard telemetry).
 *
 * Each open app tab keeps a single transient record in the PocketBase
 * `presence` collection: created on first beat, then updated with a fresh
 * `last_seen` every ~15s. A pb_hooks cron prunes records older than 90s,
 * so nothing is retained once the tab closes - the dashboard only shows
 * who is online right now.
 *
 * No history is stored anywhere; the dashboard just counts the live rows.
 */
(function () {
  'use strict';

  const BEAT_MS = 15000;
  const SESSION_KEY = 'rtm_presence_session';
  const RECORD_KEY = 'rtm_presence_id';

  // Pages that should never announce presence.
  const SKIP_APPS = ['dashboard', 'portal', 'landing', 'hub', 'admin'];

  function deriveAppId(cfg) {
    if (cfg.APP_ID) return String(cfg.APP_ID);
    if (cfg.APP_TYPE === 'fishing') return 'fishing';
    if (cfg.TRAVEL_THEME_PARK_MODE) return 'parque';
    if (cfg.APP_TYPE === 'transit') {
      const vehicles = String(cfg.TRANSIT_VEHICLE_TYPES || '');
      return vehicles.split(',')[0] === 'mototaxi' ? 'moto' : 'bus';
    }
    return String(cfg.APP_TYPE || 'app');
  }

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : 's' + Date.now().toString(36) + Math.random().toString(36).slice(2);
        sessionStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (err) {
      return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  }

  function getRecordId() {
    try {
      return sessionStorage.getItem(RECORD_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function setRecordId(id) {
    try {
      if (id) sessionStorage.setItem(RECORD_KEY, id);
      else sessionStorage.removeItem(RECORD_KEY);
    } catch (err) {
      // storage unavailable - presence still works, just re-creates
    }
  }

  function newSession() {
    setRecordId('');
    return getSessionId();
  }

  async function request(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  function startPresence() {
    const base = String(window.APP_CONFIG.POCKETBASE_URL || '').replace(/\/+$/, '');
    const colUrl = base + '/api/collections/presence/records';
    const appId = deriveAppId(window.APP_CONFIG);

    if (SKIP_APPS.indexOf(appId) !== -1) {
      console.log(`[presence] skipped for app "${appId}"`);
      return;
    }
    if (window.APP_CONFIG.ENABLE_PRESENCE === false) {
      console.log('[presence] disabled via config');
      return;
    }

    let enabled = true;

    async function createRecord() {
      const res = await request(colUrl, 'POST', {
        app_id: appId,
        session_id: getSessionId(),
        last_seen: Math.floor(Date.now() / 1000),
      });
      if (res.status === 200 || res.status === 201) {
        if (res.body && res.body.id) setRecordId(res.body.id);
        return true;
      }
      if (res.status === 403 || res.status === 400) {
        // Rules reject this client; don't spam.
        console.warn(`[presence] create rejected (${res.status}); disabling`);
        enabled = false;
      }
      return false;
    }

    async function beat() {
      if (!enabled || document.visibilityState === 'hidden') return;
      const recordId = getRecordId();
      const lastSeen = Math.floor(Date.now() / 1000);
      if (recordId) {
        const res = await request(`${colUrl}/${recordId}`, 'PATCH', {
          session_id: getSessionId(),
          last_seen: lastSeen,
        });
        if (res.status === 200) return;
        if (res.status === 404) {
          setRecordId('');
        } else if (res.status === 403) {
          enabled = false;
        }
        await createRecord();
      } else {
        await createRecord();
      }
    }

    // First beat as soon as possible, then on an interval.
    beat();
    setInterval(beat, BEAT_MS);
    console.log(`[presence] announcing "${appId}" every ${BEAT_MS / 1000}s`);
  }

  async function boot() {
    if (window.RTM_CONFIG_READY) {
      try {
        await window.RTM_CONFIG_READY;
      } catch (err) {
        console.error('[presence] config load failed:', err);
      }
    }
    startPresence();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
