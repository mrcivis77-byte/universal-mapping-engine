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
    { id: 'fishing', color: '#0ea5e9' },
    { id: 'parque', color: '#10b981' },
  ];

  const counts = {};

  function t(key) {
    return window.i18n ? window.i18n.t('dashboard.' + key) : key;
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
      card.innerHTML =
        '<div class="app-card-head"><span class="dot"></span>' +
        `<span class="app-name">${t('app_' + app.id)}</span></div>` +
        `<div class="app-count">${n}</div>` +
        `<div class="app-status">${n === 0 ? t('offline') : t('online')}</div>`;
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
