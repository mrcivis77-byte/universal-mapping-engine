/**
 * Ride Request System (transit apps: bus, mototaxi).
 *
 * Flows:
 *   CUSTOMER - sees their location + all ON-DUTY drivers live. Can request a
 *              ride with a name and a destination (typed place or map pin).
 *              Request shows as a person icon on every driver's map. The
 *              request auto-completes when a driver and the customer are
 *              moving together, or cancels if the customer cancels or the
 *              nearest on-duty driver goes off duty.
 *
 *   DRIVER   - must log in / register (invite code validated server-side).
 *              Once logged in, sees all pending customer requests. An
 *              ON DUTY / OFF DUTY toggle controls whether the driver is
 *              tracked and shown on customers' maps.
 *
 * The app keeps tracking location while the page is alive (geolocation
 * watchPosition keeps firing on Android in the background; a screen wake
 * lock avoids the screen sleeping during an active ride/session).
 */
class RideApp {
    constructor(options) {
        this.config = options.config;
        this.geo = options.geo;
        // Surface GPS problems instead of failing silently: a denied
        // permission makes duty/request writes impossible, so the driver
        // must be told WHY nothing works.
        if (this.geo && typeof this.geo.onPermissionDenied === 'function') {
            this.geo.onPermissionDenied(() => {
                this.toast(this.t('transit.location_denied'));
            });
        }
        if (this.geo && typeof this.geo.onError === 'function') {
            let _lastGeoErrToast = 0;
            this.geo.onError(({ code }) => {
                const now = Date.now();
                if (now - _lastGeoErrToast < 120000) return; // throttle
                if (code === 2 /* POSITION_UNAVAILABLE */ || code === 3 /* TIMEOUT */) {
                    _lastGeoErrToast = now;
                    this.toast(this.t('transit.location_required'));
                }
            });
        }
        this.map = options.map;
        this.rt = options.rt;

        this.role = null; // 'customer' | 'driver'
        this.town = null;
        this.pickupDistance = Number(this.config.RIDE_PICKUP_DISTANCE || 30);
        this.vehicleTypes = String(this.config.TRANSIT_VEHICLE_TYPES || 'mototaxi,bus')
            .split(',').map((s) => s.trim());

        // Fixed-route apps (e.g. bus) don't do door-to-door pickup: the
        // customer requests a ride and must wait at the stop. Moto/drive are
        // point-to-point (driver picks up and drops off at a destination).
        this.isFixedRoute = this.vehicleTypes.length === 1 && this.vehicleTypes[0] === 'bus';

        // Marketplace apps (drive, a-usted): customers collect competing
        // driver BIDS (price + how soon) and pick a winner. Regular transit
        // apps (bus, mototaxi) keep the first-come flow.
        this.isMarketplace = ['drive', 'austed'].some((v) => this.vehicleTypes.includes(v));

        // First-window headline comes from the app's own identity
        // (APP_NAME in config.<app>.json); fallback keeps the classic label.
        const wt = document.getElementById('welcome-title');
        if (wt && this.config.APP_NAME) wt.textContent = this.config.APP_NAME;

        // A driver counts as live only if last_active is fresh. This is the
        // watchdog that hides "ghost" buses: an on-duty record whose heartbeat
        // stopped (app closed, network drop) must disappear instead of lingering.
        const interval = Number(this.config.GPS_UPDATE_INTERVAL || 5000);
        // Locked-in model: a driver stays visible while on_duty=true (they
        // cancel explicitly). The stale window is just an anti-ghost valve
        // mirroring the server's 4h duty-reset cron.
        this.driverStaleMs = 240 * 60 * 1000;
        this._staleSweepTimer = null;

        // Customer state
        this.ownRequestId = null;
        this._driverComingNotified = false;
        this.ownRequest = null;
        this.dest = null; // { lat, lng, name }
        this.pinMode = false;
        this.driverPositions = {}; // driverId -> { lat, lng }
        this.nearestDriverId = null;
        this.nearestDriverDist = Infinity;
        this.rideStreak = {}; // driverId -> consecutive "moving together" checks
        this.driverRecords = {}; // driverId -> last record (for popup re-translation)

        // Translation helper: delegates to the app-wide i18n engine.
        this.t = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

        // Driver state
        this.driverRecordId = null;
        this.driverRefCode = '';
        this.dutyCount = 0;
        this.referralCount = 0;
        this.shareCount = 0;
        this.driverVehicleType = null;
        this.route = '';
        this.onDuty = false;
        this.isFull = false;
        this.publishTimer = null;
        this.requests = {}; // requestId -> record
        this.wakeLock = null;
        this.regMethod = 'phone'; // phone-only identity (no passwords)

        // Marketplace bidding state
        this.bids = {};        // bidId -> bid record (customer feed)
        this.myBids = {};      // requestId -> my pending bid (driver side)
        this.driverProfiles = {}; // driverId -> profile record cache (photos/rating)

        this._onGeo = this._onGeo.bind(this);
        this._onDriver = this._onDriver.bind(this);
        this._onRequest = this._onRequest.bind(this);
        this._onOwnRequest = this._onOwnRequest.bind(this);
        this._onBid = this._onBid.bind(this);
        this._onMyBid = this._onMyBid.bind(this);
        this._applyLanguage = this._applyLanguage.bind(this);

        this.bind();
        this.bindVisibility();
        this.captureReferral();
        document.addEventListener('languageChanged', this._applyLanguage);
    }

