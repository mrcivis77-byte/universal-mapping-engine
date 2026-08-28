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

        // A driver counts as live only if last_active is fresh. This is the
        // watchdog that hides "ghost" buses: an on-duty record whose heartbeat
        // stopped (app closed, network drop) must disappear instead of lingering.
        const interval = Number(this.config.GPS_UPDATE_INTERVAL || 5000);
        this.driverStaleMs = interval * 3 + 30000; // ~45s @5s interval
        this._staleSweepTimer = null;

        // Customer state
        this.ownRequestId = null;
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

        // Bidding state
        this.bids = {}; // bidId -> bid record
        this.currentBidId = null;
        this.acceptedBid = null;

        // Driver state
        this.driverRecordId = null;
        this.driverVehicleType = null;
        this.route = '';
        this.onDuty = false;
        this.isFull = false;
        this.publishTimer = null;
        this.requests = {}; // requestId -> record
        this.wakeLock = null;
        this.regMethod = 'phone'; // phone-only identity (no passwords)

        // First-window headline: use APP_NAME from config if present
        const wt = document.getElementById('welcome-title');
        if (wt && this.config && this.config.APP_NAME) {
            wt.textContent = this.config.APP_NAME;
        }

        this._onGeo = this._onGeo.bind(this);
        this._onDriver = this._onDriver.bind(this);
        this._onRequest = this._onRequest.bind(this);
        this._applyLanguage = this._applyLanguage.bind(this);

        this.bind();
        this.bindVisibility();
        document.addEventListener('languageChanged', this._applyLanguage);
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
        this.show('role-overlay');
        return new Promise((resolve) => {
            this._roleResolve = resolve;
        });
    }

    chooseRole(role) {
        this.role = role;
        this.hide('role-overlay');
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
        this.updatePresenceIndicators();
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
        this.hide('bid-panel');
        this.show('request-btn');
        this.updatePresenceIndicators();
        this.updateRequestButton();
        
        // Ensure destination label is correct for the app type
        // This runs immediately since we need to show the right label when Customer role is clicked
        this.ensureDestinationLabel();
        
        await this.subscribeDrivers();
        await this.subscribeBids();
    }
    
    // Guaranteed label update - called from multiple places
    ensureDestinationLabel() {
        const optionalLabel = document.getElementById('dest-label-optional');
        const requiredLabel = document.getElementById('dest-label-required');
        if (optionalLabel && requiredLabel) {
            // Always show the correct label based on app type
            // isFixedRoute = true means BUS app (no destination required)
            // isFixedRoute = false means MOTO/DRIVE app (destination required)
            if (this.isFixedRoute) {
                optionalLabel.classList.remove('hidden');
                requiredLabel.classList.add('hidden');
            } else {
                optionalLabel.classList.add('hidden');
                requiredLabel.classList.remove('hidden');
            }
        }
    }

    async subscribeDrivers() {
        if (!this.rt.isConnected()) return;
        // App isolation: this app only ever shows drivers of its own vehicle
        // type, so a bus customer never sees mototaxis and vice versa.
        const typeFilter = this.vehicleTypeFilter('vehicle_type');
        const filter = `on_duty = true && town.town_id = "${this.config.TOWN_ID}" && ${typeFilter}`;
        // The live subscription must NOT filter on on_duty: PocketBase only
        // delivers events for records matching the filter, so an on_duty=false
        // update would never reach us and the marker would linger until reload.
        // _onDriver removes the marker client-side when on_duty !== true.
        await this.rt.subscribe('drivers', this._onDriver, {
            filter: `town.town_id = "${this.config.TOWN_ID}" && ${typeFilter}`
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
            this.updatePresenceIndicators();
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
            let changed = false;
            for (const [id, rec] of Object.entries(this.driverRecords)) {
                if (!this.isDriverLive(rec)) {
                    this.map.removeMarker('drv_' + id);
                    delete this.driverRecords[id];
                    delete this.driverPositions[id];
                    if (id === this.nearestDriverId) {
                        this.handleNearestDriverGone();
                    }
                    changed = true;
                }
            }
            if (changed) this.updatePresenceIndicators();
        }, this.driverStaleMs / 2);
    }

    _stopStaleSweep() {
        if (this._staleSweepTimer) {
            clearInterval(this._staleSweepTimer);
            this._staleSweepTimer = null;
        }
    }

    // Subscribe to bids for customer view
    async subscribeBids() {
        if (!this.rt.isConnected() || !this.ownRequestId) return;

        // Subscribe to bid updates for this request
        await this.rt.subscribe('bids', (event) => {
            if (this.role !== 'customer') return;
            const { action, record } = event;

            if (action === 'create' && record.request === this.ownRequestId) {
                // New bid from driver
                this.bids[record.id] = record;
                this.showBidList();
            } else if (action === 'update') {
                if (record.request === this.ownRequestId) {
                    if (record.status === 'accepted') {
                        this.acceptedBid = record.id;
                        this.hide('bid-panel');
                        this.toast(this.t('transit.bid_accepted'));
                    } else if (record.status === 'rejected') {
                        delete this.bids[record.id];
                        this.showBidList();
                    }
                }
            }
        }, {
            filter: `request = "${this.ownRequestId}"`
        });
    }

    // Show bid list for customer
    showBidList() {
        const bidPanel = this.$('bid-panel');
        if (!bidPanel) return;

        bidPanel.classList.remove('hidden');
        this.loadBidsForRequest(this.ownRequestId);
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
            // Geocoding failed - show error and clear destination
            this.reqError(this.t('transit.type_place_error'));
            const display = this.$('req-dest-display');
            if (display) {
                display.classList.add('hidden');
            }
            this.dest = null;
            this.map.removeMarker('dest_pin');
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

    async createRequest() {
        // Name is optional; destination is REQUIRED for mototaxi (drivers need it for quotes)
        const name = this.val('req-name').trim() || 'Cliente';
        
        // Destination is REQUIRED for mototaxi rides - drivers need to know where to quote
        // For non-fixed-route apps, destination must be explicitly chosen (geocoded or pin drop)
        if (!this.isFixedRoute) {
            // Must have a destination with both coordinates AND a name
            if (!this.dest || !this.dest.name || !this.dest.lat || !this.dest.lng) {
                this.reqError(this.t('transit.destination_required'));
                return;
            }
        }
        
        const pos = this.geo.getPosition();
        if (!pos) {
            this.reqError('Ubicación no disponible');
            return;
        }

        try {
            const town = await this.resolveTown();
            const data = {
                town,
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
            this.hide('request-panel');
            this.hide('request-status');
            this.updateRequestButton();
            this.map.removeMarker('dest_pin');
            this.acquireWakeLock();
            this.toast(this.t('transit.request_sent'));
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
        this.ownRequestId = null;
        this.ownRequest = null;
        this.nearestDriverId = null;
        this.nearestDriverDist = Infinity;
        this.rideStreak = {};
        this.hide('request-status');
        this.updateRequestButton();
        this.show('request-btn');
        this.toast(message);
        this.releaseWakeLock();
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
        this.show('driver-auth-panel');
        // Restore an existing session if valid
        const pb = this.rt.getPocketBase();
        if (pb && pb.authStore && pb.authStore.isValid) {
            this.afterAuth();
        }
    }

    authError(msg) {
        const el = this.$('driver-auth-error');
        if (el) el.textContent = msg;
    }

    async doRegister() {
        const name = this.val('reg-name').trim();
        const phone = this.val('reg-phone').replace(/\D/g, '');
        const invite = this.val('reg-invite').trim();

        if (!name || !phone || !invite) {
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
                    invite_code: invite,
                    vehicle_type: this.vehicleTypes[0]
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
        this.updateDutyButton();
        this.updateFullButton();
        this.populateRouteInput();
        this.toast(this.t('transit.welcome_driver'));
        await this.subscribeRequests();
        this.updatePresenceIndicators();
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
            // A fresh app load starts the driver OFF duty. Clear any stale
            // on_duty flag left in the DB by a previous session (app closed
            // without going off duty) so customers don't see a ghost bus that
            // isn't really on duty. The driver must explicitly go ON duty.
            // Also stamp last_active so an active phone (even off-duty) is not
            // pruned by the 90-day driver-expiry cleanup.
            const patch = { last_active: Date.now() };
            if (rec.on_duty === true) {
                patch.on_duty = false;
                patch.status = 'offline';
            }
            pb.collection('drivers').update(rec.id, patch).catch(() => {});
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
        }
    }

    async subscribeRequests() {
        if (!this.rt.isConnected()) return;
        // App isolation: a driver only sees requests for their own vehicle
        // type. vehicle_type is immutable, so it is safe to filter server-side.
        const typeFilter = this.vehicleTypeFilter('vehicle_type');
        const filter = `status = "pending" && town.town_id = "${this.config.TOWN_ID}" && ${typeFilter}`;
        // Live subscription must NOT filter on status: PocketBase only delivers
        // events for records matching the filter, so a pending->cancelled update
        // would never reach us and the customer marker would linger until reload.
        // _onRequest removes the marker client-side for non-pending records.
        await this.rt.subscribe('ride_requests', this._onRequest, {
            filter: `town.town_id = "${this.config.TOWN_ID}" && ${typeFilter}`
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
            this.updatePresenceIndicators();
        } catch (err) {
            console.warn('[ride] load requests:', err.message);
        }
    }

    async setDuty(on) {
        const ok = await this.confirm(
            on ? this.t('transit.duty_on_confirm') : this.t('transit.duty_off_confirm'),
            on ? this.t('transit.duty_on_confirm_yes') : this.t('transit.duty_off_confirm_yes')
        );
        if (!ok) return;
        this.onDuty = on;
        if (on) {
            this.acquireWakeLock();
            if (this.publishTimer) clearInterval(this.publishTimer);
            this._onGeo(this.geo.getPosition());
            this.publishTimer = setInterval(() => this._onGeo(this.geo.getPosition()), this.config.GPS_UPDATE_INTERVAL || 5000);
            // Re-fetch pending customers: while off duty the live channel may
            // have dropped (screen lock / network), so make sure the request
            // markers are back and the subscription is fresh.
            this.subscribeRequests().catch(() => {});
        } else {
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
            this.releaseWakeLock();
        }
        this.updateDutyButton();
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

    // Called on every language change: static [data-i18n] elements are updated
    // by the i18n engine itself; this re-renders the JS-driven texts.
    _applyLanguage() {
        this.updateDutyButton();
        this.updateFullButton();
        this.updateRequestButton();
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
        if (this.role !== 'customer') return;
        const { action, record } = event;
        if (action === 'delete') {
            this.map.removeMarker('drv_' + record.id);
            delete this.driverPositions[record.id];
            delete this.driverRecords[record.id];
            if (record.id === this.nearestDriverId) {
                this.handleNearestDriverGone();
            }
            this.updatePresenceIndicators();
            return;
        }
        if (!this.vehicleTypes.includes(record.vehicle_type)) return;
        if (record.on_duty !== true || !this.isDriverLive(record)) {
            this.map.removeMarker('drv_' + record.id);
            delete this.driverRecords[record.id];
            if (record.id === this.nearestDriverId) {
                this.handleNearestDriverGone();
            }
            this.updatePresenceIndicators();
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
                    <h3>${(record.vehicle_type || 'mototaxi').toUpperCase()}${fullBadge}</h3>
                    ${record.name ? `<p>${record.name}</p>` : ''}
                    ${record.route ? `<p>${this.t('transit.route_label')}${record.route}</p>` : ''}
                    ${record.license_plate ? `<p>${this.t('transit.plate_label')}${record.license_plate}</p>` : ''}
                </div>
            `
        });
        this.updatePresenceIndicators();
    }

    detectPickup(record) {
        // Track driver positions and nearest driver for pickup detection
        if (!this.ownRequestId) return;
        const pos = this.geo.getPosition();
        if (!pos) return;
        const dist = this.geo.calculateDistance(pos.latitude, pos.longitude, record.latitude, record.longitude);
        this.driverPositions[record.id] = { lat: record.latitude, lng: record.longitude };

        if (dist < this.nearestDriverDist) {
            this.nearestDriverDist = dist;
            this.nearestDriverId = record.id;
        }

        // Track if customer and driver are together for pickup confirmation
        // but don't auto-complete - driver must explicitly complete the ride
        const riderSpeed = pos.speed || 0;
        const driverSpeed = record.speed || 0;
        const movingTogether = dist < this.pickupDistance &&
            riderSpeed > 2 &&
            driverSpeed > 2 &&
            this.sameHeading(pos.heading, record.heading);

        this.rideStreak[record.id] = movingTogether ? (this.rideStreak[record.id] || 0) + 1 : 0;
        // Do NOT auto-complete here - driver must complete manually
    }

    sameHeading(a, b) {
        if (a == null || b == null) return true;
        const diff = Math.abs(a - b) % 360;
        return Math.min(diff, 360 - diff) <= 60;
    }

    updatePresenceIndicators() {
        const driversIndicator = document.getElementById('drivers-indicator');
        const clientsIndicator = document.getElementById('clients-indicator');
        const driversCount = document.getElementById('drivers-count');
        const clientsCount = document.getElementById('clients-count');

        console.log('[Presence] Updating indicators:', {
            driversIndicator: !!driversIndicator,
            clientsIndicator: !!clientsIndicator,
            driversCount: !!driversCount,
            clientsCount: !!clientsCount,
            role: this.role,
            activeDrivers: Object.keys(this.driverRecords).length,
            activeClients: Object.keys(this.requests).length
        });

        if (!driversIndicator || !clientsIndicator || !driversCount || !clientsCount) {
            console.log('[Presence] Missing DOM elements');
            return;
        }

        // Determine visibility based on role
        if (this.role === 'customer') {
            // Clients see drivers on map
            driversIndicator.style.display = 'inline-flex';
            clientsIndicator.style.display = 'none'; // clients don't need to see other clients
            // Ensure destination label is correct for customer role
            this.ensureDestinationLabel();
        } else if (this.role === 'driver') {
            // Drivers see clients on map
            driversIndicator.style.display = 'none'; // drivers don't need to see other drivers
            clientsIndicator.style.display = 'inline-flex';
        } else {
            // No role selected yet, show both
            driversIndicator.style.display = 'inline-flex';
            clientsIndicator.style.display = 'inline-flex';
        }

        // Count active drivers on map
        const activeDrivers = Object.keys(this.driverRecords).length;
        driversCount.textContent = String(activeDrivers);

        // Count active clients/requests on map
        const activeClients = Object.keys(this.requests).length;
        clientsCount.textContent = String(activeClients);

        // Update driver indicator state (color based on activity)
        if (activeDrivers > 0) {
            driversIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
            driversIndicator.style.borderColor = '#10b981';
            driversIndicator.style.color = '#10b981';
            // Set vehicle icon based on vehicle type
            const vehicleIcon = this.getVehicleIcon();
            const currentText = driversIndicator.innerHTML;
            const newIcon = vehicleIcon;
            driversIndicator.innerHTML = currentText.replace(/^[🚗🛺🚌🏍️]/, newIcon);
        } else {
            driversIndicator.style.background = 'rgba(239, 68, 68, 0.1)';
            driversIndicator.style.borderColor = '#ef4444';
            driversIndicator.style.color = '#ef4444';
            // Set default vehicle icon even when inactive
            const vehicleIcon = this.getVehicleIcon();
            const currentText = driversIndicator.innerHTML;
            const newIcon = vehicleIcon;
            driversIndicator.innerHTML = currentText.replace(/^[🚗🛺🚌🏍️]/, newIcon);
        }

        // Update client indicator state
        if (activeClients > 0) {
            clientsIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
            clientsIndicator.style.borderColor = '#10b981';
            clientsIndicator.style.color = '#10b981';
        } else {
            clientsIndicator.style.background = 'rgba(239, 68, 68, 0.1)';
            clientsIndicator.style.borderColor = '#ef4444';
            clientsIndicator.style.color = '#ef4444';
        }
        
        console.log('[Presence] Indicators updated successfully');
    }

    getVehicleIcon() {
        // Return appropriate icon based on vehicle type
        if (this.vehicleTypes.includes('bus')) return '🚌';
        if (this.vehicleTypes.includes('mototaxi')) return '🛺';
        if (this.vehicleTypes.includes('drive')) return '🚗';
        if (this.vehicleTypes.includes('moto')) return '🏍️';
        return '🚗'; // default
    }

    _onRequest(event) {
        if (this.role !== 'driver') return;
        const { action, record } = event;
        if (!this.vehicleTypes.includes(record.vehicle_type)) return;
        if (action === 'delete') {
            this.removeRequestMarkers(record.id);
            delete this.requests[record.id];
            this.updatePresenceIndicators();
            return;
        }
        if (record.status === 'pending') {
            this.updateRequestMarker(record);
        } else {
            this.removeRequestMarkers(record.id);
            delete this.requests[record.id];
            this.updatePresenceIndicators();
        }
    }

    // Remove both the customer (person) and destination (pin) markers for a request.
    removeRequestMarkers(id) {
        this.map.removeMarker('req_' + id);
        this.map.removeMarker('reqdest_' + id);
    }

    updateRequestMarker(record) {
        this.requests[record.id] = record;
        
        // For non-fixed-route apps, ensure destination exists
        // Auto-cancel requests without destination
        if (!this.isFixedRoute && (!record.dest_lat || !record.dest_lng)) {
            // Request has no destination - auto-cancel it
            this.cancelMissingDestinationRequest(record.id);
            return;
        }
        
        // Build destination display string
        let destDisplay = '';
        if (record.destination) {
            destDisplay = record.destination;
        } else if (record.dest_lat && record.dest_lng) {
            // Show coordinates if no name
            destDisplay = `${record.dest_lat.toFixed(4)}, ${record.dest_lng.toFixed(4)}`;
        } else {
            destDisplay = this.t('transit.map_pin');
        }
        
        // Person icon = where the customer is now.
        this.map.updateMarker('req_' + record.id, record.customer_lat, record.customer_lng, {
            appType: 'transit',
            entityType: 'customer',
            popupContent: `
                <div class="request-popup">
                    <h3>${record.customer_name}</h3>
                    <p>${this.t('transit.dest_prefix')}${destDisplay}</p>
                </div>
            `
        });
        // Destination pin = where the customer wants to go, tied to this request.
        // Fixed-route apps (bus) have no destination — the driver just sees the
        // customer waiting at the stop.
        if (!this.isFixedRoute && record.dest_lat && record.dest_lng) {
            this.map.updateMarker('reqdest_' + record.id, record.dest_lat, record.dest_lng, {
                appType: 'transit',
                entityType: 'dest',
                popupContent: `
                    <div class="request-popup">
                        <h3>${record.customer_name}</h3>
                        <p>${this.t('transit.dest_prefix')}${destDisplay}</p>
                    </div>
                `
            });
        } else {
            this.map.removeMarker('reqdest_' + record.id);
        }
        this.updatePresenceIndicators();
    }
    
    // Cancel requests that lack destination (for non-fixed-route apps)
    async cancelMissingDestinationRequest(requestId) {
        // Remove the request marker
        this.map.removeMarker('req_' + requestId);
        this.map.removeMarker('reqdest_' + requestId);
        delete this.requests[requestId];
        this.updatePresenceIndicators();
        
        // Try to cancel on the server (if still pending)
        try {
            if (this.rt && this.rt.isConnected()) {
                await this.rt.updateRecord('ride_requests', requestId, { status: 'cancelled' });
            }
        } catch (err) {
            // Silently fail - request may already be gone
        }
    }

    /* ------------------------------------------------------------ */
    /* Pricing Calculator                                            */
    /* ------------------------------------------------------------ */

    // Calculate estimated price based on distance and time
    // Formula: 1 peso/km + maintenance cost + license fee + time buffer
    calculatePrice(distanceKm, estimatedTimeMinutes) {
        // Base fare: 1 peso per km
        const distancePrice = distanceKm * 1;
        
        // Maintenance cost (30 pesos per ride as buffer)
        const maintenanceCost = 30;
        
        // License fee (10 pesos per ride)
        const licenseFee = 10;
        
        // Time buffer (2 pesos per minute, minimum 5 pesos)
        const timeBuffer = Math.max(5, estimatedTimeMinutes * 2);
        
        const total = Math.round(distancePrice + maintenanceCost + licenseFee + timeBuffer);
        
        return {
            distancePrice: Math.round(distancePrice),
            maintenanceCost,
            licenseFee,
            timeBuffer: Math.round(timeBuffer),
            total
        };
    }

    // Calculate estimated time based on distance
    estimateTime(distanceKm, speedKmh = 30) {
        // Average speed of 30 km/h for mototaxi
        const hours = distanceKm / speedKmh;
        const minutes = Math.round(hours * 60);
        return minutes;
    }

    /* ------------------------------------------------------------ */
    /* Bidding System                                                */
    /* ------------------------------------------------------------ */

    // Customer: submit a bid for their ride request
    async submitBid(estimatedPrice, estimatedTime) {
        if (!this.ownRequestId) return;
        try {
            const bidData = {
                town: await this.resolveTown(),
                driver: null, // Will be set when driver accepts
                request: this.ownRequestId,
                pickup_lat: this.geo.getPosition().latitude,
                pickup_lng: this.geo.getPosition().longitude,
                dest_lat: this.dest?.lat || null,
                dest_lng: this.dest?.lng || null,
                destination: this.dest?.name || null,
                estimated_price: estimatedPrice,
                estimated_time: estimatedTime,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            const bid = await this.rt.createRecord('bids', bidData);
            this.currentBidId = bid.id;
            this.bids[bid.id] = bid;
            this.toast(this.t('transit.bid_submitted'));
            this.updateBiddingUI();
        } catch (err) {
            console.error('[ride] submit bid failed:', err);
            this.toast(this.t('transit.bid_failed'));
        }
    }

    // Customer: accept a bid
    async acceptBid(bidId) {
        try {
            const bid = this.bids[bidId];
            if (!bid) return;

            // Update bid status to accepted
            await this.rt.updateRecord('bids', bidId, { status: 'accepted' });
            this.acceptedBid = bidId;

            // Update the ride request to link to this bid
            await this.rt.updateRecord('ride_requests', this.ownRequestId, {
                status: 'assigned',
                winning_bid: bidId
            });

            // Notify other drivers to remove their bids
            const pb = this.rt.getPocketBase();
            const existingBids = await pb.collection('bids').getFullList({
                filter: `request = "${this.ownRequestId}" && id != "${bidId}"`
            });
            for (const b of existingBids) {
                await pb.collection('bids').update(b.id, { status: 'rejected' });
            }

            this.toast(this.t('transit.bid_accepted'));
            this.hide('bid-panel');
            this.show('request-status');
        } catch (err) {
            console.error('[ride] accept bid failed:', err);
            this.toast(this.t('transit.bid_accept_failed'));
        }
    }

    // Driver: get pending requests for bidding
    async getPendingBids() {
        try {
            const typeFilter = this.vehicleTypeFilter('vehicle_type');
            const records = await this.rt.getRecords('bids', {
                perPage: 50,
                filter: `status = 'pending' && town.town_id = "${this.config.TOWN_ID}" && request.town.${typeFilter}`
            });
            return records;
        } catch (err) {
            console.warn('[ride] get bids:', err.message);
            return [];
        }
    }

    // Driver: accept a bid
    async driverAcceptBid(bidId) {
        try {
            const pb = this.rt.getPocketBase();
            const bid = await pb.collection('bids').getOne(bidId);

            // Update driver status to busy
            await pb.collection('drivers').update(this.driverRecordId, {
                status: 'busy',
                on_duty: true
            });

            // Link driver to bid
            await pb.collection('bids').update(bidId, {
                driver: this.driverRecordId,
                status: 'accepted'
            });

            // Update ride request
            await pb.collection('ride_requests').update(bid.request, {
                status: 'assigned',
                winning_bid: bidId
            });

            this.toast(this.t('transit.bid_driver_accepted'));
            return true;
        } catch (err) {
            console.error('[ride] driver accept bid failed:', err);
            this.toast(this.t('transit.bid_failed'));
            return false;
        }
    }

    // Driver: reject a bid
    async driverRejectBid(bidId) {
        try {
            await this.rt.updateRecord('bids', bidId, { status: 'rejected' });
            this.toast(this.t('transit.bid_rejected'));
        } catch (err) {
            console.warn('[ride] reject bid:', err.message);
        }
    }

    // Update UI for bidding (client-side)
    updateBiddingUI() {
        const bidPanel = this.$('bid-panel');
        const bidStatus = this.$('bid-status');

        if (!bidPanel || !bidStatus) return;

        if (this.currentBidId) {
            bidStatus.textContent = this.t('transit.bid_status_pending');
            bidStatus.classList.remove('hidden');
        } else {
            bidStatus.classList.add('hidden');
        }
    }

    // Load and display bids for customer
    async loadBidsForRequest(requestId) {
        try {
            const pb = this.rt.getPocketBase();
            const bids = await pb.collection('bids').getFullList({
                filter: `request = "${requestId}" && status = 'pending'`
            });

            const bidListEl = this.$('bid-list');
            if (!bidListEl) return;

            bidListEl.innerHTML = '';
            for (const bid of bids) {
                // Get driver name and photo
                let driverName = 'Driver';
                let driverAvatar = '';
                if (bid.driver) {
                    const driverId = typeof bid.driver === 'object' ? bid.driver.id : bid.driver;
                    try {
                        const driverRec = await pb.collection('drivers').getOne(driverId);
                        driverName = driverRec.name || 'Driver';
                        if (driverRec.avatar) {
                            driverAvatar = `<img src="${pb.collection('drivers').getAvatar(driverRec.id, driverRec.avatar)}" class="bid-avatar" alt="${driverName}">`;
                        }
                    } catch (e) {
                        console.warn('Could not load driver info:', e);
                    }
                }
                
                // Format creation time
                const createdTime = bid.created_at ? new Date(bid.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';

                const bidItem = document.createElement('div');
                bidItem.className = 'bid-item';
                bidItem.innerHTML = `
                    <div class="bid-header">
                        ${driverAvatar}
                        <span class="bid-driver">${driverName}</span>
                    </div>
                    <div class="bid-details">
                        <div class="bid-price">$${bid.estimated_price || 0}</div>
                        <div class="bid-time">${bid.estimated_time || 0} min</div>
                        <div class="bid-date">${createdTime}</div>
                    </div>
                    <button class="bid-accept-btn" data-bid-id="${bid.id}">${this.t('transit.bid_accept_label')}</button>
                `;
                bidListEl.appendChild(bidItem);
            }

            // Add event listeners to accept buttons
            bidListEl.querySelectorAll('.bid-accept-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const bidId = e.target.dataset.bidId;
                    this.acceptBid(bidId);
                });
            });

        } catch (err) {
            console.warn('[ride] load bids:', err.message);
        }
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
            // The role overlay is toggled via inline style.display (not the
            // `hidden` class), so restore it explicitly to return the driver
            // to the Client/Driver selection screen.
            const roleOverlay = this.$('role-overlay');
            if (roleOverlay) roleOverlay.style.display = 'flex';
        });
        byId('driver-register-btn')('click', () => this.doRegister());

        byId('duty-toggle')('click', () => this.setDuty(!this.onDuty));
        byId('full-toggle')('click', () => this.setFull(!this.isFull));
        byId('route-save-btn')('click', () => this.saveRoute());

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
