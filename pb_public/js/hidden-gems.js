/**
 * Hidden Gem Crowd-Sourcing Feature
 * Allows users to add custom points of interest with descriptions and images
 * Saves to PocketBase and renders as treasure chest icons for all users
 */

class HiddenGemsManager {
    constructor(options = {}) {
        this.map = options.map || null;
        this.realtimeManager = options.realtimeManager || null;
        this.geolocationManager = options.geolocationManager || null;
        this.config = options.config || {};
        
        this.gems = [];
        this.gemMarkers = {};
        this.formVisible = false;
        this.selectedLocation = null;
        
        this.callbacks = {
            onGemAdded: [],
            onGemUpdated: [],
            onGemDeleted: [],
            onFormOpen: [],
            onFormClose: []
        };
    }

    /**
     * Initialize hidden gems manager
     */
    async init() {
        if (!this.map) {
            console.error('Map instance required for HiddenGemsManager');
            return false;
        }

        // Setup map context menu/long press
        this.setupMapInteraction();

        // Load existing gems from database
        await this.loadGems();

        // Replay any gems queued while offline + watch connectivity
        this.flushQueue();
        this.bindNetworkFlush();

        // Subscribe to real-time updates
        if (this.realtimeManager) {
            await this.subscribeToUpdates();
        }

        // Create gem form modal
        this.createGemForm();

        console.log('Hidden gems manager initialized');
        return true;
    }

    /**
     * Setup map interaction for adding gems
     */
    setupMapInteraction() {
        // The Add-Gem form intentionally opens ONLY from the + button in the
        // top-right corner (see #add-gem-btn wiring in index.html).
        // Right-click / long-press on the map no longer opens it.
    }

    /**
     * Load existing gems from database
     */
    async loadGems() {
        try {
            if (this.realtimeManager && this.realtimeManager.isConnected()) {
                    const townId = window.APP_CONFIG && window.APP_CONFIG.TOWN_ID;
                    const options = {};
                if (townId) options.filter = `town.town_id = "${townId}"`;

                const gems = await this.realtimeManager.getRecords('hidden_gems', options);
                
                if (gems && gems.length > 0) {
                    this.gems = gems;
                    this.renderAllGems();
                    console.log(`Loaded ${gems.length} hidden gems`);
                }
            }
        } catch (error) {
            console.error('Error loading hidden gems:', error);
        }
    }

    /**
     * Subscribe to real-time updates
     */
    async subscribeToUpdates() {
        try {
            await this.realtimeManager.subscribe('hidden_gems', (event) => {
                this.handleGemUpdate(event);
            });
        } catch (error) {
            console.error('Error subscribing to hidden gems updates:', error);
        }
    }

    /**
     * Handle real-time gem updates
     */
    handleGemUpdate(event) {
        const { action, record } = event;

        switch (action) {
            case 'create':
                this.gems.push(record);
                this.renderGem(record);
                this.notifyCallbacks('onGemAdded', record);
                break;
            case 'update':
                const index = this.gems.findIndex(g => g.id === record.id);
                if (index > -1) {
                    this.gems[index] = record;
                    this.updateGemMarker(record);
                    this.notifyCallbacks('onGemUpdated', record);
                }
                break;
            case 'delete':
                this.gems = this.gems.filter(g => g.id !== record.id);
                this.removeGemMarker(record.id);
                this.notifyCallbacks('onGemDeleted', record);
                break;
        }
    }

    /**
     * Render all gems on map
     */
    renderAllGems() {
        this.gems.forEach(gem => {
            this.renderGem(gem);
        });
    }

    /**
     * Render a single gem on map
     */
    renderGem(gem) {
        if (this.gemMarkers[gem.id]) {
            return; // Already rendered
        }

        const marker = this.map.addHiddenGem(
            gem.id,
            gem.latitude,
            gem.longitude,
            {
                title: gem.title,
                description: gem.description,
                image: gem.image ? this.gemImageUrl(gem) : null,
                rarity: gem.rarity || 'common',
                category: gem.category || '',
                author: gem.author || 'Anonymous'
            }
        );

        this.gemMarkers[gem.id] = marker;
    }

