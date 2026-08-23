/**
 * Theme Park Travel Map Module
 * Illustrated map styles with proximity detection for cultural attractions
 * Handles proximity alerts and animated attraction icons
 */

class TravelMapModule {
    constructor(options = {}) {
        this.map = options.map || null;
        this.geolocationManager = options.geolocationManager || null;
        this.config = options.config || {};
        
        this.attractions = [];
        this.proximityRadius = this.config.TRAVEL_PROXIMITY_RADIUS || 5000; // 5km default
        this.proximityCheckInterval = 10000; // 10 seconds
        this.proximityCheckTimer = null;
        this.triggeredAttractions = new Set();
        
        this.callbacks = {
            onProximityAlert: [],
            onAttractionEnter: [],
            onAttractionExit: []
        };
        
        // Cultural attraction data with icons
        this.culturalAttractions = [
            {
                id: 'olmec_head_1',
                name: 'Olmec Head Monument',
                type: 'olmec',
                icon: '🗿',
                latitude: 20.9794,
                longitude: -89.5926,
                description: 'Ancient Olmec colossal head sculpture',
                proximityRadius: 5000
            },
            {
                id: 'mayan_pyramid_1',
                name: 'Mayan Pyramid Ruins',
                type: 'pyramid',
                icon: '🏛️',
                latitude: 20.6843,
                longitude: -88.5678,
                description: 'Ancient Mayan temple complex',
                proximityRadius: 5000
            },
            {
                id: 'cenote_1',
                name: 'Sacred Cenote',
                type: 'cenote',
                icon: '💧',
                latitude: 20.9680,
                longitude: -89.5800,
                description: 'Natural freshwater sinkhole',
                proximityRadius: 3000
            },
            {
                id: 'colonial_church',
                name: 'Colonial Cathedral',
                type: 'church',
                icon: '⛪',
                latitude: 20.9674,
                longitude: -89.5926,
                description: '16th century Spanish colonial cathedral',
                proximityRadius: 2000
            }
        ];
    }

    /**
     * Initialize travel map module
     */
    async init() {
        if (!this.map) {
            console.error('Map instance required for TravelMapModule');
            return false;
        }

        // Apply theme park map style if enabled
        if (this.config.TRAVEL_THEME_PARK_MODE) {
            this.applyThemeParkStyle();
        }

        // Load cultural attractions
        await this.loadAttractions();

        // Start proximity checking
        this.startProximityMonitoring();

        // Add attraction markers to map
        this.addAttractionMarkers();

        console.log('Travel map module initialized');
        return true;
    }