    /**
     * Capture ?ref=CODE (or #ref=CODE) from a shared link on first visit and
     * persist it until the visitor registers as a driver. The code is then
     * stripped from the URL so re-shares of the page don't chain it.
     */
    captureReferral() {
        try {
            let ref = new URLSearchParams(window.location.search).get('ref') || '';
            if (!ref && window.location.hash) {
                const m = window.location.hash.match(/ref=([A-Za-z0-9]+)/);
                if (m) ref = m[1];
            }
            ref = String(ref).trim().toUpperCase();
            if (ref) {
                localStorage.setItem('rtm_ref', ref);
                const url = new URL(window.location.href);
                url.searchParams.delete('ref');
                history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
        } catch (err) { /* private mode etc. */ }
    }

    /* ------------------------------------------------------------ */
    /* Element shortcuts                                             */
    /* ------------------------------------------------------------ */
    $(id) {
        return document.getElementById(id);
    }

    val(id) {
        const el = this.$(id);
        return el ? el.value : '';
    }

    show(id) {
        const el = this.$(id);
        if (el) el.classList.remove('hidden');
    }

    hide(id) {
        const el = this.$(id);
        if (el) el.classList.add('hidden');
    }

    /* ------------------------------------------------------------ */
    /* Boot: role selection                                          */
    /* ------------------------------------------------------------ */
    start() {
        // Returning driver with a live session? Skip the role screen and the
        // register form entirely - go straight back to the duty controls.
        const savedRole = localStorage.getItem('rtm_role');
        const pb = this.rt.getPocketBase();
        if (savedRole === 'driver' && pb && pb.authStore && pb.authStore.isValid) {
            this.role = 'driver';
            this.maybePromptLocation();
            var _ov2 = this.$('role-overlay');
            if (_ov2) _ov2.style.display = 'none';
            this.afterAuth().catch(() => {});
            return Promise.resolve();
        }
        this.maybePromptLocation();
        var _pending = localStorage.getItem('rtm_pending_role');
        if (_pending) {
            localStorage.removeItem('rtm_pending_role');
            this.chooseRole(_pending);
            return Promise.resolve();
        }
        var _ov = this.$('role-overlay');
        if (_ov) _ov.style.display = 'flex';
        return new Promise((resolve) => {
            this._roleResolve = resolve;
        });
    }

    chooseRole(role) {
        this.role = role;
        localStorage.setItem('rtm_role', role);
        localStorage.removeItem('rtm_pending_role');
        var _ov = this.$('role-overlay');
        if (_ov) _ov.style.display = 'none';
        if (this._roleResolve) {
            const resolve = this._roleResolve;
            this._roleResolve = null;
            resolve();
        }
        if (role === 'customer') {
            this.enableCustomer();
        } else {
            this._stopStaleSweep();
            this.showDriverAuth();
        }
    }

    /* ------------------------------------------------------------ */
    /* Customer flow                                                 */
    /* ------------------------------------------------------------ */
    async enableCustomer() {
        // Clear any leftover driver UI on this device.
        this.hide('driver-auth-panel');
        this.hide('driver-controls');
        this.hide('duty-toggle');
        this.hide('full-toggle');
        this.hide('info-route-section');
        this.show('request-btn');
        this.updateRequestButton();
        await this.subscribeDrivers();
        // Refresh survival: if this device already has a live pending
        // request, resume it instead of starting from scratch.
        const mine = await this.findOwnPendingRequest();
        if (mine) {
            this.adoptRequest(mine);
        }
    }

    async subscribeDrivers() {
        if (!this.rt.isConnected()) return;
        // App isolation: this app only ever shows drivers of its own vehicle
        // type, so a bus customer never sees mototaxis and vice versa.
        const typeFilter = this.vehicleTypeFilter('vehicle_type');
        // State-wide coverage: no town gate.
        const filter = `on_duty = true && ${typeFilter}`;
        // The live subscription must NOT filter on on_duty: PocketBase only
        // delivers events for records matching the filter, so an on_duty=false
        // update would never reach us and the marker would linger until reload.
        // _onDriver removes the marker client-side when on_duty !== true.
        await this.rt.subscribe('drivers', this._onDriver, {
            filter: typeFilter
        });

        // Load existing on-duty drivers
        try {
            const records = await this.rt.getRecords('drivers', {
                perPage: 100,
                filter: filter
            });
            for (const rec of records) {
                if (this.vehicleTypes.includes(rec.vehicle_type) && this.isDriverLive(rec)) {
                    this.updateDriverMarker(rec);
                }
            }
        } catch (err) {
            console.warn('[ride] load drivers:', err.message);
        }

        // Watchdog: periodically drop any on-duty marker whose heartbeat has
        // gone stale (driver app closed without going off duty). Catches the
        // case where no live event ever reaches us.
        this._startStaleSweep();
    }

    _startStaleSweep() {
        if (this._staleSweepTimer) return;
        this._staleSweepTimer = setInterval(() => {
            for (const [id, rec] of Object.entries(this.driverRecords)) {
                if (!this.isDriverLive(rec)) {
                    this.map.removeMarker('drv_' + id);
                    delete this.driverRecords[id];
                    delete this.driverPositions[id];
                    if (id === this.nearestDriverId) {
                        this.handleNearestDriverGone();
                    }
                }
            }
        }, this.driverStaleMs / 2);
    }

    _stopStaleSweep() {
        if (this._staleSweepTimer) {
            clearInterval(this._staleSweepTimer);
            this._staleSweepTimer = null;
        }
    }

    openRequestPanel() {
        this.dest = null;
        this.set('req-name', '');
        this.set('req-dest', '');
        this.hide('req-dest');
        this.hide('req-dest-display');
        this.hide('req-error');
        this.map.removeMarker('dest_pin');
        // Fixed-route apps (bus): no destination — you wait at the stop.
        const destSection = this.$('request-panel')?.querySelector('.dest-section');
        if (destSection) destSection.style.display = this.isFixedRoute ? 'none' : 'block';
        this.show('request-panel');
    }

    // Build a PocketBase filter restricting a field to this app's vehicle
    // types, e.g. `(vehicle_type = "bus" || vehicle_type = "mototaxi")`.
    vehicleTypeFilter(field) {
        const types = this.vehicleTypes.map((t) => `${field} = "${t}"`);
        return `(${types.join(' || ')})`;
    }

    set(id, value) {
        const el = this.$(id);
        if (el) el.value = value;
    }

    reqError(msg) {
        const el = this.$('req-error');
        if (el) {
            el.textContent = msg;
            // Ensure the message is visible (openRequestPanel hides it on open).
            if (msg) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    }

    activatePinMode() {
        this.pinMode = true;
        this.reqError('');
        this.toast(this.t('transit.move_map_hint'));
        // Hide the panel so the map is fully visible and free to pan around.
        this.hide('request-panel');
        this.map.getMap().once('click', (e) => this.dropDestPin(e.latlng));
    }

    // Drop a draggable pin where the map was tapped, then let the customer
    // drag it to the exact spot and confirm (or cancel) before leaving pin mode.
    dropDestPin(latlng) {
        this.pinMode = false;
        this.map.updateMarker('dest_pin', latlng.lat, latlng.lng, {
            appType: 'transit',
            entityType: 'dest',
            draggable: true,
            animate: false
        });
        this.toast(this.t('transit.drag_pin_hint'));
        const marker = this.map.getMarker('dest_pin');
        if (marker) {
            marker.on('dragend', () => this.updatePinCoords());
        }
        this.showPinConfirmBar();
        this.updatePinCoords();
    }

    updatePinCoords() {
        const marker = this.map.getMarker('dest_pin');
        const coordsEl = this.$('pin-confirm-coords');
        if (!marker || !coordsEl) return;
        const ll = marker.getLatLng();
        coordsEl.textContent = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
    }

    showPinConfirmBar() {
        let bar = this.$('pin-confirm-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pin-confirm-bar';
            bar.className = 'pin-confirm-bar hidden';
            bar.innerHTML = `
                <span id="pin-confirm-coords" class="pin-confirm-coords"></span>
                <button type="button" id="pin-confirm-cancel" class="pin-confirm-btn cancel">Cancelar</button>
                <button type="button" id="pin-confirm-ok" class="pin-confirm-btn ok">Confirmar</button>
            `;
            document.body.appendChild(bar);
            this.$('pin-confirm-ok').addEventListener('click', () => this.confirmDestPin());
            this.$('pin-confirm-cancel').addEventListener('click', () => this.cancelDestPin());
        }
        this.$('pin-confirm-cancel').textContent = this.t('transit.cancel');
        this.$('pin-confirm-ok').textContent = this.t('transit.confirm');
        bar.classList.remove('hidden');
    }

    hidePinConfirmBar() {
        const bar = this.$('pin-confirm-bar');
        if (bar) bar.classList.add('hidden');
    }

    confirmDestPin() {
        const marker = this.map.getMarker('dest_pin');
        if (!marker) return;
        const ll = marker.getLatLng();
        this.dest = { lat: ll.lat, lng: ll.lng, name: '' };
        this.hidePinConfirmBar();
        const display = this.$('req-dest-display');
        if (display) {
            display.textContent = this.t('transit.dest_prefix') +
                `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
            display.classList.remove('hidden');
        }
        this.reqError('');
        this.show('request-panel');
    }

    cancelDestPin() {
        this.hidePinConfirmBar();
        this.map.removeMarker('dest_pin');
        this.dest = null;
        this.show('request-panel');
    }

    async typeDestination() {
        const query = this.val('req-dest').trim();
        if (!query) {
            this.reqError(this.t('transit.type_place_error'));
            return;
        }
        this.reqError(this.t('transit.searching_place'));
        const found = await this.geocodePlace(query);
        if (found) {
            this.dest = found;
            const display = this.$('req-dest-display');
            if (display) {
                display.textContent = this.t('transit.dest_prefix') + (found.shortName || query);
                display.classList.remove('hidden');
            }
            this.map.updateMarker('dest_pin', found.lat, found.lng, {
                appType: 'transit',
                entityType: 'dest'
            });
            this.reqError('');
        } else {
            // Fallback: keep the typed name, pin at current location
            const pos = this.geo.getPosition();
            if (pos) {
                this.dest = { lat: pos.latitude, lng: pos.longitude, name: query };
            }
            const display = this.$('req-dest-display');
            if (display) {
                display.textContent = this.t('transit.dest_prefix') + query + this.t('transit.dest_approx');
                display.classList.remove('hidden');
            }
            this.reqError('');
        }
    }

    async geocodePlace(query) {
        try {
            const bounds = this.config.MAX_BOUNDS_ARRAY;
            const params = new URLSearchParams({
                q: query,
                format: 'json',
                limit: 1
            });
            if (bounds && bounds.length === 4) {
                params.set('viewbox', `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`);
                params.set('bounded', '1');
            }
            const res = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString(), {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data[0]) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    name: data[0].display_name,
                    shortName: data[0].name || data[0].display_name
                };
            }
            return null;
        } catch (err) {
            console.warn('[ride] geocode failed:', err.message);
            return null;
        }
    }

    deviceId() {
        let id = localStorage.getItem('rtm_device_id');
        if (!id) {
            id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem('rtm_device_id', id);
        }
        return id;
    }

    /**
     * Find this device's still-pending request for the current app's vehicle
     * type (created less than TRANSIT_MAX_WAIT_TIME ago).
     */
    async findOwnPendingRequest() {
        try {
            // NB: ride_requests.updated uses PB autodate strings ("YYYY-MM-DD
            // HH:mm:ss.SSSZ", space separator) - an ISO 'T' cutoff never
            // string-matches anything.
            const cutoff = new Date(Date.now() - (this.config.TRANSIT_MAX_WAIT_TIME || 15) * 60000)
                .toISOString()
                .replace('T', ' ');
            const recs = await this.rt.getRecords('ride_requests', {
                perPage: 1,
                sort: '-updated',
                filter: `device_id = "${this.deviceId()}" && vehicle_type = "${this.vehicleTypes[0]}" && status = "pending" && updated > "${cutoff}"`
            });
            return recs && recs[0] ? recs[0] : null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Attach to an existing pending request as our own: identical to having
     * just created it (subscriptions, bid feed, UI state).
     */
    adoptRequest(rec) {
        // Drop a previous own-request subscription if the id changed.
        if (this.ownRequestId && this.ownRequestId !== rec.id) {
            try { this.rt.unsubscribe('ride_requests'); } catch (err) { /* ignore */ }
            if (this.isMarketplace) { try { this.rt.unsubscribe('bids'); } catch (err) { /* ignore */ } }
        }
        this.ownRequestId = rec.id;
        this.ownRequest = rec;
        this.rt.subscribe('ride_requests', this._onOwnRequest, {
            filter: `id = "${rec.id}"`
        }).catch(() => {});
        if (this.isMarketplace) {
            this.bids = {};
            this.rt.subscribe('bids', this._onBid, {
                filter: `request = "${rec.id}"`
            }).catch(() => {});
            this.show('bid-feed');
            const feed = this.$('bid-feed');
            if (feed) {
                const hint = feed.querySelector('.bid-hint');
                hint.classList.remove('hidden');
            }
            this.renderBidFeed();
        }
        this.updateRequestButton();
    }

    async createRequest() {
        // Name is optional; destination is required for marketplace apps
        // (drivers need it to set a price) but optional for regular transit.
        // Fixed-route apps (bus) never carry a destination.
        const name = this.val('req-name').trim() || 'Cliente';
        if (!this.isFixedRoute && !this.dest && this.val('req-dest').trim()) {
            await this.typeDestination();
        }
        if (this.isMarketplace && !this.isFixedRoute && !this.dest) {
            this.reqError(this.t('transit.destination_required') || 'El destino es obligatorio para pedir un viaje');
            return;
        }
        const pos = this.geo.getPosition();
        if (!pos) {
            this.reqError(this.t('transit.location_required'));
            this.showLocationHelp(null);
            return;
        }

        // Never stack duplicates: adopt this device's live pending request
        // instead of creating another one.
        const existing = await this.findOwnPendingRequest();
        if (existing) {
            this.adoptRequest(existing);
            this.hide('request-panel');
            this.hide('request-status');
            this.map.removeMarker('dest_pin');
            this.toast(this.t('transit.request_sent'));
            if (window.setOnMapIndicator) window.setOnMapIndicator(true);
            return;
        }

        try {
            const town = await this.resolveTown();
            const data = {
                town,
                device_id: this.deviceId(),
                customer_name: name,
                customer_lat: pos.latitude,
                customer_lng: pos.longitude,
                vehicle_type: this.vehicleTypes[0],
                status: 'pending'
            };
            if (!this.isFixedRoute && this.dest) {
                data.dest_lat = this.dest.lat;
                data.dest_lng = this.dest.lng;
                data.destination = this.dest.name || null;
            }
            const rec = await this.rt.createRecord('ride_requests', data);
            this.ownRequestId = rec.id;
            this.ownRequest = rec;
            // Watch our own request: if it ever leaves "pending" without us
            // (server-side expiry, driver completion), stop showing
            // "requesting" so the phone never lies about an open request.
            this.rt.subscribe('ride_requests', this._onOwnRequest, {
                filter: `id = "${rec.id}"`
            }).catch(() => {});
            if (this.isMarketplace) {
                // Collect competing driver offers for this request.
                this.bids = {};
                this.rt.subscribe('bids', this._onBid, {
                    filter: `request = "${rec.id}"`
                }).catch(() => {});
                this.show('bid-feed');
                const feed = this.$('bid-feed');
                if (feed) {
                    const hint = feed.querySelector('.bid-hint');
                    if (hint) hint.classList.remove('hidden');
                }
                this.renderBidFeed();
            }
            this.hide('request-panel');
            this.hide('request-status');
            this.updateRequestButton();
            this.map.removeMarker('dest_pin');
            this.acquireWakeLock();
            this.toast(this.t('transit.request_sent'));
            if (window.setOnMapIndicator) window.setOnMapIndicator(true);
        } catch (err) {
            console.error('[ride] create request failed:', err);
            this.reqError(this.t('transit.request_failed_prefix') + err.message);
        }
    }

    updateRequestButton() {
        const btn = this.$('request-btn');
        if (!btn) return;
        if (this.ownRequestId) {
            btn.textContent = this.t('transit.cancel');
            btn.classList.add('cancel');
        } else {
            btn.textContent = this.t('transit.request_ride');
            btn.classList.remove('cancel');
        }
    }

    async cancelOwnRequest() {
        if (!this.ownRequestId) return;
        const ok = await this.confirm(this.t('transit.cancel_confirm'), this.t('transit.cancel_confirm_yes'));
        if (!ok) return;
        try {
            await this.rt.updateRecord('ride_requests', this.ownRequestId, { status: 'cancelled' });
        } catch (err) {
            console.warn('[ride] cancel request:', err.message);
        }
        this.endOwnRequest(this.t('transit.request_cancelled'));
    }

    confirm(message, yesLabel) {
        return new Promise((resolve) => {
            let el = this.$('confirm-modal');
            if (!el) {
                el = document.createElement('div');
                el.id = 'confirm-modal';
                el.className = 'cancel-confirm hidden';
                el.innerHTML = `
                    <div class="cancel-confirm-box">
                        <p class="confirm-message"></p>
                        <div class="cancel-confirm-actions">
                            <button type="button" id="confirm-no" class="cancel-confirm-btn no">No</button>
                            <button type="button" id="confirm-yes" class="cancel-confirm-btn yes">Sí</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(el);
            }
            const msgEl = el.querySelector('.confirm-message');
            const yesBtn = this.$('confirm-yes');
            msgEl.textContent = message;
            yesBtn.textContent = yesLabel || this.t('transit.yes');
            this.$('confirm-no').textContent = this.t('transit.no');
            const done = (result) => {
                this.$('confirm-no').removeEventListener('click', onNo);
                this.$('confirm-yes').removeEventListener('click', onYes);
                el.classList.add('hidden');
                resolve(result);
            };
            const onNo = () => done(false);
            const onYes = () => done(true);
            this.$('confirm-no').addEventListener('click', onNo);
            this.$('confirm-yes').addEventListener('click', onYes);
            el.classList.remove('hidden');
        });
    }

