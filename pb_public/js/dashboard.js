/**
 * Live presence dashboard.
 *
 * Reads the PocketBase `presence` collection (one transient row per open app
 * tab) and shows how many people are online in each app right now. Counts
 * only rows whose `last_seen` is within the freshness window, auto-refreshes,
 * and re-renders on language change. Nothing is stored here.
 */
(function () {
  'use strict';

  const REFRESH_MS = 10000;
  const FRESH_WINDOW_SEC = 60;

  const APPS = [
    { id: 'bus', color: '#2563eb' },
    { id: 'moto', color: '#f59e0b' },
    { id: 'drive', color: '#8b5cf6' },
    { id: 'austed', color: '#ef4444' },
    { id: 'fishing', color: '#0ea5e9' },
    { id: 'parque', color: '#10b981' },
  ];

  const counts = {};

  // Transit apps get live operational stats: drivers currently on duty and
  // customers with a pending ride request, grouped per vehicle type.
  const VEHICLE_BY_APP = { bus: 'bus', moto: 'mototaxi', drive: 'drive' };
  const dutyCounts = {};
  const requestCounts = {};

  function t(key) {
    return window.i18n ? window.i18n.t('dashboard.' + key) : key;
  }

  async function fetchGrouped(base, collection, filter, field) {
    const url = `${base}/api/collections/${collection}/records?perPage=500&fields=${field}&filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${collection} request ${res.status}`);
    const data = await res.json();
    const out = {};
    for (const rec of data.items || []) {
      const v = rec[field] || '';
      out[v] = (out[v] || 0) + 1;
    }
    return out;
  }

  async function loadCounts() {
    for (const k of Object.keys(counts)) delete counts[k];
    const base = String(window.APP_CONFIG.POCKETBASE_URL || '').replace(/\/+$/, '');
    const cutoff = Math.floor(Date.now() / 1000) - FRESH_WINDOW_SEC;
    const filter = encodeURIComponent('last_seen >= ' + cutoff);
    const url = `${base}/api/collections/presence/records?perPage=500&filter=${filter}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`presence request ${res.status}`);
    const data = await res.json();
    for (const rec of data.items || []) {
      const id = rec.app_id || 'app';
      counts[id] = (counts[id] || 0) + 1;
    }

    try {
      const [duty, reqs] = await Promise.all([
        fetchGrouped(base, 'drivers', 'on_duty = true', 'vehicle_type'),
        fetchGrouped(base, 'ride_requests', 'status = "pending"', 'vehicle_type'),
      ]);
      for (const appId of Object.keys(VEHICLE_BY_APP)) {
        const v = VEHICLE_BY_APP[appId];
        dutyCounts[appId] = duty[v] || 0;
        requestCounts[appId] = reqs[v] || 0;
      }
    } catch (err) {
      console.warn('[dashboard] transit stats failed:', err.message);
    }
  }

  function render() {
    if (window.i18n) window.i18n.applyTranslations();

    const total = Object.keys(counts).reduce((sum, k) => sum + counts[k], 0);
    const totalEl = document.getElementById('total-count');
    if (totalEl) totalEl.textContent = String(total);

    const grid = document.getElementById('app-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const app of APPS) {
      const n = counts[app.id] || 0;
      const card = document.createElement('div');
      card.className = 'app-card' + (n === 0 ? ' off' : '');
      card.style.setProperty('--accent', app.color);
      const isTransit = !!VEHICLE_BY_APP[app.id];
      let subLine = '';
      if (isTransit) {
        // Split everyone currently on the app: driving, waiting for a ride,
        // or just looking. "Looking" is the remainder of the live presence
        // count after drivers and requesters (floored at 0 for the rare
        // overlap of one device counting in two categories).
        const duty = dutyCounts[app.id] || 0;
        const waiting = Math.min(requestCounts[app.id] || 0, Math.max(0, n - duty));
        const looking = Math.max(0, n - duty - waiting);
        subLine =
          `<div class="app-sub" style="font-size:13px;margin-top:6px;color:#6b7280">` +
          `${duty} ${t('on_duty')} · ${waiting} ${t('waiting')} · ${looking} ${t('looking')}</div>`;
      }
      card.innerHTML =
        '<div class="app-card-head"><span class="dot"></span>' +
        `<span class="app-name">${t('app_' + app.id)}</span></div>` +
        `<div class="app-count">${n}</div>` +
        `<div class="app-status">${n === 0 ? t('offline') : t('online')}</div>` +
        subLine;
      grid.appendChild(card);
    }

    const updated = document.getElementById('updated');
    if (updated) {
      updated.textContent = t('updated') + ' ' + new Date().toLocaleTimeString();
    }
  }

  async function refresh() {
    try {
      await loadCounts();
    } catch (err) {
      console.error('[dashboard] failed to load presence:', err);
    }
    render();
  }

  async function boot() {
    if (window.RTM_CONFIG_READY) {
      try {
        await window.RTM_CONFIG_READY;
      } catch (err) {
        console.error('[dashboard] config failed:', err);
      }
    }
    if (window.i18n && !window.i18n.currentLanguage) {
      await window.i18n.init();
    }
    document.addEventListener('languageChanged', render);
    await refresh();
    setInterval(refresh, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
