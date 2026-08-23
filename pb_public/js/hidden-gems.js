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
                const townId = window.APP_CONFIG?.TOWN_ID;
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
            const townId = window.APP_CONFIG?.TOWN_ID;

            // Build the record as a FormData object so PocketBase receives
            // the file upload natively (no separate /api/upload endpoint).
            const record = new FormData();
            record.append('title', formData.get('title'));
            record.append('description', formData.get('description'));
            record.append('rarity', formData.get('rarity'));
            record.append('latitude', parseFloat(formData.get('latitude')));
            record.append('longitude', parseFloat(formData.get('longitude')));

            if (townId) record.append('town', townId);

            const imageFile = formData.get('image');
            if (imageFile && imageFile.size > 0) {
                record.append('image', imageFile);
            }

            // Save to PocketBase
            if (this.realtimeManager && this.realtimeManager.isConnected()) {
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
            } else {
                throw new Error('Not connected to database');
            }

        } catch (error) {
            console.error('Error submitting gem form:', error);
            this.showNotification(
                window.i18n ? window.i18n.t('travel.gem_error') : 'Failed to add hidden gem. Please try again.',
                'error'
            );
        }
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
