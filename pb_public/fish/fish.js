(function () {
  var panels = document.querySelectorAll(".tab-panel");
  var navs   = document.querySelectorAll(".fish-bottom-nav .nav-item");
  var inited = {};
  window.GUIDE_DATA = window.GUIDE_DATA || [];
  window.__userSpecies = [];

  // PocketBase public API base. nginx routes /api/* -> backend:8090, so the
  // fishing app (served from https://fishing.yucatanmx.com/) can talk to the
  // same PocketBase that the dashboard uses. Allow a config override so the
  // unified app and the standalone fish app can share one source of truth.
  var API = (window.PB_API_BASE_URL || (location.protocol + "//" + location.hostname).replace(/\/+$/, "") || location.origin) + "/api/";
  API = API.replace(/\/+$/, "");

  // ---- i18n: Spanish (default) + English toggle (catalog in lang.js) ----
  var LANG = (window.FISH_LANG ? window.FISH_LANG : 'es');

  // HTML-escape helper (was lost during the v14 restore; every render path
  // depends on it - without it the guide grid, rules and popups all crash).
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(ch){
      var M = {"&":"&amp;","<":"&lt;",">":"&gt;"};
      M[String.fromCharCode(34)] = "&quot;";
      M[String.fromCharCode(39)] = "&#39;";
      return M[ch];
    });
  }

  function t(k){ return window.fishT ? window.fishT(k) : k; }
  function nameOf(s){ return window.fishName ? window.fishName(s) : (s ? (s.local || s.common || '') : ''); }
  function renderRules(){
    var box = document.getElementById('rules-content'); if(!box){ return; }
    var D = (window.FISH_LOCALES && (window.FISH_LOCALES[LANG] || window.FISH_LOCALES.es)) || {};
    if(!window.FISH_LOCALES){ box.innerHTML=''; return; }
    function li(item){ return '<li>'+esc(item)+'</li>'; }
    function section(tk, ik){
      var its = D[ik] || []; var h = '<details><summary>'+esc(t(tk))+'</summary><ul>';
      for(var i=0;i<its.length;i++){ h+=li(its[i]); } return h+'</ul></details>';
    }
    var out = '<h3>'+esc(t('rules_local_title'))+'</h3><ul class="rules-list">';
    var loc = D['rules_local'] || []; for(var i=0;i<loc.length;i++){ out+=li(loc[i]); } out+='</ul>';
    out += '<h3>'+esc(t('rules_federal_title'))+'</h3>';
    out += section('rules_license_title','rules_license');
    out += section('rules_limits_title','rules_limits');
    out += section('rules_spearfishing_title','rules_spearfishing');
    out += section('rules_boats_title','rules_boats');
    box.innerHTML = out;
  }
  function applyLang(){
    LANG = window.FISH_LANG || 'es';
    if(document.documentElement){ document.documentElement.lang = LANG; }
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var k = el.getAttribute('data-i18n'), v = t(k);
      if(v===null || v===undefined){ return; }
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){ el.placeholder = v; }
      else if(el.hasAttribute('aria-label')){ el.setAttribute('aria-label', v); }
      else { el.textContent = v; }
    });
    var b = document.getElementById('lang-toggle');
    if(b){ b.textContent = (LANG==='es' ? '🌐 EN' : '🌐 ES'); b.setAttribute('aria-label', t('lang_toggle')); }
    if(inited['tab-guide']){ renderGuide(); }
    renderRules();
  }
  var _lt = document.getElementById('lang-toggle');
  if(_lt){ _lt.addEventListener('click', function(){ window.fishSetLang(LANG==='es'?'en':'es'); }); }
  document.addEventListener('fishLangChanged', applyLang);

  function show(id) {
    var key = id.replace("tab-", "");
    panels.forEach(function (p) { p.classList.toggle("active", p.id === id); });
    navs.forEach(function (n) { n.classList.toggle("active", n.dataset.tab === key); });
    initFor(id);
    // The map container may not be laid out on first paint (mobile 100vh quirk
    // / browser chrome / tile layer not yet placed), so the 250ms invalidateSize
    // alone leaves the map blank until a tab round-trip. Fire it again after the
    // tile layer has loaded (handled per-map in initSpotsMap/initShopsMap) and
    // after a longer first-paint delay + on load/resize/orientation change.
    function __invalidThisMap() {
      var mp = window.__map && window.__map[id];
      if (mp && typeof mp.invalidateSize === "function") { try { mp.invalidateSize(); } catch (e) {} }
    }
    setTimeout(__invalidThisMap, 250);
    setTimeout(__invalidThisMap, 900);
    if (document.readyState !== "complete") { window.addEventListener("load", __invalidThisMap); }
    window.addEventListener("resize", __invalidThisMap);
    window.addEventListener("orientationchange", function () { setTimeout(__invalidThisMap, 400); });
    location.hash = id;
    if (id === "tab-community") { renderLocationsList(); }
    if (window.__centerPending && window.__centerPending.tab === id) {
      var cp = window.__centerPending;
      if (window.__map && window.__map[id] && cp.lat != null) {
        var mp = window.__map[id]; mp.setView([cp.lat, cp.lng], mp.getZoom() < 13 ? 13 : mp.getZoom());
        L.popup().setLatLng([cp.lat, cp.lng]).setContent("<b>" + esc(cp.label) + "</b>").openOn(mp);
      }
      window.__centerPending = null;
    }
  }
  function start() {
    var h = location.hash.replace("#", "") || "tab-spots";
    var valid = false; panels.forEach(function (p) { if (p.id === h) valid = true; });
    var id = valid ? h : "tab-spots";
    show(id);
    return id;
  }
  navs.forEach(function (n) { n.addEventListener("click", function () { show("tab-" + n.dataset.tab); }); });
  document.querySelectorAll(".subtab-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      b.parentNode.querySelectorAll(".subtab-btn").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      renderLocationsList();
    });
  });
  window.addEventListener("hashchange", start);

  function emojiIcon(h) {
    return L.divIcon({ className: "fish-icon", html: '<span>' + h + '</span>', iconSize: [26, 26], iconAnchor: [13, 26] });
  }
  /* ---- custom map icons (split from map_icons.png asset sheet; iconSize [40,40], iconAnchor [20,20]) ---- */
  var boatAccessoriesIcon = L.icon({
    iconUrl: "images/boat-accessories-icon.png?v=1",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30]
  });
  var baitShopsIcon = L.icon({
    iconUrl: "images/bait-shops-icon.png?v=1",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30]
  });
  var toursIcon = L.icon({
    iconUrl: "images/tours-icon.png?v=1",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30]
  });
  var localGuideIcon = L.icon({
    iconUrl: "images/local-guide-icon.png?v=1",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30]
  });
  var rentalsIcon = L.icon({
    iconUrl: "images/rentals-icon.png?v=1",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -30]
  });
  function normalizePB(rec){
    return {
      pbid: rec.id, id: rec.id, key: (rec.cat ? "fish-shops-pins" : "fish-spots-pins"),
      lat: Number(rec.lat), lng: Number(rec.lng), label: rec.label || "", comment: rec.comment || "",
      cat: rec.cat || "", pub: (rec.pub === "true" || rec.pub === true), photo: rec.photo || "",
      ts: Number(rec.ts || 0), type: (rec.cat ? "shop" : "spot")
    };
  }

  /* ---------------- Offline sync (offshore mode) ----------------
   * Writes made without connectivity are stored in localStorage and
   * replayed automatically when the device comes back online. */
  var QKEY = "fish-sync-queue";
  function toast(msg){
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(120px + env(safe-area-inset-bottom));z-index:6500;background:#0f172a;color:#fff;border-radius:10px;padding:9px 14px;font-size:13px;box-shadow:0 4px 14px rgba(15,23,42,.4);max-width:88vw;text-align:center";
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3200);
  }
  function qAll(){ try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch(e){ return []; } }
  function qSave(q){ try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch(e){} }
  function netBadge(){
    var b = document.getElementById("net-badge");
    if (!b) {
      b = document.createElement("div");
      b.id = "net-badge";
      b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:5200;background:#0f172a;color:#fff;border-radius:10px;padding:7px 12px;font-size:12px;display:none;box-shadow:0 4px 14px rgba(15,23,42,.35);white-space:nowrap";
      document.body.appendChild(b);
    }
    var n = qAll().length;
    if (!navigator.onLine) { b.textContent = LOC.offline_badge; b.style.display = "block"; }
    else if (n > 0) { b.textContent = n + " · " + LOC.pending_sync; b.style.display = "block"; setTimeout(flushQueue, 1500); }
    else { b.style.display = "none"; }
  }
  function qSend(url, opts) {
    return new Promise(function (resolve, reject) {
      fetch(url, opts).then(resolve, function () {
        var q = qAll(); q.push({ url: url, opts: opts, ts: Date.now() }); qSave(q); netBadge();
        reject(new Error("offline-queued"));
      });
    });
  }
  function flushQueue() {
    if (!navigator.onLine) return;
    var q = qAll();
    if (!q.length) { netBadge(); return; }
    var entry = q[0];
    fetch(entry.url, entry.opts).then(function (r) {
      if (!r.ok && r.status >= 500) throw new Error("server");
      q.shift(); qSave(q); flushQueue();
    }).catch(function () { netBadge(); });
  }
  window.addEventListener("online", function(){ flushQueue(); });
  setInterval(flushQueue, 60000);
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) flushQueue(); });


  function addChooser(extras, catLabel, cat, onSaved){
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:6100;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center";
    var card = document.createElement("div");
    card.style.cssText = "background:#fff;border-radius:16px 16px 0 0;padding:18px;max-width:430px;width:100%";
    card.innerHTML =
      '<h3 style="margin:0 0 12px;font-size:17px;color:#0f172a">' + esc(LOC.add_choose_title) + '</h3>' +
      '<button class="ch-gps" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:8px;font-size:14px;font-weight:600;color:#0f172a"><span style="font-size:20px">\uD83D\uDCCD</span><span>' + esc(LOC.add_use_gps) + '</span></button>' +
      '<button class="ch-map" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:8px;font-size:14px;font-weight:600;color:#0f172a"><span style="font-size:20px">\uD83D\uDDFA</span><span>' + esc(LOC.add_pick_map) + '</span></button>' +
      '<button class="ch-x" style="width:100%;padding:12px;border:none;border-radius:12px;background:#f1f5f9;color:#334155;font-weight:700;font-size:14px">' + esc(LOC.loc_close) + '</button>';
    ov.appendChild(card);
    document.body.appendChild(ov);
    var close = function(){ ov.remove(); };
    ov.addEventListener("click", function(e){ if (e.target === ov) close(); });
    card.querySelector(".ch-x").onclick = close;
    card.querySelector(".ch-gps").onclick = function(){
      close();
      if (!extras.getPos() || !extras.getPos().lat) { locSheet(null); return; }
      showSaveModal(catLabel, function (comment, pub, photo) {
        extras.placeAtMe(catLabel, cat || null, comment, pub, photo);
        renderLocationsList(); if (onSaved) onSaved();
      });
    };
    card.querySelector(".ch-map").onclick = function(){
      close();
      extras.startPick(function(center){
        showSaveModal(catLabel, function (comment, pub, photo) {
          extras.placeAt(center.lat, center.lng, comment || catLabel, cat || null, comment, pub, photo);
          renderLocationsList(); if (onSaved) onSaved();
        });
      });
    };
  }

  /* ---------------- Guided location help (sheet) ---------------- */
  function locSheet(afterFix){
    var ov = document.getElementById("loc-help");
    if (!ov) {
      var st = document.createElement("style");
      st.textContent = "#loc-help{position:fixed;inset:0;z-index:6000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}" +
        ".loc-card{background:#fff;border-radius:16px 16px 0 0;padding:18px;max-width:430px;width:100%;max-height:82vh;overflow:auto}" +
        ".loc-card h3{margin:0 0 10px;font-size:17px;color:#0f172a}" +
        ".loc-step{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}" +
        ".loc-step.hot{border-color:#f59e0b;background:#fffbeb}" +
        ".loc-step b{display:block;margin-bottom:4px;font-size:14px;color:#0f172a}" +
        ".loc-step p{margin:0;font-size:13px;color:#475569;line-height:1.45}" +
        ".loc-status{font-size:13px;color:#b45309;min-height:18px;margin:6px 0 10px;font-weight:600}" +
        ".loc-btns{display:flex;gap:8px}.loc-btn{flex:1;padding:11px;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}" +
        ".loc-btn.primary{background:#2563eb;color:#fff}.loc-btn.ghost{background:#f1f5f9;color:#334155}";
      document.head.appendChild(st);
      ov = document.createElement("div"); ov.id = "loc-help"; document.body.appendChild(ov);
    }
    var android = /android/i.test(navigator.userAgent || "");
    ov.innerHTML =
      '<div class="loc-card"><h3>' + esc(LOC.loc_help_title) + "</h3>" +
      '<div class="loc-step" id="loc-step-phone"><b>' + esc(LOC.loc_step_phone) + "</b><p>" +
      esc(android ? LOC.loc_phone_android : LOC.loc_phone_ios) + "</p></div>" +
      '<div class="loc-step" id="loc-step-browser"><b>' + esc(LOC.loc_step_browser) + "</b><p>" +
      esc(android ? LOC.loc_browser_android : LOC.loc_browser_ios) + "</p></div>" +
      '<div class="loc-status" id="loc-status"></div>' +
      '<div class="loc-btns"><button class="loc-btn ghost" id="loc-close">' + esc(LOC.loc_close) + "</button>" +
      '<button class="loc-btn primary" id="loc-retry">' + esc(LOC.loc_try_again) + "</button></div></div>";
    ov.style.display = "flex";
    var close = function(){ ov.style.display = "none"; };
    ov.querySelector("#loc-close").onclick = close;
    var statusEl = ov.querySelector("#loc-status");
    var hot = function(id){ ["loc-step-phone","loc-step-browser"].forEach(function(x){
      var el = ov.querySelector("#"+x); if (el) el.classList.toggle("hot", x === id); }); };
    ov.querySelector("#loc-retry").onclick = function(){
      if (!navigator.geolocation) return;
      statusEl.textContent = "...";
      navigator.geolocation.getCurrentPosition(function(){
        var n = 0; var iv = setInterval(function(){
          if ((window.__geo && window.__geo.getPosition && window.__geo.getPosition()) || ++n > 12) {
            clearInterval(iv);
            close();
            toast(LOC.loc_found);
            if (afterFix) afterFix();
          }
        }, 500);
      }, function(err){
        if (err && err.code === 1) { statusEl.textContent = LOC.loc_status_denied_browser; hot("loc-step-browser"); }
        else { statusEl.textContent = LOC.loc_status_no_signal; hot("loc-step-phone"); }
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
    };
    ov.querySelector("#loc-retry").click();
  }
  function locBanner(){
    var today = new Date().toISOString().slice(0,10);
    setTimeout(function(){
      if (document.hidden || window.__hasFix) return;
      if (localStorage.getItem("loc_prompt_off") === today) return;
      var bar = document.createElement("div");
      bar.style.cssText = "position:fixed;top:calc(108px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:5900;background:#0f172a;color:#fff;border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-size:13px;max-width:92vw";
      bar.innerHTML = "<span style=\"flex:1\">" + esc(LOC.loc_banner) + "</span>" +
        "<button style=\"background:#2563eb;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:700;font-size:13px\">" + esc(LOC.loc_activate) + "</button>" +
        "<button style=\"background:none;color:#94a3b8;border:none;font-size:16px;padding:4px\">\u2715</button>";
      document.body.appendChild(bar);
      var autoT = setTimeout(function(){ bar.remove(); }, 8000);
      var btns = bar.querySelectorAll("button");
      btns[0].onclick = function(){ clearTimeout(autoT); bar.remove(); locSheet(null); };
      btns[1].onclick = function(){ clearTimeout(autoT); bar.remove(); localStorage.setItem("loc_prompt_off", today); };
    }, 6000);
  }

  // LOC: current-language lookup for the offline/loc strings added in lang.js.
  var LOC = {};
  function locReload(){
    var lang = (localStorage.getItem("fish-lang") || "es");
    var pack = (window.FISH_LOCALES && window.FISH_LOCALES[lang]) || (window.FISH_LOCALES && window.FISH_LOCALES.es) || {};
    ["offline_badge","pending_sync","loc_help_title","loc_step_phone","loc_phone_android","loc_phone_ios",
     "loc_step_browser","loc_browser_android","loc_browser_ios","loc_try_again","loc_close",
     "loc_status_denied_browser","loc_status_no_signal","loc_found","loc_banner","loc_activate","add_choose_title","add_use_gps","add_pick_map","pick_confirm","pick_cancel","pick_hint"].forEach(function(k){
      LOC[k] = (pack[k] !== undefined) ? pack[k] : (((window.FISH_LOCALES||{}).es||{})[k] !== undefined ? window.FISH_LOCALES.es[k] : k);
    });
  }

  function pbFetchLocations(){
    // Anonymous read from PB `locations` (public rules). Best-effort: [] on any error/404
    // so the app degrades gracefully to localStorage-only (v16 behavior) if PB is down.
    return fetch(API + "collections/locations/records?perPage=200")
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) { var out = []; (j.items || []).forEach(function (rec) { out.push(normalizePB(rec)); }); return out; })
      .catch(function () { return []; });
  }
  async function loadAllLocations(){
    try {
      var out = [];
      [{key:"fish-spots-pins",type:"spot"},{key:"fish-shops-pins",type:"shop"}].forEach(function(k){
        var arr=[]; try{arr=JSON.parse(localStorage.getItem(k.key)||"[]")}catch(e){}
        arr.forEach(function(x){ out.push({key:k.key,type:k.type,pbid:(x.pbid||null),id:x.id||(x.lat+","+x.lng+","+(x.ts||0)),label:x.label||(k.type==="spot"?"Tu punto":"Tienda"),comment:x.comment||"",pub:!!x.pub,lat:x.lat,lng:x.lng,ts:x.ts||0,cat:x.cat,photo:x.photo||""}); });
      });
      var remote = await pbFetchLocations();                  // cross-device pins (anonymous PB)
      var lkeys = {}; out.forEach(function(l){ lkeys[(l.lat+","+l.lng+","+l.ts)] = 1; });
      remote = remote.filter(function(r){ return !lkeys[(r.lat+","+r.lng+","+r.ts)]; });
      return remote.concat(out.filter(function(l){ return !l.pbid; }));  // PB authoritative for pbid pins
    } catch (e) { return []; }
  }
  async function renderLocationsList(){
    var box=document.getElementById("locations-list"); if(!box){return}
    var sub=document.querySelector("#tab-community .subtab-btn.active"); var mode=sub?sub.getAttribute("data-subtab"):"all";
    var locs=await loadAllLocations(); var f=(mode==="mine")?locs:locs.filter(function(x){return x.pub});
    if(!f.length){ box.innerHTML='<p class="loc-empty" data-i18n="'+((mode==="mine")?"locations_empty_mine":"locations_empty")+'">'+((mode==="mine")?"Aun no hay tus ubicaciones.":"Aun no hay ubicaciones publicas.")+"</p>"; applyLang(); return; }
    f.sort(function(a,b){return (b.ts||0)-(a.ts||0)});
    var h=""; f.forEach(function(x){ h+='<div class="loc-row"><div class="loc-name">'+esc(x.label)+(x.photo?'<br><img src="'+esc(x.photo)+'" class="loc-photo">':'')+'</div>'; h+='<div><button class="go-btn" title="GO">GO</button> <button class="del-btn" title="Eliminar">🗑</button></div></div>'; });
    box.innerHTML=h; var goB=box.querySelectorAll(".go-btn"); var delB=box.querySelectorAll(".del-btn");
    f.forEach(function(x,i){ goB[i].onclick=function(){ gotoLocation(x); }; delB[i].onclick=function(){ if(confirm('¿Eliminar "'+x.label+'"?')){ deleteLocation(x); } }; });
  }
  function gotoLocation(x){ var tab=(x.type==="shop"?"tab-shops":"tab-spots"); var nav=document.querySelector('[data-tab="'+tab.replace("tab-","")+'"]'); if(nav){ nav.click(); } window.__centerPending={tab:tab,label:x.label,lat:x.lat,lng:x.lng}; }
  function deleteLocation(x){
    if (x && x.pbid) { qSend(API+"collections/locations/"+encodeURIComponent(x.pbid), {method:"DELETE"}).catch(function(){}); }
    var arr=[]; try{arr=JSON.parse(localStorage.getItem(x.key||"")||"[]")}catch(e){} arr=arr.filter(function(p){ var pid=p.id||(p.lat+","+p.lng+","+(p.ts||0)); return pid!==x.id && !(p.pbid && p.pbid===x.pbid); }); try{localStorage.setItem(x.key||"",JSON.stringify(arr))}catch(e){} var _mtab=(x.type==="shop"?"tab-shops":"tab-spots"); var _ctrl=(window.__geo||{})[_mtab]; if(_ctrl&&_ctrl.removeById){_ctrl.removeById(x.id);} renderLocationsList();
  }
  function showSaveModal(label, onSave){
    var m=document.getElementById("save-modal");
    document.getElementById("save-comment").value=""; document.getElementById("save-public").checked=false;
    var photoInp=document.getElementById("save-photo"), preview=document.getElementById("save-preview");
    if(photoInp){ photoInp.value=""; if(preview){preview.innerHTML=""} }
    var photoData=null;
    if(photoInp){
      photoInp.onchange=function(){
        if(!preview){ photoData=null; return; }
        preview.innerHTML=""; photoData=null;
        var f=this.files&&this.files[0]; if(!f){return;}
        var img=document.createElement("img"); img.className="preview"; preview.appendChild(img);
        var url=URL.createObjectURL(f); img.src=url;
        img.onload=function(){ try{URL.revokeObjectURL(img.src)}catch(e){} };
        var fr=new FileReader(); fr.onload=function(ev){ photoData=ev.target.result; }; fr.readAsDataURL(f);
      };
    }
    var ph = document.getElementById("pub-hint"); if (ph) { ph.setAttribute("data-i18n","pub_hint"); ph.textContent = t('pub_hint'); }
    m.classList.add("open"); m.setAttribute("aria-hidden","false");
    function cleanup(){ m.classList.remove("open"); m.setAttribute("aria-hidden","true"); }
    document.getElementById("save-ok").onclick=function(){ var c=document.getElementById("save-comment").value.trim(); var p=document.getElementById("save-public").checked; var ph=photoData; cleanup(); onSave(c,p,ph); };
    document.getElementById("save-cancel").onclick=cleanup;
  }

  /* ---- geolocation + drop-pin: track the user; track + follow (moto-taxi style); community adds places via the + FAB ---- */
  function initMapExtras(map, opts) {
    opts = opts || {};
    if (map.zoomControl) { map.zoomControl.remove(); }            // zoom via gestures only (no +/- clutter)
    var categoryMap = opts.categoryMap || null;
    var activeCat = opts.activeCat || null;
    var defaultLabel = opts.defaultLabel || t('spots_your_spot');
    var pinMarkers = [];
    var genericIcon = L.divIcon({ className: "fish-icon", html: '<span>📍</span>', iconSize: [26, 26], iconAnchor: [13, 26] });
    function iconFor(cat) { return categoryMap && categoryMap[cat] ? categoryMap[cat].icon : genericIcon; }
    function labelFor(cat) { return categoryMap && categoryMap[cat] ? categoryMap[cat].label : defaultLabel; }
    var saved = []; try { saved = JSON.parse(localStorage.getItem(opts.storageKey || "fish-map-pins") || "[]"); } catch (e) {}
    var blueDot = null, following = (opts.follow !== false), watchId = null, curPos = null;
    function placeBlue(lat, lng) {
      if (!blueDot) {
        blueDot = L.circleMarker([lat, lng], { radius: 9, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }).addTo(map);
        blueDot.bindTooltip(opts.locHere || 'Estas aqui', { permanent: true, direction: 'top', offset: [0, -14] });
        var el = blueDot.getElement(); if (el) { el.classList.add('blue-dot'); }
      } else { blueDot.setLatLng([lat, lng]); }
    }
    function startWatch() {
      if (!navigator.geolocation) { return; }
      watchId = navigator.geolocation.watchPosition(function (p) {
        window.__hasFix = true;
        curPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        placeBlue(curPos.lat, curPos.lng);
        if (following) { map.setView([curPos.lat, curPos.lng], map.getZoom() < 13 ? 13 : map.getZoom()); }
      }, function () {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
    }
    map.on('dragstart', function () { following = false; });
    startWatch();
    function locateMe() {
      // A tap (user gesture) is what reliably releases the geolocation permission
      // prompt — browsers defer page-load-initiated prompts until a gesture.
      navigator.geolocation.getCurrentPosition(function (p) {
        window.__hasFix = true;
        curPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        placeBlue(curPos.lat, curPos.lng);
        if (following) { map.setView([curPos.lat, curPos.lng], map.getZoom() < 13 ? 13 : map.getZoom()); }
      }, function () {}, { enableHighAccuracy: true, timeout: 10000 });
    }
    var addPin = function (p) {
      var m = L.marker([p.lat, p.lng], { icon: iconFor(p.cat || null) }); m.__cat = p.cat || null;
      var pop = "<b>" + esc(p.label || labelFor(p.cat)) + "</b>" + (p.comment ? "<br>" + esc(p.comment) : "");
      if (p.photo) { pop += '<br><img src="' + esc(p.photo) + '" style="max-width:120px;max-height:90px;border-radius:8px;margin-top:4px">'; }
      m.bindPopup(pop, { autoClose: false });
      pinMarkers.push({ m: m, data: p }); if (!categoryMap || (p.cat || null) === activeCat) { m.addTo(map); }
    };
    var refreshFilter = function () {
      pinMarkers.forEach(function (pm) { var show = (!categoryMap || pm.m.__cat === activeCat); if (show && !map.hasLayer(pm.m)) { pm.m.addTo(map); } else if (!show && map.hasLayer(pm.m)) { map.removeLayer(pm.m); } });
    };
    (opts.seedPins || []).forEach(addPin);
    saved.forEach(function (p) { if (!p.pbid) { addPin(p); } });   // local-only; PB pins load below (de-dup by pbid)
    refreshFilter();
    var pbType = opts.pbType || "spot";
    pbFetchLocations().then(function (remote) {
      try { remote.forEach(function (r) { if (r.type === pbType) { addPin(r); } }); } catch (e) {}
      refreshFilter();
    }).catch(function () {});
    var api;
    var persist = function () { var kept = pinMarkers.filter(function (pm) { return pm.data.dropped; }).map(function (pm) { return pm.data; }); try { localStorage.setItem(opts.storageKey || "fish-map-pins", JSON.stringify(kept)); } catch (e2) {} };
    api = {
      getPos: function () { return curPos; },
      placeAtMe: function (label, cat, comment, pub, photo) {
        if (!curPos || !curPos.lat) { return false; }
        return api.placeAt(curPos.lat, curPos.lng, label, cat, comment, pub, photo);
      },
      getCenter: function () { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
      startPick: function (onDone) {
        following = false;
        var hint = document.createElement("div");
        hint.style.cssText = "position:fixed;top:calc(108px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6200;background:#0f172a;color:#fff;border-radius:10px;padding:8px 14px;font-size:13px;white-space:nowrap";
        hint.textContent = LOC.pick_hint;
        var bar = document.createElement("div");
        bar.style.cssText = "position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:6200;display:flex;gap:8px";
        bar.innerHTML = '<button class="pk-c" style="padding:11px 18px;border:none;border-radius:10px;font-weight:700;font-size:14px;background:#fff;color:#334155">' + esc(LOC.pick_cancel) + '</button>' +
          '<button class="pk-o" disabled style="padding:11px 18px;border:none;border-radius:10px;font-weight:700;font-size:14px;background:#2563eb;color:#fff;opacity:.5">' + esc(LOC.pick_confirm) + '</button>';
        document.body.appendChild(hint); document.body.appendChild(bar);
        var tmp = null;
        var okBtn = bar.querySelector(".pk-o");
        function onTap(e) {
          if (tmp) { map.removeLayer(tmp); }
          tmp = L.marker(e.latlng, { icon: genericIcon }).addTo(map);
          okBtn.disabled = false; okBtn.style.opacity = "1";
        }
        map.on("click", onTap);
        function cleanup() {
          map.off("click", onTap);
          if (tmp) { map.removeLayer(tmp); }
          hint.remove(); bar.remove();
        }
        bar.querySelector(".pk-c").onclick = cleanup;
        okBtn.onclick = function () {
          if (!tmp) return;
          var ll = tmp.getLatLng();
          cleanup();
          onDone({ lat: ll.lat, lng: ll.lng });
        };
      },
      placeAt: function (latv, lngv, label, cat, comment, pub, photo) {
        if (!latv && latv !== 0) { return false; }
        var id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        var lbl = (comment && String(comment).trim()) || label || labelFor(cat);
        var mk = L.marker([latv, lngv], { icon: iconFor(cat || null) }); mk.__cat = cat || null;
        var pop = "<b>" + esc(lbl) + "</b>" + (comment && String(comment).trim() && lbl !== comment ? "<br>" + esc(comment) : "");
        if (photo) { pop += '<br><img src="' + esc(photo) + '" style="max-width:120px;max-height:90px;border-radius:8px;margin-top:4px">'; }
        mk.bindPopup(pop, { autoClose: false }).addTo(map).openPopup();
        var pm = { m: mk, data: { lat: latv, lng: lngv, label: lbl, cat: cat || null, comment: comment || "", pub: !!pub, dropped: true, id: id, ts: Date.now(), photo: photo || null } };
        pinMarkers.push(pm);
        persist(); refreshFilter();
        // Cross-device sync: best-effort anonymous POST to PB `locations` (public create rule).
        // Degrades to local-only (localStorage) if PB is unreachable — preserves v16 behavior.
        qSend(API + "collections/locations/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: String(pm.data.lat), lng: String(pm.data.lng), label: pm.data.label, comment: pm.data.comment || "", cat: pm.data.cat || "", pub: String(!!pm.data.pub), photo: pm.data.photo || "", ts: String(pm.data.ts) })
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (rec) { if (rec && rec.id) { pm.data.pbid = rec.id; persist(); } })
          .catch(function () {});
        return true;
      },
      setCategory: function (c) { activeCat = c; refreshFilter(); },
      activeCat: function () { return activeCat; },
      removeById: function (id) { for (var i = pinMarkers.length - 1; i >= 0; i--) { if (pinMarkers[i].data.id === id) { if (pinMarkers[i].data.pbid) { qSend(API+"collections/locations/"+encodeURIComponent(pinMarkers[i].data.pbid), {method:"DELETE"}).catch(function(){}); } if (map.hasLayer(pinMarkers[i].m)) { map.removeLayer(pinMarkers[i].m); } pinMarkers.splice(i, 1); } } persist(); },
      locateMe: locateMe,
      stop: function () { if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; } if (blueDot) { map.removeLayer(blueDot); blueDot = null; } }
    };
    return api;
  }


  function wireFab(id, getExtras, spotLabel, kind){
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", function(e){
      e.preventDefault(); e.stopPropagation();
      if (kind === "shop") {
        var catMap = window.__shopCats || {};
        var active = window.__activeShopCat || "local-guide";
        var ci = catMap[active] || { label: t('shops_add_tooltip') };
        addChooser(getExtras(), ci.label, active);
      } else {
        addChooser(getExtras(), spotLabel, null);
      }
    });
  }
  function bootExtras(){
    locReload(); netBadge(); locBanner();
    wireFab("btn-add-spot", function(){ return (window.__geo||{})["tab-spots"]; }, t('spots_your_spot'), null);
    wireFab("btn-add-shop", function(){ return (window.__geo||{})["tab-shops"]; }, null, "shop");
    window.onerror = function(msg){ try { toast(String(msg).slice(0,80)); } catch(e){} };
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/fish/fish-sw.js").catch(function(){});
    }
  }
  function initFor(id) {
    if (inited[id]) { if (window.__map && window.__map[id]) window.__map[id].invalidateSize(); return; }
    inited[id] = true;
    if (id === "tab-spots") initSpotsMap();
    if (id === "tab-shops") initShopsMap();
    if (id === "tab-guide") initGuide();
  }

  function initSpotsMap() {
    if (typeof L === "undefined" || !document.getElementById("spots-map")) return;
    var map = L.map("spots-map").setView([21.43, -89.75], 9);
    window.__map = window.__map || {}; window.__map["tab-spots"] = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map).on("load", function () { try { map.invalidateSize(); } catch (e) {} });
    [["Progreso Rocky Reef",21.43000,-89.74931],
     ["Chicxulub Rocky Reef",21.48339,-89.62892],
     ["Telchac Rocky Reef",21.43486,-89.45350],
     ["Dzilam de Bravo Reef",21.57997,-88.84883]]
      .forEach(function (r) { L.marker([r[1], r[2]], { icon: emojiIcon("<span>\ud83d\udc1f</span>") }).addTo(map).bindPopup("<b>" + r[0] + "</b><br>" + t('spots_zone')); });
    L.circle([21.358, -89.453], {
      color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.2, radius: 6000
    }).addTo(map).bindTooltip(t('spots_no_fishing'), {permanent:true,direction:"center",className:"no-fish-label",offset:[0,10]})
      .bindPopup("<b>" + t('spots_no_fishing') + "</b><br>" + t('spots_refuge'));
    var spotExtras = initMapExtras(map, {
      storageKey: "fish-spots-pins", defaultLabel: t('spots_your_spot'), locHere: "Estas aqui", follow: true, pbType: "spot"
    });
    window.__geo = window.__geo || {}; window.__geo["tab-spots"] = spotExtras;
    // fab handled by wireFab at boot
  }

  function initShopsMap() {
    if (typeof L === "undefined" || !document.getElementById("shops-map")) return;
    var map = L.map("shops-map").setView([21.2828, -89.7145], 13);
    window.__map = window.__map || {}; window.__map["tab-shops"] = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map).on("load", function () { try { map.invalidateSize(); } catch (e) {} });
    var catMap = {
      "local-guide":  { icon: localGuideIcon,       label: "Local Guide" },
      "accesorios":   { icon: boatAccessoriesIcon,  label: "Accesorios" },
      "cebo":         { icon: baitShopsIcon,        label: "Cebo" },
      "tours":        { icon: toursIcon,            label: "Tours" },
      "alquileres":   { icon: rentalsIcon,          label: "Alquileres" }
    };
    window.__shopCats = catMap;
    window.__activeShopCat = 'local-guide';
    var shopExtras = initMapExtras(map, {
      storageKey: "fish-shops-pins", activeCat: "local-guide", categoryMap: catMap, locHere: "Estas aqui", follow: false, pbType: "shop",
      seedPins: [{ lat: 21.27421456767244, lng: -89.72639832655128, label: "Senuseos y Kayaks - Equipo de pesca y alquiler de kayaks", cat: "alquileres", id: "sinuseos", ts: 0 }]
    });
    window.__geo = window.__geo || {}; window.__geo["tab-shops"] = shopExtras;
    var chipBox = document.querySelector("#tab-shops .chips");
    if (chipBox) {
      chipBox.querySelectorAll(".chip").forEach(function (btn) {
        btn.addEventListener("click", function () {
          chipBox.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("active"); });
          btn.classList.add("active"); window.__activeShopCat = btn.getAttribute("data-cat") || null;
          shopExtras.setCategory(window.__activeShopCat);
        });
      });
    }
    // fab handled by wireFab at boot
  }
  function photoUrl(rec) {
    if (!rec) return "images/fish-placeholder.svg";
    var p = Array.isArray(rec.photo) ? (rec.photo[0] || null) : rec.photo;
    if (!p) return "images/fish-placeholder.svg";
    // Guide defaults embed a relative URL (e.g. images/snork.jpg); API records embed a stored filename.
    if (typeof p === "string" && (p.indexOf("images/") === 0 || /^https?:\/\//.test(p))) return p;
    return API + "files/species/" + rec.id + "/" + p;
  }
  function findSpecies(id) {
    for (var i = 0; i < window.GUIDE_DATA.length; i++) { if (window.GUIDE_DATA[i].id === id) return window.GUIDE_DATA[i]; }
    for (var i = 0; i < window.__userSpecies.length; i++) { if (window.__userSpecies[i].id === id) return window.__userSpecies[i]; }
    return null;
  }

  function renderGuide() {
    var grid = document.getElementById("guide-grid");
    if (!grid) return;
    var items = window.GUIDE_DATA.slice().concat(window.__userSpecies);
    if (items.length === 0) { grid.innerHTML = '<p class="empty">'+t('guide_empty')+'</p>'; return; }
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      html += '<div class="fish-card" data-fish="' + esc(s.id) + '">'
        + '<img class="fish-img" src="' + esc(s.photo) + '" alt="' + esc(nameOf(s)) + '">'
        + '<div class="fish-name">' + esc(nameOf(s)) + '</div>'
        + '<div class="fish-sci">' + esc(s.sci || "") + '</div>'
        + '</div>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".fish-card").forEach(function (card) {
      card.addEventListener("click", function () { openFishDetail(card.getAttribute("data-fish")); });
    });
  }

  function initGuide() { renderGuide(); fetchSpecies(); }

  function fetchSpecies() {
    fetch(API + "collections/species/records?perPage=100")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) {
        window.__userSpecies = [];
        for (var i = 0; i < j.items.length; i++) {
          var it = j.items[i];
          window.__userSpecies.push({
            id: it.id, common: it.common, local: it.local || "", sci: it.sci || "",
            where: it.where || "", bait: it.bait || "", photo: photoUrl(it), attribution: it.attribution || t('detail_attribution_default')
          });
        }
        renderGuide();
      })
      .catch(function () {});
  }

  function modalOpen(el) { if (el) { el.classList.add("open"); el.setAttribute("aria-hidden", "false"); } }
  function modalClose(el) { if (el) { el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); } }

  function openFishDetail(id) {
    var s = findSpecies(id);
    var d = document.getElementById("fish-detail");
    if (!s || !d) return;
    var img = d.querySelector(".modal-img");
    img.src = s.photo; img.alt = nameOf(s);
    d.querySelector(".modal-title").textContent = nameOf(s);
    d.querySelector(".modal-sci").textContent = s.sci || "";
    d.querySelector(".modal-where").textContent = s.where || "";
    d.querySelector(".modal-bait").textContent = s.bait || "";
    d.querySelector(".modal-attr").textContent = s.attribution || "";
    modalOpen(d);
  }
  function closeFishDetail() { modalClose(document.getElementById("fish-detail")); }

  function openAddFish() { modalOpen(document.getElementById("add-fish")); }
  function closeAddFish() { modalClose(document.getElementById("add-fish")); }

  function submitAddFish(e) {
    e.preventDefault();
    var form = e.target;
    if (!form.common.value.trim() || !form.where.value.trim()) { alert(t('addfish_valid_err')); return; }
    var fd = new FormData();
    fd.append("common", form.common.value.trim());
    fd.append("local", form.local.value.trim());
    fd.append("sci", form.sci.value.trim());
    fd.append("where", form.where.value.trim());
    fd.append("bait", form.bait.value.trim());
    var file = form.photo.files[0];
    var save = form.querySelector("button[type=submit]");

    function send() {
      save.disabled = true; save.textContent = t('addfish_saving');
      qSend(API + "collections/species/records", { method: "POST", body: fd })
        .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t); }); })
        .then(function (rec) {
          window.__userSpecies.unshift({
            id: rec.id, common: rec.common, local: rec.local || "", sci: rec.sci || "",
            where: rec.where || "", bait: rec.bait || "", photo: photoUrl(rec), attribution: t('detail_attribution_default')
          });
          renderGuide(); closeAddFish(); form.reset();
          var pv = document.getElementById("photo-preview"); if (pv) pv.innerHTML = "";
          save.disabled = false; save.textContent = t('form_save');
        })
        .catch(function (err) {
          save.disabled = false; save.textContent = t('form_save');
          alert(t('addfish_err') + (err.message || err));
        });
    }

    if (!file) { save.disabled = false; return send(); }
    // PocketBase hangs on multipart JPEGs carrying EXIF. Re-encode client-side to a
    // clean, downscaled JPEG (strips EXIF/orientation) so phone photos upload reliably.
    // Non-JPEG types pass through unchanged; on error we fall back to the original file.
    if (file.type !== "image/jpeg") { fd.append("photo", file, file.name); save.disabled = false; return send(); }

    save.disabled = true; save.textContent = t('addfish_preparing');
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth, h = img.naturalHeight, maxW = 1600;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      c.toBlob(function (blob) {
        fd.append("photo", blob, file.name);
        send();
      }, "image/jpeg", 0.85);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      fd.append("photo", file, file.name);
      save.disabled = false; send();
    };
    img.src = url;
  }
  var addBtn = document.getElementById("btn-add-fish");
  if (addBtn) addBtn.addEventListener("click", openAddFish);
  var addForm = document.getElementById("add-fish-form");
  if (addForm) addForm.addEventListener("submit", submitAddFish);
  document.querySelectorAll(".modal .modal-close").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.closest(".modal"); if (!m) return;
      if (m.id === "fish-detail") closeFishDetail();
      else if (m.id === "add-fish") closeAddFish();
    });
  });
  document.querySelectorAll(".modal .modal-backdrop").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.closest(".modal"); if (!m) return;
      if (m.id === "fish-detail") closeFishDetail();
      else if (m.id === "add-fish") closeAddFish();
    });
  });
  var photoInp = document.getElementById("photo");
  if (photoInp) {
    photoInp.addEventListener("change", function () {
      var pv = document.getElementById("photo-preview"); if (!pv) return;
      pv.innerHTML = "";
      var f = this.files[0];
      if (f) { var img = document.createElement("img"); img.src = URL.createObjectURL(f); img.className = "preview"; pv.appendChild(img); }
    });
  }

  applyLang();
  bootExtras();
  start();
})();