    async completeOwnRequest() {
        if (!this.ownRequestId) return;
        try {
            await this.rt.updateRecord('ride_requests', this.ownRequestId, { status: 'completed' });
        } catch (err) {
            console.warn('[ride] complete request:', err.message);
        }
        this.endOwnRequest(this.t('transit.ride_started'));
    }

    endOwnRequest(message) {
        if (window.setOnMapIndicator) window.setOnMapIndicator(false);
        this.ownRequestId = null;
        this.ownRequest = null;
        this.nearestDriverId = null;
        this.nearestDriverDist = Infinity;
        this.rideStreak = {};
        this.rt.unsubscribe('ride_requests');
        this.endBidFeed();
        this.hide('request-status');
        this.updateRequestButton();
        this.show('request-btn');
        this.toast(message);
        this.releaseWakeLock();
    }

    // Realtime updates for THIS customer's request (see createRequest).
    _onOwnRequest(event) {
        if (this.role !== 'customer' || !this.ownRequestId) return;
        const record = event && event.record;
        if (!record || record.id !== this.ownRequestId) return;
        if (this.isMarketplace && record.status === 'accepted') {
            // A bid was chosen (by us): switch to the matched state instead of
            // ending — we still track our driver to the destination.
            this.toast(this.t('transit.bid_matched'));
            this.endBidFeed(true);
            this.show('request-status');
            const st = this.$('request-status-text');
            if (st) {
                st.textContent = this.t('transit.matched_waiting');
            }
            return;
        }
        if (!this.isMarketplace && record.status === 'accepted' && !this._driverComingNotified) {
            this._driverComingNotified = true;
            this.toast(this.t('transit.driver_coming'));
            return;
        }
        if (record.status && record.status !== 'pending' && record.status !== 'accepted') {
            const msg = record.status === 'completed'
                ? this.t('transit.ride_started')
                : this.t('transit.request_cancelled');
            this.endOwnRequest(msg);
        }
    }

