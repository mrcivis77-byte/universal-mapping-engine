/* ============================================================
   MotoTaxi Live Map — client logic
   - Connects to SocketIO namespace /mototaxi
   - Driver mode: sees customers live
   - Customer mode: sees on-duty drivers live
   - Supports phone number based driver identification
   ============================================================ */

const socket = io("socket.io");

// --- Storage keys ---
const STORAGE_KEYS = {
  USER_ID: 'mototaxi_userId',
  PHONE: 'mototaxi_phone',
  NAME: 'mototaxi_name',
  ROLE: 'mototaxi_role',
  DUTY: 'mototaxi_duty'
};

// --- Map setup (Yucalpetén / Progreso, Yucatán) ---
const map = L.map('map', { zoomControl: false }).setView([21.2822, -89.6636], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- State ---
const markers = {};
let userId = localStorage.getItem(STORAGE_KEYS.USER_ID) || ('mt_' + Math.random().toString(36).substr(2, 9));
let userRole = localStorage.getItem(STORAGE_KEYS.ROLE) || 'driver';            // 'driver' or 'customer'
let driverName = localStorage.getItem(STORAGE_KEYS.NAME) || 'Driver';
let phoneNumber = localStorage.getItem(STORAGE_KEYS.PHONE) || '';
let isOnDuty = localStorage.getItem(STORAGE_KEYS.DUTY) === 'true';
let geoWatchId = null;
let shareActive = false;
let hasRequest = false;
let lastLat = null;
let lastLng = null;
let lang = 'es';   // default: Spanish (Mayan territory)

// --- Persist user ID ---
localStorage.setItem(STORAGE_KEYS.USER_ID, userId);

// --- Role styles ---
const roleStyles = {
  driver:  { color: '#c1440e', fillColor: '#e07b3f' },
  customer:{ color: '#1f9d8a', fillColor: '#4fd1c0' }
};

// --- Icons (so customers see mototaxis clearly) ---
// Driver = mototaxi icon, Customer = person icon
const driverIcon = L.divIcon({
  className: 'mt-driver-icon',
  html: '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#c1440e,#8a2f06);border:3px solid #e0a82e;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:20px;">🛺</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20]
});

const customerIcon = L.divIcon({
  className: 'mt-customer-icon',
  html: '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1f9d8a,#0f7a6b);border:3px solid #e0a82e;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:17px;">👤</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -17]
});

const meIcon = L.divIcon({
  className: 'mt-me-icon',
  html: '<div style="width:34px;height:34px;border-radius:50%;background:radial-gradient(circle, #e0a82e, #b8860b);border:3px solid #fff;box-shadow:0 0 0 8px rgba(224,168,46,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;">★</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18]
});

const offDutyIcon = L.divIcon({
  className: 'mt-offduty-icon',
  html: '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#9ca3af,#6b7280);border:3px solid #e0a82e;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:20px;">🛺</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20]
});

// --- Translations ---
const T = {
  en: {
    driverLabel: '🛺 You are a Driver',
    customerLabel: '📱 You are a Customer',
    driverNav: 'Driver', customerNav: 'Customer',
    driverSub: 'See customers', customerSub: 'See mototaxis',
    nameLabel: 'Driver name', namePlaceholder: 'e.g. Juan',
    phoneLabel: 'Phone number', phonePlaceholder: 'e.g. 9997001529',
    dutyOn: 'On Duty: ON ✅', dutyOff: 'On Duty: OFF',
    request: '📱 Request a Mototaxi',
    shareNote: '📡 Sharing your live location',
    viewingDrivers: '👁 Viewing: Drivers (mototaxis)',
    viewingCustomers: '👁 Viewing: Customers',
    legendDriver: 'Driver / Mototaxi', legendCustomer: 'Customer', legendOff: 'Off duty',
    connecting: 'Connecting…', connected: 'Connected', offline: 'Offline',
    locationNeeded: 'Location access needed',
noLoc: '⚠️ Location unavailable',
    requestSent: 'Request sent! Nearby on-duty drivers can see you.',
driverRequest: '🚨 New ride request from a customer!',
    cancelRequest: '✖ Cancel request',
    requestCancelled: 'Request cancelled.',
    drivers: 'Drivers', customers: 'Customers',
    you: 'You',
    driver: 'Driver', customer: 'Customer', offDuty: 'Off duty',
    signedIn: 'Signed in as', phoneAuth: 'Phone Authentication',
    lang: 'es'
  },
  es: {
    driverLabel: '🛺 Eres un Conductor',
    customerLabel: '📱 Eres un Cliente',
    driverNav: 'Conductor', customerNav: 'Cliente',
    driverSub: 'Ver clientes', customerSub: 'Ver mototaxis',
    nameLabel: 'Nombre del conductor', namePlaceholder: 'ej. Juan',
    phoneLabel: 'Número de teléfono', phonePlaceholder: 'ej. 9997001529',
    dutyOn: 'En servicio: SÍ ✅', dutyOff: 'En servicio: NO',
    request: '📱 Solicitar un Mototaxi',
    shareNote: '📡 Compartiendo tu ubicación',
    viewingDrivers: '👁 Viendo: Conductores (mototaxis)',
    viewingCustomers: '👁 Viendo: Clientes',
    legendDriver: 'Conductor / Mototaxi', legendCustomer: 'Cliente', legendOff: 'Fuera de servicio',
    connecting: 'Conectando…', connected: 'Conectado', offline: 'Sin conexión',
    locationNeeded: 'Se necesita acceso a ubicación',
noLoc: '⚠️ Ubicación no disponible',
    requestSent: '¡Solicitud enviada! Los conductores en servicio cercanos pueden verte.',
driverRequest: '🚨 ¡Nueva solicitud de viaje de un cliente!',
    cancelRequest: '✖ Cancelar solicitud',
    requestCancelled: 'Solicitud cancelada.',
    drivers: 'Conductores', customers: 'Clientes',
    you: 'Tú',
    driver: 'Conductor', customer: 'Cliente', offDuty: 'Fuera de servicio',
    signedIn: 'Conectado como', phoneAuth: 'Autenticación por teléfono',
    lang: 'en'
  }
};

function tr(key) {
  return T[lang][key] !== undefined ? T[lang][key] : T.en[key];
}

// --- i18n UI ---
function applyLang() {
  document.getElementById('langBtn').textContent = lang === 'en' ? 'ES' : 'EN';
  document.getElementById('navDriverLabel').textContent = tr('driverNav');
  document.getElementById('navCustomerLabel').textContent = tr('customerNav');
  document.getElementById('navDriverSub').textContent = tr('driverSub');
  document.getElementById('navCustomerSub').textContent = tr('customerSub');
  document.getElementById('nameLabel').textContent = tr('nameLabel');
  document.getElementById('driverName').placeholder = tr('namePlaceholder');
  document.getElementById('requestBtn').textContent = tr('request');
  document.getElementById('cancelBtn').textContent = tr('cancelRequest');
  document.getElementById('shareNote').textContent = tr('shareNote');
  if (document.getElementById('phoneLabel')) {
    document.getElementById('phoneLabel').textContent = tr('phoneLabel');
    document.getElementById('phoneNumber').placeholder = tr('phonePlaceholder');
  }
  renderRoleView();
}

document.getElementById('langBtn').addEventListener('click', () => {
  lang = lang === 'en' ? 'es' : 'en';
  applyLang();
});

// --- Phone number validation ---
function isValidPhoneNumber(phone) {
  // Mexican phone number format: 10 digits, starts with 9 (mobile) or other valid prefixes
  return /^\d{10}$/.test(phone);
}

// --- Driver sign-in with phone number ---
function signInDriver() {
  const phoneInputEl = document.getElementById('phoneNumber');
  const nameInputEl = document.getElementById('driverName');
  const phone = phoneInputEl ? phoneInputEl.value.trim() : '';
  const name = nameInputEl ? nameInputEl.value.trim() : 'Driver';
  
  if (phone && !isValidPhoneNumber(phone)) {
    alert(tr('phoneLabel') + ': Ingresa un número de teléfono válido de 10 dígitos');
    return false;
  }
  
  if (phone) {
    phoneNumber = phone;
    localStorage.setItem(STORAGE_KEYS.PHONE, phone);
    userId = 'mt_' + phone;
  } else {
    // No phone number - use name-based ID
    userId = 'mt_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  
  driverName = name || 'Driver';
  localStorage.setItem(STORAGE_KEYS.NAME, driverName);
  localStorage.setItem(STORAGE_KEYS.ROLE, 'driver');
  localStorage.setItem(STORAGE_KEYS.DUTY, 'false');
  
  isOnDuty = false;
  userRole = 'driver';
  
  document.getElementById('dutyBtn').textContent = tr('dutyOff');
  document.getElementById('driverPanel').style.display = 'flex';
  document.getElementById('actionPanel').classList.add('visible');
  document.getElementById('signInPanel').classList.add('hidden');
  
  // Update UI to show signed in driver
  const signedInEl = document.getElementById('signedInDisplay');
  if (signedInEl) {
    signedInEl.textContent = tr('signedIn') + ': ' + driverName + (phoneNumber ? ' (' + phoneNumber + ')' : '');
    signedInEl.classList.remove('hidden');
  }
  
  return true;
}

// --- Mode switching ---
function setRole(role) {
  userRole = role;
  localStorage.setItem(STORAGE_KEYS.ROLE, role);
  
  document.getElementById('driverNav').classList.toggle('active', role === 'driver');
  document.getElementById('customerNav').classList.toggle('active', role === 'customer');
  document.getElementById('driverPanel').style.display = role === 'driver' ? 'flex' : 'none';
  document.getElementById('customerPanel').style.display = role === 'customer' ? 'flex' : 'none';
  document.getElementById('actionPanel').classList.add('visible');

  if (role === 'driver' && !isOnDuty) {
    document.getElementById('dutyBtn').textContent = tr('dutyOff');
  } else if (role === 'driver') {
    document.getElementById('dutyBtn').textContent = tr('dutyOn');
  }

  renderRoleView();
  clearRemoteMarkers();
  socket.emit('getLocations');  // re-fetch fresh list for the new role

  if (!geoWatchId && navigator.geolocation) startSharingLocation();
}

function renderRoleView() {
  // Update driver info display
  const signedInEl = document.getElementById('signedInDisplay');
  if (signedInEl) {
    signedInEl.textContent = tr('signedIn') + ': ' + driverName + (phoneNumber ? ' (' + phoneNumber + ')' : '');
  }
}

document.getElementById('driverNav').addEventListener('click', () => {
  if (!localStorage.getItem(STORAGE_KEYS.USER_ID) && !phoneNumber) {
    signInDriver();
  } else {
    setRole('driver');
  }
});
document.getElementById('customerNav').addEventListener('click', () => setRole('customer'));

// --- Driver name & duty ---
document.getElementById('driverName').addEventListener('input', (e) => {
  driverName = e.target.value.trim() || 'Driver';
  localStorage.setItem(STORAGE_KEYS.NAME, driverName);
  renderRoleView();
});

// Phone number input handler
const phoneInputEl = document.getElementById('phoneNumber');
if (phoneInputEl) {
  phoneInputEl.addEventListener('input', (e) => {
    // Only allow digits
    e.target.value = e.target.value.replace(/\D/g, '');
  });
}

document.getElementById('dutyBtn').addEventListener('click', () => {
  isOnDuty = !isOnDuty;
  localStorage.setItem(STORAGE_KEYS.DUTY, isOnDuty ? 'true' : 'false');
  document.getElementById('dutyBtn').textContent = isOnDuty ? tr('dutyOn') : tr('dutyOff');
  pushLocation();
});

document.getElementById('requestBtn').addEventListener('click', () => {
  if (userRole !== 'customer') return;
  if (!shareActive) {
    alert(tr('noLoc'));
    return;
  }
  hasRequest = true;
  document.getElementById('cancelBtn').style.display = 'block';
  socket.emit('rideRequest', { name: 'customer' });
  pushLocation(lastLat, lastLng);   // push updated requesting state so drivers see you
  alert(tr('requestSent'));
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  hasRequest = false;
  document.getElementById('cancelBtn').style.display = 'none';
  socket.emit('cancelRequest', { name: 'customer' });
  pushLocation(lastLat, lastLng);   // push updated requesting state so drivers stop seeing you
  alert(tr('requestCancelled'));
});

// --- Geolocation ---
function startSharingLocation() {
  if (!navigator.geolocation) {
    document.getElementById('statusText').textContent = tr('locationNeeded');
    return;
  }
  geoWatchId = navigator.geolocation.watchPosition(
    (position) => {
      shareActive = true;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      pushLocation(lat, lng);
      map.setView([lat, lng], 15, { animate: true });
    },
    (err) => {
      console.error('geo error:', err);
      document.getElementById('statusText').textContent = tr('locationNeeded');
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function pushLocation(lat, lng) {
  // Use the last known position if none is passed (e.g. when toggling duty)
  if (lat && lng) {
    lastLat = lat;
    lastLng = lng;
  }
  if (!lastLat || !lastLng) return;

  const displayName = phoneNumber ? driverName + ' (' + phoneNumber + ')' : driverName;
  const data = {
    id: userId,                       // stable ID keeps identity across reconnects
    lat: lastLat,
    lng: lastLng,
    role: userRole,
    onDuty: userRole === 'driver' ? isOnDuty : false,
    requesting: userRole === 'customer' ? hasRequest : false,
    name: userRole === 'driver' ? displayName : null,
    phone: phoneNumber || null        // include phone number for identification
  };
  socket.emit('updateLocation', data);

  // Render your own marker so every user can see themselves on the map.
  const isSelfDriver = userRole === 'driver';

  // A driver who is OFF duty should disappear entirely (no gray marker).
  if (isSelfDriver && !isOnDuty) {
    if (markers[userId]) {
      markers[userId].remove();
      delete markers[userId];
    }
    return;
  }

  const selfIcon = isSelfDriver ? driverIcon : customerIcon;
  if (markers[userId]) {
    markers[userId].setLatLng([lastLat, lastLng]);
    markers[userId].setIcon(selfIcon);
  } else {
    markers[userId] = L.marker([lastLat, lastLng], { icon: selfIcon }).addTo(map);
  }
  markers[userId].role = userRole;
  markers[userId].onDuty = isOnDuty;
  markers[userId].requesting = hasRequest;
  const selfLabel = isSelfDriver
    ? `<b>🛺 ${displayName}</b><br>${isOnDuty ? tr('dutyOn') : tr('dutyOff')}`
    : `<b>👤 ${tr('you')}</b>`;
  markers[userId].bindPopup(selfLabel);
}

// --- Socket handlers ---
socket.on('connect', () => {
  document.getElementById('statusDot').className = 'status-dot connected';
  document.getElementById('statusText').textContent = tr('connected');
  // Always re-publish our identity/state on every (re)connect so that
  // going to the background (Facebook, phone call) and coming back does
  // not drop the driver's duty or the customer's active request.
  pushLocation();
});

// When the user returns to this tab, re-publish our state immediately.
// Some mobile browsers fully suspend background tabs, causing the socket
// to reconnect; this makes sure we restore on-duty / active-request state.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    pushLocation();
    socket.emit('getLocations');
  }
});

socket.on('connect_error', () => {
  document.getElementById('statusDot').className = 'status-dot offline';
  document.getElementById('statusText').textContent = tr('offline');
});

socket.on('rideRequest', (data) => {
  // No acknowledgment needed. The requesting customer's icon already
  // appears automatically on the driver's map via the locationUpdate stream.
});

socket.on('locationUpdate', (allLocations) => {
  // Determine which markers this user should see.
  //  - Driver mode: see only customers who are REQUESTING a ride
  //  - Customer mode: see only on-duty mototaxis (drivers)
  const viewingRole = userRole === 'driver' ? 'customer' : 'driver';

  // Remove markers that are no longer relevant (wrong role, off duty,
  // customer not requesting, or gone)
  Object.keys(markers).forEach(function(key) {
    if (key === userId) return;
    const loc = allLocations.find(function(l) { return l.id === key; });
    const shouldHide = !loc ||
      loc.role !== viewingRole ||                 // not the role we're viewing
      (loc.role === 'driver' && loc.onDuty === false) || // off-duty drivers hidden
      (loc.role === 'customer' && !loc.requesting);      // non-requesting customers hidden
    if (shouldHide) {
      markers[key].remove();
      delete markers[key];
    }
  });

  allLocations.forEach(function(loc) {
    if (loc.id === userId) return;
    // Only show the role this user is viewing
    if (loc.role !== viewingRole) return;
    // Off-duty drivers never appear
    if (loc.role === 'driver' && loc.onDuty === false) return;
    // Customers only appear on the driver's map while REQUESTING a ride
    if (loc.role === 'customer' && !loc.requesting) return;

    const isDriver = loc.role === 'driver';
    const icon = isDriver ? driverIcon : customerIcon;

    const driverLabel = isDriver ? (loc.name || tr('driver')) : '';
    const label = isDriver
      ? `<b>🛺 ${driverLabel}</b><br>${tr('dutyOn')}`
      : `<b>👤 ${tr('customer')}</b><br>🚨 ${tr('request')}`;

    if (markers[loc.id]) {
      markers[loc.id].setLatLng([loc.lat, loc.lng]);
      markers[loc.id].setIcon(icon);
      markers[loc.id].bindPopup(label);
    } else {
      markers[loc.id] = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      markers[loc.id].bindPopup(label);
    }
    markers[loc.id].role = loc.role;
    markers[loc.id].onDuty = loc.onDuty;
    markers[loc.id].requesting = loc.requesting;
  });

  renderRoleView();
});

// --- Filter markers when switching mode ---
function clearRemoteMarkers() {
  Object.keys(markers).forEach(function(key) {
    if (key !== userId) {
      markers[key].remove();
      delete markers[key];
    }
  });
}

// Re-request full list whenever we change role
setRole('driver');
applyLang();

window.addEventListener('beforeunload', () => {
  socket.disconnect();
  if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
});

// Sign in button handler
document.getElementById('signInBtn').addEventListener('click', function() {
  signInDriver();
});
