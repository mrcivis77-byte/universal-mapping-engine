/**
 * Central runtime configuration for the RTM frontend.
 *
 * Loads pb_public/config.json (generated from config.env by the nginx
 * entrypoint at boot) and merges it over sensible defaults. Everything is
 * exposed on window.APP_CONFIG. Async code can await window.RTM_CONFIG_READY
 * before reading the merged values.
 */
(function () {
  const DEFAULTS = {
    APP_TYPE: 'transit',
    TOWN_NAME: 'Chelem-Chuburna-Progreso, Yucatan',
    TOWN_ID: 'chelem_chuburna_progreso',
    TIMEZONE: 'America/Merida',
    INITIAL_LATITUDE: 21.235,
    INITIAL_LONGITUDE: -89.705,
    MAP_ZOOM_LEVEL: 13,
    MAX_BOUNDS: '21.1300,-89.8300,21.3400,-89.5800',
    WELCOME_MESSAGE: 'Welcome to the Chelem-Chuburna-Progreso coast! Fresh seafood and beach vibes await.',
    PUBLIC_URL: '',
    API_BASE_URL: '',
    CENTRAL_REGISTRY_URL: 'https://yucatanmx.com',
    LANGUAGES: 'es,en',
    TRANSIT_VEHICLE_TYPES: 'mototaxi,bus',
    TRANSIT_MAX_WAIT_TIME: 15,
    FISHING_VESSEL_TYPES: 'panga,boat,yacht',
    FISHING_ZONES: 'coastal,deep,lagoon',
    TRAVEL_PROXIMITY_RADIUS: 5000,
    TRAVEL_THEME_PARK_MODE: false,
    CULTURAL_LANDMARKS: [],
    MAP_TILE_PROVIDER: 'cartodb_voyager',
    DEFAULT_LANGUAGE: 'es',
    ENABLE_CROSS_COUNTRY_HANDOFF: true,
    ENABLE_HIDDEN_GEMS: true,
    ENABLE_PROXIMITY_ALERTS: true,
    ENABLE_REALTIME_SYNC: true,
    GPS_UPDATE_INTERVAL: 5000,
    MAP_SYNC_INTERVAL: 2000,
    MAX_DRIVERS_DISPLAY: 50,
    MAX_GEMS_DISPLAY: 100,
    ALLOW_ANONYMOUS_ACCESS: true,
    RATE_LIMIT_REQUESTS: 100
  };

  function applyDerived(cfg) {
    // Bounds array helper: [sw_lat, sw_lng, ne_lat, ne_lng]
    if (typeof cfg.MAX_BOUNDS === 'string') {
      cfg.MAX_BOUNDS_ARRAY = cfg.MAX_BOUNDS.split(',').map(Number);
    }

    // CULTURAL_LANDMARKS may arrive as a JSON string from the env file
    if (typeof cfg.CULTURAL_LANDMARKS === 'string') {
      try {
        cfg.CULTURAL_LANDMARKS = JSON.parse(cfg.CULTURAL_LANDMARKS);
      } catch (err) {
        console.warn('[config] invalid CULTURAL_LANDMARKS, ignoring:', err.message);
        cfg.CULTURAL_LANDMARKS = [];
      }
    }
    if (!Array.isArray(cfg.CULTURAL_LANDMARKS)) {
      cfg.CULTURAL_LANDMARKS = [];
    }

    // PocketBase SDK base URL: empty string = same origin (nginx /api proxy)
    cfg.POCKETBASE_URL = cfg.API_BASE_URL ? String(cfg.API_BASE_URL).replace(/\/+$/, '') : '';

    // Every node on the network is identified by its town id
    cfg.nodeId = cfg.TOWN_ID;
  }

  async function loadRemote() {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`config.json ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[config] could not load /config.json, using defaults:', err.message);
      return {};
    }
  }

  window.APP_CONFIG = Object.assign({}, DEFAULTS);
  applyDerived(window.APP_CONFIG);

  window.RTM_CONFIG_READY = loadRemote().then((raw) => {
    Object.assign(window.APP_CONFIG, raw);
    applyDerived(window.APP_CONFIG);
    console.log('[config] ready:', window.APP_CONFIG.TOWN_NAME, `(${window.APP_CONFIG.APP_TYPE})`);
  }).catch((err) => {
    console.error('[config] load failed:', err);
  });
})();