    /* ------------------------------------------------------------ */
    /* Marketplace: customer bid feed                                */
    /* ------------------------------------------------------------ */
    _onBid(event) {
        if (this.role !== 'customer') return;
        const { action, record } = event;
        if (!record || record.id !== this.ownRequestId && record.request !== this.ownRequestId) return;
        if (action === 'delete' || record.status !== 'pending') {
            delete this.bids[record.id];
        } else {
            this.bids[record.id] = record;
        }
        this.renderBidFeed();
    }

    async renderBidFeed() {
        const feed = this.$('bid-feed');
        if (!feed) return;
        const hint = feed.querySelector('.bid-hint');
        const list = feed.querySelector('.bid-list');
        if (!list) return;

        const entries = Object.values(this.bids).sort((a, b) => (a.price || 0) - (b.price || 0));
        if (hint) hint.classList.toggle('hidden', entries.length > 0);
        list.innerHTML = '';
        for (const bid of entries) {
            const drv = await this.loadDriverProfile(bid.driver);
            const stars = this.ratingStars(drv && Number(drv.rating));
            const thumbs = [];
            for (const f of ['photo', 'car_inside', 'car_outside']) {
                if (drv && drv[f]) thumbs.push(`<img class="bid-thumb" src="${this.fileUrl('drivers', drv.id, drv[f])}" alt="">`);
            }
            const etaTxt = (Number(bid.eta_min) > 0)
                ? this.t('transit.bid_eta_min', { n: bid.eta_min })
                : this.t('transit.bid_eta_now');
            const card = document.createElement('div');
            card.className = 'bid-card';
            card.innerHTML =
                `<div class="bid-head"><span class="bid-price">$${Number(bid.price).toFixed(0)}</span>` +
                `<span class="bid-eta">${etaTxt}</span></div>` +
                `<div class="bid-driver">${drv ? drv.name : ''} <span class="bid-stars">${stars}</span></div>` +
                (thumbs.length ? `<div class="bid-thumbs">${thumbs.join('')}</div>` : '') +
                `<button class="bid-choose" type="button">${this.t('transit.bid_choose')}</button>`;
            card.querySelector('.bid-choose').addEventListener('click', () => this.chooseBid(bid));
            list.appendChild(card);
        }
    }

    async loadDriverProfile(driverId) {
        if (!driverId) return null;
        if (this.driverProfiles[driverId]) return this.driverProfiles[driverId];
        try {
            const pb = this.rt.getPocketBase();
            const rec = await pb.collection('drivers').getOne(driverId);
            this.driverProfiles[driverId] = rec;
            return rec;
        } catch (err) {
            return null;
        }
    }

    ratingStars(rating) {
        const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    }

    fileUrl(collection, recordId, filename) {
        const base = String(window.APP_CONFIG.POCKETBASE_URL || '').replace(/\/+$/, '');
        return `${base}/api/files/${collection}/${recordId}/${filename}`;
    }

    async chooseBid(bid) {
        if (!this.ownRequestId) return;
        try {
            await this.rt.updateRecord('ride_requests', this.ownRequestId, {
                accepted_driver: bid.driver,
                agreed_price: Number(bid.price),
                status: 'accepted'
            });
            // Server cascade declines every other pending bid; _onOwnRequest
            // flips the UI into the matched state.
        } catch (err) {
            console.error('[ride] choose bid failed:', err);
            this.toast(this.t('transit.bid_choose_failed'));
        }
    }

    endBidFeed(keepPanelClosed) {
        this.bids = {};
        try { this.rt.unsubscribe('bids'); } catch (err) { /* ignore */ }
        const feed = this.$('bid-feed');
        if (feed && !keepPanelClosed) this.hide('bid-feed');
    }

    // The nearest on-duty driver is no longer available. The request stays
    // pending so any other driver can still pick the customer up: only the
    // customer themselves, or actually riding with a driver, closes a request.
    handleNearestDriverGone() {
        this.nearestDriverId = null;
        this.nearestDriverDist = Infinity;
        if (this.ownRequestId) {
            this.toast(this.t('transit.driver_left'));
        }
    }

    /* ------------------------------------------------------------ */
    /* Driver auth + duty                                            */
    /* ------------------------------------------------------------ */
    showDriverAuth() {
        const pb = this.rt.getPocketBase();
        if (pb && pb.authStore && pb.authStore.isValid) {
            this.hide('driver-auth-panel');
            this.afterAuth();
            return;
        }
        // Token expired or lost: silently re-authenticate with the
        // registration credentials kept on this device before ever showing
        // the register form again.
        let creds = null;
        try { creds = JSON.parse(localStorage.getItem('rtm_driver_creds') || 'null'); } catch (_) { creds = null; }
        if (creds && creds.email && creds.password) {
            this.rt.authenticate(creds.email, creds.password)
                .then(() => {
                    localStorage.setItem('rtm_role', 'driver');
                    return this.afterAuth();
                })
                .catch(() => {
                    localStorage.removeItem('rtm_driver_creds');
                    this.show('driver-auth-panel');
                });
            return;
        }
        this.show('driver-auth-panel');
    }

    authError(msg) {
        const el = this.$('driver-auth-error');
        if (el) el.textContent = msg;
    }