    /**
     * Build the public file URL for a gem image
     */
    gemImageUrl(gem) {
        if (!gem || !gem.image) return null;
        try {
            const baseUrl = (this.realtimeManager && this.realtimeManager.config && this.realtimeManager.config.pocketbaseUrl) || '';
            return `${baseUrl}/api/files/hidden_gems/${gem.id}/${gem.image}`;
        } catch (error) {
            console.error('Error building image URL:', error);
            return null;
        }
    }

    /**
     * Update existing gem marker
     */
    updateGemMarker(gem) {
        if (this.gemMarkers[gem.id]) {
            // Remove old marker
            this.map.removeMarker(gem.id);
            delete this.gemMarkers[gem.id];
            
            // Render updated gem
            this.renderGem(gem);
        }
    }

    /**
     * Remove gem marker from map
     */
    removeGemMarker(gemId) {
        if (this.gemMarkers[gemId]) {
            this.map.removeMarker(gemId);
            delete this.gemMarkers[gemId];
        }
    }

    /**
     * Create gem form modal
     */
    createGemForm() {
        // Remove existing form if present
        const existing = document.getElementById('gem-form-modal');
        if (existing) {
            existing.remove();
        }

        // Create form modal
        const modal = document.createElement('div');
        modal.id = 'gem-form-modal';
        modal.className = 'gem-form-modal hidden';
        modal.innerHTML = `
            <div class="gem-form-container">
                <div class="gem-form-header">
                    <h2 data-i18n="travel.add_gem">Add Hidden Gem</h2>
                    <button class="gem-form-close">&times;</button>
                </div>
                <form id="gem-form" class="gem-form">
                    <input type="hidden" id="gem-lat" name="latitude">
                    <input type="hidden" id="gem-lng" name="longitude">
                    
                    <div class="form-group">
                        <label for="gem-title" data-i18n="travel.hidden_gem_title">Title</label>
                        <input type="text" id="gem-title" name="title" required 
                               placeholder="e.g., Secret Garden Cafe">
                    </div>
                    
                    <div class="form-group">
                        <label for="gem-description" data-i18n="travel.hidden_gem_desc">Description</label>
                        <textarea id="gem-description" name="description" required
                                  placeholder="Describe this hidden gem..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label data-i18n="travel.category">Categoría</label>
                        <div id="gem-cat-chips" style="display:flex;flex-wrap:wrap;gap:6px">
                            <button type="button" data-cat="nature" style="padding:7px 12px;border:2px solid #22c55e;border-radius:999px;background:#f0fdf4;font-size:13px;font-weight:600">🌳 Nature</button>
                            <button type="button" data-cat="culture" style="padding:7px 12px;border:2px solid transparent;border-radius:999px;background:#fff;font-size:13px">🏛️ Culture</button>
                            <button type="button" data-cat="adventure" style="padding:7px 12px;border:2px solid transparent;border-radius:999px;background:#fff;font-size:13px">🧭 Adventure</button>
                            <button type="button" data-cat="relaxation" style="padding:7px 12px;border:2px solid transparent;border-radius:999px;background:#fff;font-size:13px">🏖️ Relax</button>
                            <button type="button" data-cat="food" style="padding:7px 12px;border:2px solid transparent;border-radius:999px;background:#fff;font-size:13px">🍽️ Food</button>
                        </div>
                        <input type="hidden" id="gem-category" name="category" value="nature">
                    </div>

                    <div class="form-group" style="display:none">
                        <label for="gem-rarity">Rarity</label>
                        <select id="gem-rarity" name="rarity">
                            <option value="common">Common 💎</option>
                            <option value="rare">Rare 💠</option>
                            <option value="legendary">Legendary 🔮</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="gem-image">Image (optional)</label>
                        <input type="file" id="gem-image" name="image" accept="image/*">
                        <div class="image-preview" id="image-preview"></div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-cancel" data-i18n="common.cancel">Cancel</button>
                        <button type="submit" class="btn-submit" data-i18n="travel.submit_gem">Submit Gem</button>
                    </div>
                </form>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);

        // Setup event listeners
        this.setupFormListeners(modal);
    }

    /**
     * Setup form event listeners
     */
    setupFormListeners(modal) {
        const form = modal.querySelector('#gem-form');
        const closeBtn = modal.querySelector('.gem-form-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const imageInput = modal.querySelector('#gem-image');
        const imagePreview = modal.querySelector('#image-preview');

        // Close button
        closeBtn.addEventListener('click', () => this.closeGemForm());
        cancelBtn.addEventListener('click', () => this.closeGemForm());

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeGemForm();
            }
        });

        // Image preview
        // Category chip selection
        const catInput = modal.querySelector('#gem-category');
        if (catInput) {
            modal.querySelectorAll('#gem-cat-chips button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    modal.querySelectorAll('#gem-cat-chips button').forEach((b) => {
                        b.style.border = '2px solid transparent'; b.style.background = '#fff';
                    });
                    btn.style.border = '2px solid #22c55e'; btn.style.background = '#f0fdf4';
                    catInput.value = btn.getAttribute('data-cat');
                });
            });
        }

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 8px;">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitGemForm(form);
        });
    }

    /**
     * Open gem form at specific location
     */
    openGemForm(latlng) {
        const modal = document.getElementById('gem-form-modal');
        if (!modal) return;
        if (latlng && latlng.lat) { this.doOpenGemForm(latlng); return; }

        // Location chooser: current GPS position OR tap a spot on the map.
        let ov = document.getElementById('gem-loc-chooser');
        if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'gem-loc-chooser';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center';
        ov.innerHTML =
            '<div style="background:#fff;border-radius:16px 16px 0 0;padding:18px;max-width:430px;width:100%">' +
            '<h3 style="margin:0 0 12px;font-size:17px;color:#0f172a">' + (window.i18n ? window.i18n.t('travel.choose_loc_title') : '¿Dónde agregar este lugar?') + '</h3>' +
            '<button class="gc-gps" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:8px;font-size:14px;font-weight:600"><span style="font-size:20px">📍</span><span>' + (window.i18n ? window.i18n.t('travel.use_gps') : 'Mi ubicación actual') + '</span></button>' +
            '<button class="gc-map" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin-bottom:8px;font-size:14px;font-weight:600"><span style="font-size:20px">🗺️</span><span>' + (window.i18n ? window.i18n.t('travel.pick_map') : 'Elegir en el mapa (sin estar ahí)') + '</span></button>' +
            '<button class="gc-x" style="width:100%;padding:12px;border:none;border-radius:12px;background:#f1f5f9;color:#334155;font-weight:700;font-size:14px">' + (window.i18n ? window.i18n.t('transit.loc_close') || 'Cerrar' : 'Cerrar') + '</button></div>';
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        ov.querySelector('.gc-x').onclick = close;
        const map = this.map && this.map.getMap ? this.map.getMap() : null;
        ov.querySelector('.gc-gps').onclick = () => {
            close();
            const done = (p) => this.doOpenGemForm({ lat: p.coords.latitude, lng: p.coords.longitude });
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(done, () => {
                    // No GPS fix: fall back to map center so the user can still add
                    if (map) this.doOpenGemForm(map.getCenter()); else this.notifyNoLocation();
                }, { enableHighAccuracy: true, timeout: 12000 });
            } else if (map) { this.doOpenGemForm(map.getCenter()); }
        };
        ov.querySelector('.gc-map').onclick = () => {
            close();
            if (!map) { this.notifyNoLocation(); return; }
            let hint = document.createElement('div');
            hint.style.cssText = 'position:fixed;top:calc(108px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:10050;background:#0f172a;color:#fff;border-radius:10px;padding:8px 14px;font-size:13px';
            hint.textContent = window.i18n ? window.i18n.t('travel.tap_map_hint') : 'Toca el mapa donde va el lugar';
            document.body.appendChild(hint);
            map.once('click', (e) => {
                hint.remove();
                this.doOpenGemForm(e.latlng);
            });
        };
    }

    notifyNoLocation() {
        this.showNotification(window.i18n ? window.i18n.t('travel.no_loc') : 'No se pudo obtener tu ubicación', 'error');
    }

    doOpenGemForm(latlng) {
        const modal = document.getElementById('gem-form-modal');
        if (!modal) return;

        // Set location coordinates
        document.getElementById('gem-lat').value = latlng.lat;
        document.getElementById('gem-lng').value = latlng.lng;
        this.selectedLocation = latlng;

        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('visible');
        this.formVisible = true;

        this.notifyCallbacks('onFormOpen', latlng);
    }

    /**
     * Close gem form
     */
    closeGemForm() {
        const modal = document.getElementById('gem-form-modal');
        if (!modal) return;

        modal.classList.remove('visible');
        modal.classList.add('hidden');
        this.formVisible = false;

        // Reset form
        const form = document.getElementById('gem-form');
        form.reset();
        document.getElementById('image-preview').innerHTML = '';
        this.selectedLocation = null;

        this.notifyCallbacks('onFormClose');
    }

    /**
     * Submit gem form
     */
    async submitGemForm(form) {
        try {
            const formData = new FormData(form);

            // Build the record as a FormData object so PocketBase receives
            // the file upload natively (no separate /api/upload endpoint).
            const record = new FormData();
            record.append('title', formData.get('title'));
            record.append('description', formData.get('description'));
            record.append('rarity', formData.get('rarity'));
            record.append('category', formData.get('category') || 'nature');
            record.append('latitude', parseFloat(formData.get('latitude')));
            record.append('longitude', parseFloat(formData.get('longitude')));

            let imageFile = formData.get('image');
            let imageDataUrl = null;
            if (imageFile && imageFile.size > 0) {
                imageFile = await this.cartoonify(imageFile);
                record.append('image', imageFile, 'photo.jpg');
                // Keep a data URL copy in case we need to queue this offline
                try {
                    imageDataUrl = await new Promise((res) => {
                        const fr = new FileReader();
                        fr.onload = () => res(fr.result); fr.onerror = () => res(null);
                        fr.readAsDataURL(imageFile);
                    });
                } catch (e) {}
            }

            // Save to PocketBase
            const town = await this.resolveTownRecordId();
            if (town) record.append('town', town);

            const connected = (this.realtimeManager && this.realtimeManager.isConnected() && navigator.onLine);
            if (!connected) {
                this.queueGem({
                    title: record.get('title'),
                    description: record.get('description'),
                    rarity: record.get('rarity') || 'common',
                    category: record.get('category') || '',
                    latitude: record.get('latitude'),
                    longitude: record.get('longitude'),
                    imageDataUrl
                });
                this.closeGemForm();
                this.showNotification(window.i18n ? window.i18n.t('travel.gem_queued') : 'Sin conexión: se enviará automáticamente al volver', 'success');
                return;
            }
            const savedGem = await this.realtimeManager.createRecord('hidden_gems', record);

                console.log('Hidden gem saved successfully:', savedGem);

                // Render immediately - do not wait for the realtime event,
                // which may never arrive if the subscription dropped.
                if (!this.gems.some(g => g.id === savedGem.id)) {
                    this.gems.push(savedGem);
                }
                this.renderGem(savedGem);

                this.closeGemForm();

                // Show success notification
                this.showNotification(window.i18n ? window.i18n.t('travel.gem_added') : 'Hidden gem added successfully!', 'success');
        } catch (error) {
            console.error('Error submitting gem form:', error);
            this.showNotification(
                window.i18n ? window.i18n.t('travel.gem_error') : 'Failed to add hidden gem. Please try again.',
                'error'
            );
        }
    }


    /**
     * Resolve the PB relation id for our town (TOWN_ID is a slug like
     * "chelem_chuburna_progreso", but creates need the record id).
     */
    async resolveTownRecordId() {
        if (this._townRecordId) return this._townRecordId;
        try {
            const base = this.realtimeManager && this.realtimeManager.config && this.realtimeManager.config.pocketbaseUrl || '';
            const slug = window.APP_CONFIG && window.APP_CONFIG.TOWN_ID;
            let url = base + '/api/collections/towns/records?perPage=1';
            if (slug) url += '&filter=' + encodeURIComponent('town_id = "' + slug + '"');
            const r = await fetch(url);
            const j = await r.json();
            const t = (j.items || [])[0];
            this._townRecordId = t ? t.id : null;
        } catch (e) { this._townRecordId = null; }
        return this._townRecordId;
    }

    /**
     * Cartoonify an image file: saturate + posterize + soft dark edges
     * so real photos read like a theme-park map illustration.
     */
    async cartoonify(file) {
        const loadImg = (src) => new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i); i.onerror = rej; i.src = src;
        });
        try {
            const url = URL.createObjectURL(file);
            const img = await loadImg(url);
            const scale = Math.min(1, 900 / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            const x = c.getContext('2d');
            x.filter = 'saturate(1.75) contrast(1.12)';
            x.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);

            // Posterize to flatten colors into a painted look
            const d = x.getImageData(0, 0, c.width, c.height);
            const p = d.data;
            const LV = 7;
            for (let i = 0; i < p.length; i += 4) {
                p[i]     = Math.round(p[i]     / 255 * (LV - 1)) / (LV - 1) * 255;
                p[i + 1] = Math.round(p[i + 1] / 255 * (LV - 1)) / (LV - 1) * 255;
                p[i + 2] = Math.round(p[i + 2] / 255 * (LV - 1)) / (LV - 1) * 255;
            }
            x.putImageData(d, 0, 0);

            // Soft ink edges
            const e = document.createElement('canvas');
            e.width = c.width; e.height = c.height;
            const ex = e.getContext('2d');
            ex.filter = 'grayscale(1) blur(1px) invert(1) contrast(2.6)';
            ex.drawImage(c, 0, 0);
            x.globalCompositeOperation = 'multiply';
            x.globalAlpha = 0.32;
            x.drawImage(e, 0, 0);
            x.globalCompositeOperation = 'source-over';
            x.globalAlpha = 1;

            return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
        } catch (err) {
            console.error('cartoonify failed, keeping original:', err);
            return file;
        }
    }

    /**
     * Offline queue for gems (image stored as data URL until we reconnect).
     */
    queueGem(payload) {
        let q = [];
        try { q = JSON.parse(localStorage.getItem('travel-gem-queue') || '[]'); } catch (e) {}
        q.push(payload);
        try { localStorage.setItem('travel-gem-queue', JSON.stringify(q)); } catch (e) {}
        this.showNetBadge();
    }

    showNetBadge() {
        let q = [];
        try { q = JSON.parse(localStorage.getItem('travel-gem-queue') || '[]'); } catch (e) {}
        let b = document.getElementById('travel-net-badge');
        if (!b) {
            b = document.createElement('div');
            b.id = 'travel-net-badge';
            b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:5200;background:#0f172a;color:#fff;border-radius:10px;padding:7px 12px;font-size:12px;display:none';
            document.body.appendChild(b);
        }
        const n = q.length;
        if (!navigator.onLine && n > 0) { b.textContent = 'Sin conexión · se enviará al volver'; b.style.display = 'block'; }
        else if (!navigator.onLine) { b.textContent = 'Sin conexión'; b.style.display = 'block'; }
        else if (n > 0) { b.textContent = n + ' pendiente(s) de sincronizar'; b.style.display = 'block'; setTimeout(() => this.flushQueue(), 1500); }
        else b.style.display = 'none';
    }

    dataUrlToBlob(u) {
        const [meta, b64] = u.split(',');
        const mime = (meta.match(/data:([^;]+)/) || [, 'image/jpeg'])[1];
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    async flushQueue() {
        if (!navigator.onLine) return;
        let q = [];
        try { q = JSON.parse(localStorage.getItem('travel-gem-queue') || '[]'); } catch (e) {}
        if (!q.length) { this.showNetBadge(); return; }
        const item = q[0];
        try {
            const fd = new FormData();
            fd.append('title', item.title);
            fd.append('description', item.description);
            fd.append('rarity', item.rarity || 'common');
            fd.append('category', item.category || '');
            fd.append('latitude', String(item.latitude));
            fd.append('longitude', String(item.longitude));
            const town = await this.resolveTownRecordId();
            if (town) fd.append('town', town);
            if (item.imageDataUrl) {
                const blob = this.dataUrlToBlob(item.imageDataUrl);
                fd.append('image', blob, 'photo.jpg');
            }
            const base = this.realtimeManager && this.realtimeManager.config && this.realtimeManager.config.pocketbaseUrl || '';
            const r = await fetch(base + '/api/collections/hidden_gems/records', { method: 'POST', body: fd });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const rec = await r.json();
            if (!this.gems.some(g => g.id === rec.id)) { this.gems.push(rec); }
            this.renderGem(rec);
            q.shift();
            try { localStorage.setItem('travel-gem-queue', JSON.stringify(q)); } catch (e) {}
            this.flushQueue();
        } catch (err) { this.showNetBadge(); }
    }

    bindNetworkFlush() {
        window.addEventListener('online', () => this.flushQueue());
        setInterval(() => this.flushQueue(), 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.flushQueue(); });
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            animation: slide-in 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slide-out 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Get all gems
     */
    getGems() {
        return this.gems;
    }

    /**
     * Get gem by ID
     */
    getGem(gemId) {
        return this.gems.find(g => g.id === gemId);
    }

    /**
     * Delete gem
     */
    async deleteGem(gemId) {
        try {
            if (this.realtimeManager && this.realtimeManager.isConnected()) {
                await this.realtimeManager.deleteRecord('hidden_gems', gemId);
                console.log('Hidden gem deleted successfully');
            }
        } catch (error) {
            console.error('Error deleting gem:', error);
            this.showNotification('Failed to delete hidden gem', 'error');
        }
    }

    /**
     * Register callback for gem added
     */
    onGemAdded(callback) {
        this.callbacks.onGemAdded.push(callback);
    }

    /**
     * Register callback for gem updated
     */
    onGemUpdated(callback) {
        this.callbacks.onGemUpdated.push(callback);
    }

    /**
     * Register callback for gem deleted
     */
    onGemDeleted(callback) {
        this.callbacks.onGemDeleted.push(callback);
    }

    /**
     * Register callback for form open
     */
    onFormOpen(callback) {
        this.callbacks.onFormOpen.push(callback);
    }

    /**
     * Register callback for form close
     */
    onFormClose(callback) {
        this.callbacks.onFormClose.push(callback);
    }

    /**
     * Notify all registered callbacks
     */
    notifyCallbacks(eventType, data) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventType} callback:`, error);
                }
            });
        }
    }

    /**
     * Destroy hidden gems manager
     */
    destroy() {
        // Remove all gem markers
        Object.keys(this.gemMarkers).forEach(gemId => {
            this.removeGemMarker(gemId);
        });

        // Remove form modal
        const modal = document.getElementById('gem-form-modal');
        if (modal) {
            modal.remove();
        }

        // Clear data
        this.gems = [];
        this.gemMarkers = {};
        this.callbacks = {
            onGemAdded: [],
            onGemUpdated: [],
            onGemDeleted: [],
            onFormOpen: [],
            onFormClose: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HiddenGemsManager;
}