    /**
     * Apply illustrated theme park map style
     */
    applyThemeParkStyle() {
        // Custom tile layer with illustrated style
        const themeParkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: 'abcd'
        });

        // Remove existing tile layers and add theme park style
        const map = this.map.getMap();
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        themeParkTiles.addTo(map);

        // Apply the illustrated filter to the whole map container
        map.getContainer().classList.add('theme-park-mode');
    }

    /**
     * Load cultural attractions from database or config
     */
    async loadAttractions() {
        // Try to load from PocketBase first (scoped to this town)
        try {
            const townId = window.APP_CONFIG?.TOWN_ID;
            const options = townId
                ? { filter: `town.town_id = "${townId}"` }
                : {};

            if (window.realtimeManager && window.realtimeManager.isConnected()) {
                const attractions = await window.realtimeManager.getRecords('attractions', options);
                if (attractions && attractions.length > 0) {
                    this.attractions = attractions;
                    console.log(`Loaded ${attractions.length} attractions from database`);
                    return;
                }
            }
        } catch (error) {
            console.log('Could not load attractions from database, using defaults');
        }

        // Use default cultural attractions
        this.attractions = this.culturalAttractions;
    }

    /**
     * Add attraction markers to map
     */
    addAttractionMarkers() {
        this.attractions.forEach(attraction => {
            const marker = this.map.updateMarker(
                attraction.id,
                attraction.latitude,
                attraction.longitude,
                {
                    appType: 'travel',
                    entityType: attraction.type,
                    ...(attraction.icon ? { customIconUrl: `/api/files/attractions/${attraction.id}/${attraction.icon}` } : {}),
                    popupContent: `
                        <div class="proximity-popup">
                            <h3>${attraction.name}</h3>
                            <p>${attraction.description || ''}</p>
                            <p class="distance">${Math.round(attraction.distance || 0)}m away</p>
                        </div>
                    `
                }
            );

            // Store reference for distance updates
            attraction.marker = marker;
        });
    }

    /**
     * Start proximity monitoring
     */
    startProximityMonitoring() {
        // Clear existing timer
        if (this.proximityCheckTimer) {
            clearInterval(this.proximityCheckTimer);
        }

        // Start periodic checks
        this.proximityCheckTimer = setInterval(() => {
            this.checkProximity();
        }, this.proximityCheckInterval);

        // Also check on location updates
        if (this.geolocationManager) {
            this.geolocationManager.onPositionUpdate((position) => {
                this.checkProximity(position);
            });
        }
    }

    /**
     * Stop proximity monitoring
     */
    stopProximityMonitoring() {
        if (this.proximityCheckTimer) {
            clearInterval(this.proximityCheckTimer);
            this.proximityCheckTimer = null;
        }
    }

    /**
     * Check proximity to all attractions
     */
    checkProximity(position = null) {
        // Get current position
        let currentPosition;
        if (position) {
            currentPosition = position;
        } else if (this.geolocationManager) {
            currentPosition = this.geolocationManager.getPosition();
        }

        if (!currentPosition) {
            return;
        }

        const { latitude, longitude } = currentPosition;

        // Check each attraction
        this.attractions.forEach(attraction => {
            const userLatLng = L.latLng(latitude, longitude);
            const attractionLatLng = L.latLng(attraction.latitude, attraction.longitude);
            const distance = userLatLng.distanceTo(attractionLatLng);

            // Update marker popup with distance
            if (attraction.marker) {
                const popupContent = attraction.marker.getPopup();
                if (popupContent) {
                    const content = popupContent.getContent();
                    const updatedContent = content.replace(
                        /<p class="distance">.*?<\/p>/,
                        `<p class="distance">${Math.round(distance)}m away</p>`
                    );
                    popupContent.setContent(updatedContent);
                }
            }

            // Check if within proximity radius
            const radius = attraction.proximityRadius || this.proximityRadius;
            const attractionKey = attraction.id;

            if (distance <= radius && !this.triggeredAttractions.has(attractionKey)) {
                // User entered attraction proximity
                this.triggerProximityAlert(attraction, distance);
                this.triggeredAttractions.add(attractionKey);
                this.notifyCallbacks('onAttractionEnter', { attraction, distance });
            } else if (distance > radius && this.triggeredAttractions.has(attractionKey)) {
                // User exited attraction proximity
                this.triggeredAttractions.delete(attractionKey);
                this.notifyCallbacks('onAttractionExit', { attraction, distance });
            }
        });
    }

    /**
     * Trigger proximity alert for attraction
     */
    triggerProximityAlert(attraction, distance) {
        console.log(`Proximity alert: ${attraction.name} (${Math.round(distance)}m away)`);

        // Show animated icon on map
        this.showAnimatedAttractionIcon(attraction);

        // Notify callbacks
        this.notifyCallbacks('onProximityAlert', {
            attraction: attraction,
            distance: distance
        });

        // Show notification to user
        this.showProximityNotification(attraction, distance);
    }

    /**
     * Show animated attraction icon on map
     */
    showAnimatedAttractionIcon(attraction) {
        // Create or update the proximity alert marker
        const alertData = {
            name: attraction.name,
            description: attraction.description,
            type: attraction.type,
            icon: attraction.icon,
            distance: Math.round(this.calculateDistance(
                this.geolocationManager.getPosition().latitude,
                this.geolocationManager.getPosition().longitude,
                attraction.latitude,
                attraction.longitude
            ))
        };

        // Add large animated icon
        this.map.addProximityAlert(
            `alert_${attraction.id}`,
            attraction.latitude,
            attraction.longitude,
            alertData
        );

        // NOTE: intentionally does NOT pan the map here - the user may be
        // panning around exploring; yanking the view made exploration
        // impossible. The animated icon + notification are enough.
    }

    /**
     * Show proximity notification to user
     */
    showProximityNotification(attraction, distance) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'proximity-notification';
        notification.innerHTML = `
            <div class="proximity-content">
                <div class="proximity-icon">${attraction.icon}</div>
                <div class="proximity-text">
                    <h3>${attraction.name}</h3>
                    <p>${attraction.description}</p>
                    <p class="distance">${Math.round(distance)}m away</p>
                </div>
                <button class="proximity-close">&times;</button>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 16px;
            animation: slide-up 0.5s ease;
            max-width: 90%;
            width: 350px;
        `;

        // Add to document
        document.body.appendChild(notification);

        // Setup close button
        const closeBtn = notification.querySelector('.proximity-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slide-down 0.5s ease forwards';
            setTimeout(() => notification.remove(), 500);
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slide-down 0.5s ease forwards';
                setTimeout(() => notification.remove(), 500);
            }
        }, 10000);
    }

    /**
     * Calculate distance between two coordinates
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    /**
     * Add custom attraction
     */
    addCustomAttraction(attractionData) {
        const newAttraction = {
            id: `custom_${Date.now()}`,
            name: attractionData.name,
            type: attractionData.type || 'custom',
            icon: attractionData.icon || '📍',
            latitude: attractionData.latitude,
            longitude: attractionData.longitude,
            description: attractionData.description,
            proximityRadius: attractionData.proximityRadius || this.proximityRadius
        };

        this.attractions.push(newAttraction);
        this.addAttractionMarkers();

        return newAttraction;
    }

    /**
     * Remove attraction
     */
    removeAttraction(attractionId) {
        const index = this.attractions.findIndex(a => a.id === attractionId);
        if (index > -1) {
            const attraction = this.attractions[index];
            
            // Remove marker from map
            if (attraction.marker) {
                this.map.removeMarker(attraction.id);
            }

            // Remove from array
            this.attractions.splice(index, 1);
            this.triggeredAttractions.delete(attractionId);
        }
    }

    /**
     * Get all attractions
     */
    getAttractions() {
        return this.attractions;
    }

    /**
     * Get attraction by ID
     */
    getAttraction(attractionId) {
        return this.attractions.find(a => a.id === attractionId);
    }

    /**
     * Set proximity radius
     */
    setProximityRadius(radius) {
        this.proximityRadius = radius;
    }

    /**
     * Register callback for proximity alerts
     */
    onProximityAlert(callback) {
        this.callbacks.onProximityAlert.push(callback);
    }

    /**
     * Register callback for attraction enter
     */
    onAttractionEnter(callback) {
        this.callbacks.onAttractionEnter.push(callback);
    }

    /**
     * Register callback for attraction exit
     */
    onAttractionExit(callback) {
        this.callbacks.onAttractionExit.push(callback);
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
     * Destroy travel map module
     */
    destroy() {
        this.stopProximityMonitoring();
        this.triggeredAttractions.clear();
        this.callbacks = {
            onProximityAlert: [],
            onAttractionEnter: [],
            onAttractionExit: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TravelMapModule;
}