    async doRegister() {
        const name = this.val('reg-name').trim();
        const phone = this.val('reg-phone').replace(/\D/g, '');

        if (!name || !phone) {
            this.authError(this.t('transit.register_required_fields'));
            return;
        }
        if (phone.length !== 10) {
            this.authError(this.t('transit.phone_10_digits'));
            return;
        }

        this.authError(this.t('transit.registering'));
        try {
            const res = await fetch('/api/rtm/register-driver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone,
                    vehicle_type: this.vehicleTypes[0],
                    ref: localStorage.getItem('rtm_ref') || ''
                })
            });
            const body = await res.json();
            if (!res.ok || !body.ok) {
                this.authError(body.error || this.t('transit.register_failed'));
                return;
            }
            // Establish a persisted session with the one-time credentials the
            // server issued. From now on the app auto-logs-in from localStorage.
            await this.rt.authenticate(body.email, body.password);
            localStorage.setItem('rtm_driver_creds', JSON.stringify({ email: body.email, password: body.password }));
            localStorage.setItem('rtm_role', 'driver');
            await this.afterAuth();
        } catch (err) {
            this.authError(this.t('transit.register_network'));
        }
    }

    async afterAuth() {
        const pb = this.rt.getPocketBase();
        if (!pb || !pb.authStore || !pb.authStore.isValid) {
            this.showDriverAuth();
            return;
        }
        await this.loadDriverRecord();
        this.hide('driver-auth-panel');
        this.hide('request-btn');
        this.hide('request-panel');
        this.hide('request-status');
        this.show('driver-controls');
        this.show('duty-toggle');
        this.show('full-toggle');
        this.show('info-route-section');
        this.show('info-share-section');
        this.show('info-photos-section');
        this.updateDutyButton();
        this.updateFullButton();
        this.updateDriverStats();
        this.populateRouteInput();
        this.bindProfilePhotos();
        // Every driver must have a vehicle photo on file. Nudge right after
        // login when it is still missing.
        setTimeout(() => {
            if (!this._hasVehiclePhoto) {
                this.toast(this.t('transit.vehicle_photo_required'));
                const panel = document.getElementById('info-panel');
                if (panel) panel.classList.remove('hidden');
            }
        }, 900);
        // Driver was on duty before the app was closed/backgrounded: resume
        // publishing immediately instead of forcing a fresh ON DUTY tap.
        if (this.onDuty) { if (window.setOnMapIndicator) window.setOnMapIndicator(true); this.resumeDuty(); }
        this.toast(this.t('transit.welcome_driver'));
        await this.subscribeRequests();
    }

    async loadDriverRecord() {
        const pb = this.rt.getPocketBase();
        const uid = pb.authStore.model ? pb.authStore.model.id : null;
        if (!uid) throw new Error('no session');
        // Load THIS app's driver record only. vehicle_type is immutable and
        // app-scoped, so filtering keeps a shared PocketBase from mixing apps:
        // e.g. the drive app must never load the mototaxi record (and vice
        // versa) when the same user exists across apps.
        const typeFilter = this.vehicleTypeFilter('vehicle_type');
        try {
            const rec = await pb.collection('drivers').getFirstListItem(`user = "${uid}" && ${typeFilter}`);
            this.driverRecordId = rec.id;
            this.driverVehicleType = rec.vehicle_type;
            this.route = rec.route || '';
            this.isFull = rec.is_full === true;
            this.driverRefCode = rec.referral_code || '';
            this.dutyCount = rec.duty_count || 0;
            this.referralCount = rec.referral_count || 0;
            this.shareCount = rec.share_count || 0;
            // Duty state PERSISTS across app reloads: answering a phone call,
            // locking the screen or switching apps must never silently take a
            // driver off duty. Customer maps hide drivers whose position goes
            // stale, so a phone that died overnight just turns invisible until
            // the driver reopens the app - only an explicit, confirmed
            // OFF DUTY tap clears the flag.
            this.onDuty = rec.on_duty === true;
            // Stamp last_active so an active phone (even off-duty) is not
            // pruned by the 90-day driver-expiry cleanup.
            pb.collection('drivers').update(rec.id, { last_active: Date.now() }).catch(() => {});
        } catch (err) {
            // Existing auth user without a driver record: create one now.
            const town = await this.resolveTown();
            const rec = await pb.collection('drivers').create({
                town,
                user: uid,
                name: (pb.authStore.model && pb.authStore.model.name) || '',
                vehicle_type: this.vehicleTypes[0],
                license_plate: 'SIN-PLACA',
                latitude: this.config.INITIAL_LATITUDE,
                longitude: this.config.INITIAL_LONGITUDE,
                status: 'offline',
                on_duty: false
            });
            this.driverRecordId = rec.id;
            this.driverVehicleType = rec.vehicle_type;
            this.driverRefCode = '';
        }
    }

    /* ------------------------------------------------------------ */
    /* Marketplace: driver bidding                                    */
    /* ------------------------------------------------------------ */
    openBidModal(requestId) {
        const req = this.requests[requestId];
        if (!req) return;
        let el = this.$('bid-modal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'bid-modal';
            el.className = 'cancel-confirm hidden';
            document.body.appendChild(el);
        }
        const my = this.myBids[requestId];
        const etaOpts = [0, 5, 10, 15, 20, 30, 45, 60].map((m) => {
            const label = m === 0 ? this.t('transit.bid_eta_now') : this.t('transit.bid_eta_min', { n: m });
            const sel = my && Number(my.eta_min) === m ? ' selected' : (m === 0 && !my ? ' selected' : '');
            return `<option value="${m}"${sel}>${label}</option>`;
        }).join('');
        el.innerHTML = `
            <div class="cancel-confirm-box">
                <p class="confirm-message">${req.customer_name} → ${req.destination || this.t('transit.map_pin')}</p>
                ${my ? `<p class="bid-current">${this.t('transit.bid_current')} $${Number(my.price).toFixed(0)}</p>` : ''}
                <input id="bid-price" class="bid-price-input" type="number" inputmode="numeric" min="1"
                    placeholder="${this.t('transit.bid_price_placeholder')}"
                    value="${my ? Number(my.price).toFixed(0) : ''}">
                <select id="bid-eta" class="bid-eta-select">${etaOpts}</select>
                <div class="cancel-confirm-actions">
                    <button type="button" id="bid-cancel" class="cancel-confirm-btn no">${this.t('transit.no')}</button>
                    <button type="button" id="bid-send" class="cancel-confirm-btn yes">${this.t('transit.bid_send')}</button>
                </div>
            </div>
        `;
        this.$('bid-cancel').addEventListener('click', () => el.classList.add('hidden'));
        this.$('bid-send').addEventListener('click', () => this.submitBid(requestId));
        el.classList.remove('hidden');
    }

    async submitBid(requestId) {
        const price = Math.round(Number(this.val('bid-price')));
        const etaMin = Math.round(Number(this.val('bid-eta')) || 0);
        if (!price || price <= 0) {
            this.toast(this.t('transit.bid_need_price'));
            return;
        }
        try {
            // Revising an existing offer replaces it; otherwise create a new one.
            if (this.myBids[requestId]) {
                await this.rt.updateRecord('bids', this.myBids[requestId].id, {
                    price: price,
                    eta_min: etaMin
                });
            } else {
                const rec = await this.rt.createRecord('bids', {
                    request: requestId,
                    driver: this.driverRecordId,
                    price: price,
                    eta_min: etaMin,
                    status: 'pending'
                });
                this.myBids[requestId] = rec;
            }
            this.$('bid-modal').classList.add('hidden');
            this.toast(this.t('transit.bid_sent'));
        } catch (err) {
            console.error('[ride] submit bid:', err);
            this.toast(this.t('transit.bid_failed'));
        }
    }

    async subscribeMyBids() {
        if (!this.isMarketplace || !this.driverRecordId || !this.rt.isConnected()) return;
        await this.rt.subscribe('bids', this._onMyBid, {
            filter: `driver = "${this.driverRecordId}"`
        });
    }

    _onMyBid(event) {
        if (this.role !== 'driver') return;
        const { action, record } = event;
        if (!record) return;
        if (action === 'delete') {
            for (const [rid, b] of Object.entries(this.myBids)) {
                if (b.id === record.id) delete this.myBids[rid];
            }
            return;
        }
        if (record.status === 'pending') {
            this.myBids[record.request] = record;
            return;
        }
        delete this.myBids[record.request];
        if (record.status === 'accepted') {
            // Customer picked ME. Their request stays visible as the active
            // pickup; everything else on the map is irrelevant now.
            this.toast(this.t('transit.bid_you_won'));
        } else if (record.status === 'declined' && this.requests[record.request]) {
            this.toast(this.t('transit.bid_lost'));
            // Request is matched to someone else — server flips its status so
            // _onRequest removes the marker; drop our stale bid bookkeeping.
        }
    }

    /* ------------------------------------------------------------ */
    /* Marketplace: driver profile photos                            */
    /* ------------------------------------------------------------ */
    bindProfilePhotos() {
        if (this._photosBound) return;
        const fields = ['photo', 'car_inside', 'car_outside'];
        for (const f of fields) {
            const input = this.$('upload-' + f);
            if (!input) continue;
            this._photosBound = true;
            input.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (!file || !this.driverRecordId) return;
                const fd = new FormData();
                fd.append(f, file);
                try {
                    await this.rt.updateRecord('drivers', this.driverRecordId, fd);
                    input.value = '';
                    this.toast(this.t('transit.photo_saved'));
                    this.refreshProfilePhotos();
                } catch (err) {
                    console.error('[ride] photo upload:', err);
                    this.toast(this.t('transit.photo_failed'));
                }
            });
        }
        this.refreshProfilePhotos();
    }

    refreshProfilePhotos() {
        if (!this.driverRecordId) return;
        const pb = this.rt.getPocketBase();
        pb.collection('drivers').getOne(this.driverRecordId).then((rec) => {
            this._hasVehiclePhoto = !!rec.photo;
            for (const f of ['photo', 'car_inside', 'car_outside']) {
                const img = this.$('preview-' + f);
                if (!img) continue;
                if (rec[f]) {
                    img.src = this.fileUrl('drivers', rec.id, rec[f]);
                    img.classList.remove('hidden');
                } else {
                    img.classList.add('hidden');
                }
            }
        }).catch(() => {});
    }

    async subscribeRequests() {
        if (!this.rt.isConnected()) return;
        // App isolation: a driver only sees requests for their own vehicle
        // type. vehicle_type is immutable, so it is safe to filter server-side.
        const typeFilter = this.vehicleTypeFilter('vehicle_type');
        // State-wide coverage: no town gate. Pending rides are public to all
        // drivers of this vehicle type; an ACCEPTED ride stays visible ONLY to
        // the driver who took it (their navigation pin) until it is released,
        // completed, cancelled or expired.
        const mineAccepted = this.driverRecordId
            ? ` || (status = "accepted" && accepted_driver = "${this.driverRecordId}")`
            : '';
        const filter = `(status = "pending"${mineAccepted}) && ${typeFilter}`;
        // Live subscription must NOT filter on status: PocketBase only delivers
        // events for records matching the filter, so a pending->cancelled update
        // would never reach us and the customer marker would linger until reload.
        // _onRequest removes the marker client-side for non-pending records.
        await this.rt.subscribe('ride_requests', this._onRequest, {
            filter: typeFilter
        });
        // Clear stale request markers before reloading the current pending set.
        for (const id of Object.keys(this.requests)) {
            this.removeRequestMarkers(id);
        }
        this.requests = {};
        try {
            const records = await this.rt.getRecords('ride_requests', {
                perPage: 100,
                filter: filter
            });
            for (const rec of records) {
                this.updateRequestMarker(rec);
            }
        } catch (err) {
            console.warn('[ride] load requests:', err.message);
        }
    }



    /* Gentle daily nudge when the device never got a GPS fix. */
    maybePromptLocation() {
        const today = new Date().toISOString().slice(0, 10);
        setTimeout(() => {
            if (document.hidden || this.geo.getPosition()) return;
            if (localStorage.getItem('loc_prompt_off') === today) return;
            let bar = document.getElementById('loc-banner');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'loc-banner';
                bar.style.cssText = 'position:fixed;top:calc(64px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:5900;background:#0f172a;color:#fff;border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-size:13px;box-shadow:0 6px 20px rgba(15,23,42,.35);max-width:92vw';
                document.body.appendChild(bar);
            }
            bar.innerHTML = '<span style="flex:1">' + this.t('transit.loc_banner') + '</span>' +
                '<button id="loc-banner-go" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:700;font-size:13px">' + this.t('transit.loc_activate') + '</button>' +
                '<button id="loc-banner-x" style="background:none;color:#94a3b8;border:none;font-size:16px;padding:4px">\u2715</button>';
            bar.style.display = 'flex';
            bar.querySelector('#loc-banner-go').onclick = () => { bar.style.display = 'none'; this.showLocationHelp(null); };
            bar.querySelector('#loc-banner-x').onclick = () => {
                bar.style.display = 'none';
                localStorage.setItem('loc_prompt_off', today);
            };
        }, 6000);
    }

    /* ------------------------------------------------------------ */
    /* Guided location help: phone settings + browser permission     */
    /* ------------------------------------------------------------ */
    showLocationHelp(afterFix) {
        let ov = document.getElementById('loc-help');
        if (!ov) {
            const st = document.createElement('style');
            st.textContent = [
                '#loc-help{position:fixed;inset:0;z-index:6000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}',
                '.loc-card{background:#fff;border-radius:16px 16px 0 0;padding:18px;max-width:430px;width:100%;max-height:82vh;overflow:auto;font-family:inherit}',
                '.loc-card h3{margin:0 0 10px;font-size:17px;color:#0f172a}',
                '.loc-step{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}',
                '.loc-step.hot{border-color:#f59e0b;background:#fffbeb}',
                '.loc-step b{display:block;margin-bottom:4px;color:#0f172a;font-size:14px}',
                '.loc-step p{margin:0;font-size:13px;color:#475569;line-height:1.45}',
                '.loc-status{font-size:13px;color:#b45309;min-height:18px;margin:6px 0 10px;font-weight:600}',
                '.loc-btns{display:flex;gap:8px}',
                '.loc-btn{flex:1;padding:11px;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}',
                '.loc-btn.primary{background:#2563eb;color:#fff}',
                '.loc-btn.ghost{background:#f1f5f9;color:#334155}'
            ].join('');
            document.head.appendChild(st);
            ov = document.createElement('div');
            ov.id = 'loc-help';
            document.body.appendChild(ov);
        }
        const android = /android/i.test(navigator.userAgent || '');
        const t = (k) => this.t(k);
        ov.innerHTML =
            '<div class="loc-card">' +
            '<h3>' + t('transit.loc_help_title') + '</h3>' +
            '<div class="loc-step" id="loc-step-phone"><b>' + t('transit.loc_step_phone') + '</b><p>' +
            (android ? t('transit.loc_phone_android') : t('transit.loc_phone_ios')) + '</p></div>' +
            '<div class="loc-step" id="loc-step-browser"><b>' + t('transit.loc_step_browser') + '</b><p>' +
            (android ? t('transit.loc_browser_android') : t('transit.loc_browser_ios')) + '</p></div>' +
            '<div class="loc-status" id="loc-status"></div>' +
            '<div class="loc-btns">' +
            '<button class="loc-btn ghost" id="loc-close">' + t('transit.loc_close') + '</button>' +
            '<button class="loc-btn primary" id="loc-retry">' + t('transit.loc_try_again') + '</button>' +
            '</div></div>';
        ov.style.display = 'flex';
        const close = () => { ov.style.display = 'none'; };
        ov.querySelector('#loc-close').onclick = close;
        const statusEl = ov.querySelector('#loc-status');
        const hot = (id) => {
            ['loc-step-phone', 'loc-step-browser'].forEach((x) => {
                const el = ov.querySelector('#' + x);
                if (el) el.classList.toggle('hot', x === id);
            });
        };
        ov.querySelector('#loc-retry').onclick = () => {
            if (!navigator.geolocation) return;
            statusEl.textContent = '...';
            navigator.geolocation.getCurrentPosition(() => {
                let n = 0;
                const iv = setInterval(() => {
                    if (this.geo.getPosition() || ++n > 12) {
                        clearInterval(iv);
                        if (this.geo.getPosition()) {
                            close();
                            this.toast(t('transit.loc_found'));
                            if (afterFix) afterFix();
                        } else {
                            statusEl.textContent = t('transit.loc_status_no_signal');
                            hot('loc-step-phone');
                        }
                    }
                }, 500);
            }, (err) => {
                if (err && err.code === 1) {
                    statusEl.textContent = t('transit.loc_status_denied_browser');
                    hot('loc-step-browser');
                } else {
                    statusEl.textContent = t('transit.loc_status_no_signal');
                    hot('loc-step-phone');
                }
            }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
        };
        ov.querySelector('#loc-retry').click();
    }

    async setDuty(on) {
        // Vehicle photo gate: no photo on file -> no going on duty. Open the
        // info panel where the upload lives so the fix is one tap away.
        if (on && !this._hasVehiclePhoto) {
            this.toast(this.t('transit.vehicle_photo_required'));
            const panel = document.getElementById('info-panel');
            if (panel) panel.classList.remove('hidden');
            return;
        }
        // Location gate: without a GPS fix nothing can be published.
        // Open the guided help sheet and continue automatically once
        // the driver gets a fix.
        if (on && !this.geo.getPosition()) {
            this.showLocationHelp(() => this.setDuty(true));
            return;
        }
        const ok = await this.confirm(
            on ? this.t('transit.duty_on_confirm') : this.t('transit.duty_off_confirm'),
            on ? this.t('transit.duty_on_confirm_yes') : this.t('transit.duty_off_confirm_yes')
        );
        if (!ok) return;
        this.onDuty = on;
        if (on) {
            if (window.setOnMapIndicator) window.setOnMapIndicator(true);
            this.resumeDuty();
        } else {
            if (window.setOnMapIndicator) window.setOnMapIndicator(false);
            if (this.publishTimer) {
                clearInterval(this.publishTimer);
                this.publishTimer = null;
            }
            // Stop being visible / tracked on customers' maps.
            if (this.driverRecordId && this.rt.isConnected()) {
                this.rt.updateRecord('drivers', this.driverRecordId, {
                    on_duty: false,
                    status: 'offline'
                }).catch(() => {});
            }
            // Going off duty must NEVER cancel customer requests: only the
            // customer, or actually riding together, closes a request.
            if (this.isMarketplace) {
                try { this.rt.unsubscribe('bids'); } catch (err) { /* ignore */ }
                this.myBids = {};
            }
            this.releaseWakeLock();
        }
        this.updateDutyButton();
    }

    /**
     * Start (or restart) the live publishing loop for an on-duty driver.
     * Used both when the driver taps ON DUTY and when the app reloads while
     * the driver is still marked as on duty.
     */
    resumeDuty() {
        this.acquireWakeLock();
        if (this.publishTimer) clearInterval(this.publishTimer);
        this._onGeo(this.geo.getPosition());
        this.publishTimer = setInterval(() => this._onGeo(this.geo.getPosition()), this.config.GPS_UPDATE_INTERVAL || 5000);
        // Re-fetch pending customers: while the channel may have dropped
        // (screen lock / network), make sure the request markers are back
        // and the subscription is fresh.
        this.subscribeRequests().catch(() => {});
        this.subscribeMyBids().catch(() => {});
    }

    updateDutyButton() {
        const btn = this.$('duty-toggle');
        if (!btn) return;
        if (this.onDuty) {
            btn.textContent = this.t('transit.on_duty');
            btn.classList.add('active');
        } else {
            btn.textContent = this.t('transit.off_duty');
            btn.classList.remove('active');
        }
    }

    async setFull(on) {
        const ok = await this.confirm(
            on ? this.t('transit.full_on_confirm') : this.t('transit.full_off_confirm'),
            on ? this.t('transit.yes') : this.t('transit.yes')
        );
        if (!ok) return;
        this.isFull = on;
        if (this.driverRecordId && this.rt.isConnected()) {
            this.rt.updateRecord('drivers', this.driverRecordId, {
                is_full: on,
                status: on ? 'full' : (this.onDuty ? 'available' : 'offline')
            }).catch((err) => console.warn('[ride] setFull:', err.message));
        }
        this.updateFullButton();
    }

    updateFullButton() {
        const btn = this.$('full-toggle');
        if (!btn) return;
        if (this.isFull) {
            btn.textContent = this.t('transit.full');
            btn.classList.add('active');
        } else {
            btn.textContent = this.t('transit.available');
            btn.classList.remove('active');
        }
    }

    updateDriverStats() {
        const el = this.$('driver-stats');
        if (!el) return;
        el.textContent = this.t('transit.stats_line')
            .replace('{days}', String(this.dutyCount || 0))
            .replace('{invites}', String(this.referralCount || 0));
    }

    /**
     * Share the app with the driver's referral code attached. Counts one
     * share per completed share-sheet interaction.
     */
    async shareApp() {
        const code = this.driverRefCode || '';
        const link = window.location.origin + '/' + (code ? '?ref=' + code : '');
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Yucatán en Vivo', text: this.t('transit.share_text'), url: link });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(link);
                this.toast(this.t('transit.link_copied'));
            } else {
                return;
            }
        } catch (err) {
            return; // user closed the share sheet
        }
        if (this.driverRecordId) {
            fetch('/api/rtm/driver-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: this.driverRecordId })
            }).then(() => { this.shareCount++; }).catch(() => {});
        }
    }

    // Called on every language change: static [data-i18n] elements are updated
    // by the i18n engine itself; this re-renders the JS-driven texts.
    _applyLanguage() {
        this.updateDutyButton();
        this.updateFullButton();
        this.updateRequestButton();
        this.updateDriverStats();
        for (const [id, rec] of Object.entries(this.driverRecords)) {
            if (rec.on_duty === true && this.isDriverLive(rec)) this.updateDriverMarker(rec);
        }
        for (const [id, rec] of Object.entries(this.requests)) {
            this.updateRequestMarker(rec);
        }
        const routeInput = this.$('driver-route');
        if (routeInput) routeInput.placeholder = this.t('transit.route_placeholder');
        // The confirm modal's "No" button is always the generic "No".
        const noBtn = this.$('confirm-no');
        if (noBtn) noBtn.textContent = this.t('transit.no');
    }

    populateRouteInput() {
        const input = this.$('driver-route');
        if (input) input.value = this.route || '';
    }

    async saveRoute() {
        const input = this.$('driver-route');
        const route = input ? input.value.trim() : '';
        if (!this.driverRecordId || !this.rt.isConnected()) {
            this.toast(this.t('transit.login_route_hint'));
            return;
        }
        this.route = route;
        try {
            await this.rt.updateRecord('drivers', this.driverRecordId, { route });
            this.toast(route ? this.t('transit.route_saved_prefix') + route : this.t('transit.route_removed'));
        } catch (err) {
            console.warn('[ride] save route:', err.message);
            this.toast(this.t('transit.route_save_failed'));
        }
    }

    publishDriverPosition(position) {
        if (!position || !this.driverRecordId || !this.onDuty || !this.rt.isConnected()) return;
        const now = Date.now();
        this.rt.updateRecord('drivers', this.driverRecordId, {
            latitude: position.latitude,
            longitude: position.longitude,
            heading: position.heading || null,
            speed: position.speed || 0,
            status: this.isFull ? 'full' : 'available',
            on_duty: true,
            is_full: this.isFull === true,
            last_active: now,
            route: this.route
        }).catch((err) => console.warn('[ride] publish:', err.message));
    }

    // True when a driver record's heartbeat is recent enough to trust.
    isDriverLive(record) {
        if (!record) return false;
        const lastActive = record.last_active ? Number(record.last_active) : 0;
        return lastActive > 0 && (Date.now() - lastActive) <= this.driverStaleMs;
    }

    /* ------------------------------------------------------------ */
    /* Realtime handlers                                             */
    /* ------------------------------------------------------------ */
    _onGeo(position) {
        if (!position) return;
        if (this.role === 'customer' && this.ownRequestId) {
            this.rt.updateRecord('ride_requests', this.ownRequestId, {
                customer_lat: position.latitude,
                customer_lng: position.longitude
            }).catch(() => {});
        }
        if (this.role === 'driver' && this.onDuty) {
            this.publishDriverPosition(position);
        }
    }

    // Called by the app's geolocation loop so the ride state tracks live
    // position even when the GPS watch is the only thing firing.
    onPositionUpdate(position) {
        this._onGeo(position);
    }

    _onDriver(event) {
        // Customers track nearby drivers; drivers also listen so their own
        // marker flips red/green live (FULL toggle) and they can see
        // colleagues on the road.
        if (this.role !== 'customer' && this.role !== 'driver') return;
        const { action, record } = event;
        // A driver must not see themselves on the map - skip own updates.
        if (this.role === 'driver' && record.id === this.driverRecordId) {
            this.map.removeMarker('drv_' + record.id);
            return;
        }
        if (action === 'delete') {
            this.map.removeMarker('drv_' + record.id);
            delete this.driverPositions[record.id];
            delete this.driverRecords[record.id];
            if (record.id === this.nearestDriverId) {
                this.handleNearestDriverGone();
            }
            return;
        }
        if (!this.vehicleTypes.includes(record.vehicle_type)) return;
        if (record.on_duty !== true || !this.isDriverLive(record)) {
            this.map.removeMarker('drv_' + record.id);
            delete this.driverRecords[record.id];
            if (record.id === this.nearestDriverId) {
                this.handleNearestDriverGone();
            }
            return;
        }
        this.updateDriverMarker(record);
        this.detectPickup(record);
    }

    updateDriverMarker(record) {
        this.driverRecords[record.id] = record;
        const isFull = record.is_full === true;
        const entityType = isFull ? record.vehicle_type + '-full' : record.vehicle_type;
        const fullBadge = isFull
            ? `<span class="driver-popup-full">${this.t('transit.full')}</span>`
            : '';
        this.map.updateMarker('drv_' + record.id, record.latitude, record.longitude, {
            appType: 'transit',
            entityType,
            popupContent: `
                <div class="driver-popup">
                    ${record.photo ? `<img class="driver-popup-photo" src="${this.fileUrl('drivers', record.id, record.photo)}" alt="">` : ''}
                    <h3>${(record.vehicle_type || 'mototaxi').toUpperCase()}${fullBadge}</h3>
                    ${record.name ? `<p>${record.name}</p>` : ''}
                    ${record.route ? `<p>${this.t('transit.route_label')}${record.route}</p>` : ''}
                    ${record.license_plate ? `<p>${this.t('transit.plate_label')}${record.license_plate}</p>` : ''}
                </div>
            `
        });
    }

    detectPickup(record) {
        if (!this.ownRequestId) return;
        const pos = this.geo.getPosition();
        if (!pos) return;
        const dist = this.geo.calculateDistance(pos.latitude, pos.longitude, record.latitude, record.longitude);
        this.driverPositions[record.id] = { lat: record.latitude, lng: record.longitude };

        if (dist < this.nearestDriverDist) {
            this.nearestDriverDist = dist;
            this.nearestDriverId = record.id;
        }

        // A request is only auto-closed when the customer is actually RIDING
        // WITH the driver: both moving, close together, heading the same way,
        // and this condition holding across consecutive updates (~10s) so a
        // vehicle merely passing by doesn't close the request.
        const riderSpeed = pos.speed || 0;
        const driverSpeed = record.speed || 0;
        const movingTogether = dist < this.pickupDistance &&
            riderSpeed > 2 &&
            driverSpeed > 2 &&
            this.sameHeading(pos.heading, record.heading);

        this.rideStreak[record.id] = movingTogether ? (this.rideStreak[record.id] || 0) + 1 : 0;
        if (this.rideStreak[record.id] >= 2) {
            this.completeOwnRequest();
        }
    }

    sameHeading(a, b) {
        if (a == null || b == null) return true;
        const diff = Math.abs(a - b) % 360;
        return Math.min(diff, 360 - diff) <= 60;
    }

    _onRequest(event) {
        if (this.role !== 'driver') return;
        const { action, record } = event;
        if (!this.vehicleTypes.includes(record.vehicle_type)) return;
        if (action === 'delete') {
            this.removeRequestMarkers(record.id);
            delete this.requests[record.id];
            return;
        }
        // Visible: open rides for everyone + MY accepted ride while I drive to
        // it. Anything else (someone else's accepted ride, completed,
        // cancelled, expired) disappears from my map.
        const mine = record.status === 'accepted' && record.accepted_driver === this.driverRecordId;
        if (record.status === 'pending' || mine) {
            if (this._activeRideId && this._activeRideId !== record.id && !mine) {
                delete this._activeRideId;
            }
            this.updateRequestMarker(record);
        } else {
            const wasMine = this._activeRideId === record.id;
            this.removeRequestMarkers(record.id);
            delete this.requests[record.id];
            if (wasMine) {
                delete this._activeRideId;
                if (record.status === 'completed') {
                    this.toast(this.t('transit.ride_completed'));
                } else if (record.status !== 'accepted') {
                    this.toast(this.t('transit.request_cancelled'));
                }
            }
        }
    }

    // Remove both the customer (person) and destination (pin) markers for a request.
    removeRequestMarkers(id) {
        this.map.removeMarker('req_' + id);
        this.map.removeMarker('reqdest_' + id);
    }

    updateRequestMarker(record) {
        this.requests[record.id] = record;
        const mine = record.status === 'accepted' && record.accepted_driver === this.driverRecordId;
        const destTxt = `${this.t('transit.dest_prefix')}${record.destination || this.t('transit.map_pin')}`;
        // Privacy + decision flow: the destination is only revealed inside
        // THIS popup (opened by tapping the pin) — never as a map marker.
        let inner;
        if (mine) {
            // My active job: keep the pickup visible with completion controls.
            inner = `
                <h3>&#128994; ${this.t('transit.en_route')}</h3>
                <p>${record.customer_name}</p>
                <p>${destTxt}</p>
                <button class="bid-offer-btn" type="button" onclick="window.__rideApp.completeRide('${record.id}')">${this.t('transit.complete_ride')}</button>
                <button class="bid-offer-btn" type="button" style="background:#fee2e2;color:#b91c1c" onclick="window.__rideApp.releaseRide('${record.id}')">${this.t('transit.release_ride')}</button>`;
        } else {
            const offerBtn = this.isMarketplace
                ? `<button class="bid-offer-btn" type="button" onclick="window.__rideApp.openBidModal('${record.id}')">${this.t('transit.bid_offer')}</button>`
                : '';
            inner = `
                <h3>${record.customer_name}</h3>
                <p>${destTxt}</p>
                ${offerBtn}
                <button class="bid-offer-btn" type="button" onclick="window.__rideApp.acceptRequest('${record.id}')">${this.t('transit.accept_ride')}</button>`;
        }
        this.map.updateMarker('req_' + record.id, record.customer_lat, record.customer_lng, {
            appType: 'transit',
            entityType: 'customer',
            popupContent: `<div class="request-popup">${inner}</div>`
        });
        // No separate destination marker: every driver would see every
        // destination at a glance. The popup above is the single source.
        this.map.removeMarker('reqdest_' + record.id);
    }

    /* ------------------------------------------------------------ */
    /* Driver ride actions (accept / release / complete)             */
    /* ------------------------------------------------------------ */
    async _requestAction(id, action, okMsg) {
        try {
            const pb = this.rt.getPocketBase();
            const res = await fetch('/api/rtm/request-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: id, action, token: pb.authStore.token })
            });
            const body = await res.json();
            if (!res.ok || !body.ok) throw new Error(body.error || 'failed');
            if (okMsg) this.toast(okMsg);
            return true;
        } catch (err) {
            const msg = String(err && err.message || '');
            this.toast(msg.includes('already taken') ? this.t('transit.ride_taken') : this.t('transit.request_action_failed'));
            return false;
        }
    }

    async acceptRequest(id) {
        const ok = await this._requestAction(id, 'accept', this.t('transit.en_route'));
        if (ok) {
            this._activeRideId = id;
            this.map.closePopup();
        }
    }

    completeRide(id) {
        this._requestAction(id, 'complete');
    }

    releaseRide(id) {
        this._requestAction(id, 'release');
    }

    /* ------------------------------------------------------------ */
    /* Town resolution + helpers                                     */
    /* ------------------------------------------------------------ */
    async resolveTown() {
        if (this.town) return this.town;
        const pb = this.rt.getPocketBase();
        const rec = await pb.collection('towns').getFirstListItem(`town_id = "${this.config.TOWN_ID}"`);
        this.town = rec.id;
        return this.town;
    }

    toast(message) {
        let el = this.$('ride-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ride-toast';
            el.className = 'ride-toast hidden';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
    }

    async acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                // Wake lock not granted; geolocation still runs.
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            try {
                this.wakeLock.release();
            } catch (err) {
                // ignore
            }
            this.wakeLock = null;
        }
    }

    bindVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Immediately re-publish the latest position when the app
                // returns to the foreground.
                const pos = this.geo.getPosition();
                if (pos) this._onGeo(pos);
                if (this.role === 'customer' && this.ownRequestId) this.acquireWakeLock();
                if (this.role === 'driver' && this.onDuty) this.acquireWakeLock();
            }
        });
    }

    bind() {
        const byId = (id) => {
            const el = this.$(id);
            return el ? el.addEventListener.bind(el) : () => {};
        };

        byId('role-customer-btn')('click', () => this.chooseRole('customer'));
        byId('role-driver-btn')('click', () => this.chooseRole('driver'));

        byId('driver-auth-close')('click', () => {
            this.hide('driver-auth-panel');
            localStorage.removeItem('rtm_role');
            // The role overlay is toggled via inline style.display (not the
            // `hidden` class), so restore it explicitly to return the driver
            // to the Client/Driver selection screen.
            const roleOverlay = this.$('role-overlay');
            if (roleOverlay) roleOverlay.style.display = 'flex';
        });
        byId('driver-register-btn')('click', () => this.doRegister());

        byId('duty-toggle')('click', () => this.setDuty(!this.onDuty));
        // iOS freezes web app timers the moment the screen locks, so an
        // on-duty driver's heartbeat dies and the server's duty-reset cron
        // takes them off duty within 3 minutes. When the page becomes
        // visible again, republish immediately: back on the map in seconds
        // instead of silently staying off duty until a manual re-toggle.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (this.role === 'driver' && this.onDuty) {
                try { this._onGeo(this.geo.getPosition()); } catch (err) { /* GPS may not be ready yet */ }
                this.resumeDuty();
                this.updateDutyButton();
            }
        });
        byId('full-toggle')('click', () => this.setFull(!this.isFull));
        byId('route-save-btn')('click', () => this.saveRoute());
        byId('share-app-btn')('click', () => this.shareApp());

        byId('request-btn')('click', () => {
            if (this.ownRequestId) {
                this.cancelOwnRequest();
            } else {
                this.openRequestPanel();
            }
        });
        byId('req-close')('click', () => {
            this.hide('request-panel');
            this.map.removeMarker('dest_pin');
        });
        byId('req-dest-type')('click', () => {
            this.show('req-dest');
            this.$('req-dest').focus();
        });
        byId('req-dest-pin')('click', () => this.activatePinMode());
        byId('req-dest')('change', () => this.typeDestination());
        byId('req-dest')('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.typeDestination();
            }
        });
        byId('req-submit')('click', () => this.createRequest());
    }
}

// Class declarations do not create a property on the global object in classic
// scripts, so expose explicitly for window.RideApp consumers.
if (typeof window !== 'undefined') {
    window.RideApp = RideApp;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RideApp;
}
