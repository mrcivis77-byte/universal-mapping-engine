const socket = io('/');
let lang = 'es';
let userRole = 'customer';
let driverName = '';
let isOnDuty = false;

const T = {
  en: { driverNav: 'Driver', customerNav: 'Customer', driverSub: 'See customers', customerSub: 'See mototaxis', dutyOn: 'On Duty', dutyOff: 'Off Duty', request: 'Request Ride', cancel: 'Cancel' },
  es: { driverNav: 'Conductor', customerNav: 'Cliente', driverSub: 'Ver clientes', customerSub: 'Ver mototaxis', dutyOn: 'En Servicio', dutyOff: 'Fuera de Servicio', request: 'Solicitar', cancel: 'Cancelar' }
};

function tr(k) { return T[lang][k] || k; }

function updateLangButtons() {
  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = lang === 'en' ? 'ES' : 'EN';
}

function setRole(role) {
  userRole = role;
  const dNav = document.getElementById('driverNav');
  const cNav = document.getElementById('customerNav');
  const dPanel = document.getElementById('driverPanel');
  const cPanel = document.getElementById('customerPanel');
  const aPanel = document.getElementById('actionPanel');
  
  if (dNav) dNav.classList.toggle('active', role === 'driver');
  if (cNav) cNav.classList.toggle('active', role === 'customer');
  if (dPanel) dPanel.style.display = role === 'driver' ? 'flex' : 'none';
  if (cPanel) cPanel.style.display = role === 'customer' ? 'flex' : 'none';
  if (aPanel) aPanel.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', function() {
  // Language toggle
  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.textContent = 'EN';
    langBtn.addEventListener('click', function() {
      lang = lang === 'en' ? 'es' : 'en';
      updateLangButtons();
    });
  }
  
  // Bottom navigation
  const driverNav = document.getElementById('driverNav');
  const customerNav = document.getElementById('customerNav');
  
  if (driverNav) driverNav.addEventListener('click', function() { setRole('driver'); });
  if (customerNav) customerNav.addEventListener('click', function() { setRole('customer'); });
  
  // Initialize
  updateLangButtons();
  setRole('customer');
});
