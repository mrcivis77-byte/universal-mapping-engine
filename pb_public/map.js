/**
 * Universal Leaflet Map Interface
 * Handles map rendering, custom icons, and dynamic marker management
 * Supports multiple app types: transit, fishing, travel
 */

class UniversalMap {
    constructor(options = {}) {
        this.map = null;
        this.markers = {}; // Store markers by ID for easy updates
        this.markerLayer = null;
        this.userMarker = null;
        
        // Configuration
        this.config = {
            containerId: options.containerId || 'map',
            initialLat: options.initialLat || 20.9674,
            initialLng: options.initialLng || -89.5926,
            zoomLevel: options.zoomLevel || 14,
            maxBounds: options.maxBounds || null,
            tileProvider: options.tileProvider || 'cartodb_voyager',
            appType: options.appType || 'transit'
        };
        
        // Icon configurations for different app types (SVG assets)
        this.iconConfig = {
            transit: {
                mototaxi: {
                    emoji: '🛺',
                    color: '#10b981',
                    iconSize: [54, 54],
                    iconAnchor: [27, 27],
                    popupAnchor: [0, -27]
                },
                'mototaxi-full': {
                    emoji: '🛺',
                    color: '#ef4444',
                    iconSize: [54, 54],
                    iconAnchor: [27, 27],
                    popupAnchor: [0, -27]
                },
                bus: {
                    emoji: '🚐',
                    color: '#10b981',
                    iconSize: [51, 51],
                    iconAnchor: [25.5, 25.5],
                    popupAnchor: [0, -25]
                },
                'bus-full': {
                    emoji: '🚐',
                    color: '#ef4444',
                    iconSize: [51, 51],
                    iconAnchor: [25.5, 25.5],
                    popupAnchor: [0, -25]
                },
                drive: {
                    emoji: '🚗',
                    color: '#10b981',
                    iconSize: [51, 51],
                    iconAnchor: [25.5, 25.5],
                    popupAnchor: [0, -25]
                },
                'drive-full': {
                    emoji: '🚗',
                    color: '#ef4444',
                    iconSize: [51, 51],
                    iconAnchor: [25.5, 25.5],
                    popupAnchor: [0, -25]
                },
                customer: {
                    iconUrl: '/images/person.svg',
                    iconSize: [34, 34],
                    iconAnchor: [17, 30],
                    popupAnchor: [0, -30]
                },
                dest: {
                    iconUrl: '/images/marker-dest.svg',
                    iconSize: [36, 36],
                    iconAnchor: [18, 32],
                    popupAnchor: [0, -32]
                }
            },
            fishing: {
                panga: {
                    iconUrl: '/images/marker-fishing.png',
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                    popupAnchor: [0, -18]
                },
                boat: {
                    iconUrl: '/images/marker-fishing.png',
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    popupAnchor: [0, -22]
                },
                yacht: {
                    iconUrl: '/images/marker-fishing.png',
                    iconSize: [52, 52],
                    iconAnchor: [26, 26],
                    popupAnchor: [0, -26]
                }
            },
            travel: {
                gem: {
                    iconUrl: '/images/treasure-chest.svg',
                    iconSize: [40, 40],
                    iconAnchor: [20, 36],
                    popupAnchor: [0, -36]
                },
                attraction: {
                    iconUrl: '/images/marker-parque.png',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                },
                'attraction-olmec': {
                    iconUrl: '/images/attraction-olmec.svg',
                    iconSize: [48, 48],
                    iconAnchor: [24, 44],
                    popupAnchor: [0, -44]
                }
            },
            default: {
                iconUrl: '/images/default.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 30],
                popupAnchor: [0, -30]
            }
        };
    }

    /**
     * Initialize the map
     */
    init() {
        // Create map instance
        this.map = L.map(this.config.containerId, {
            center: [this.config.initialLat, this.config.initialLng],
            zoom: this.config.zoomLevel,
            zoomControl: false
        });

        // Add tile layer based on provider
        this.addTileLayer();

        // Set max bounds if specified
        if (this.config.maxBounds) {
            const bounds = this.parseBounds(this.config.maxBounds);
            this.map.setMaxBounds(bounds);
        }

        // Create marker layer group
        this.markerLayer = L.layerGroup().addTo(this.map);

        // Add user location marker
        this.addUserLocationMarker();

        return this.map;
    }

    /**
     * Add tile layer based on configured provider
     */
    addTileLayer() {
        let tileUrl;
        let attribution;

        switch (this.config.tileProvider) {
            case 'cartodb_voyager':
            case 'osm':
            case 'esri_street':
            default:
                tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
                attribution = 'Tiles &copy; Esri &mdash; Source: Esri, TomTom, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap';
                break;
            case 'satellite':
                tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
                attribution = 'Tiles &copy; Esri';
                break;
            case 'opentopomap':
                tileUrl = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';
                attribution = '&copy; <a href="https://www.opentopomap.org">OpenTopoMap</a> contributors';
        }

        L.tileLayer(tileUrl, {
            attribution: attribution,
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(this.map);
    }

    /**
     * Parse bounds string format
     */
    parseBounds(boundsString) {
        const [sw_lat, sw_lng, ne_lat, ne_lng] = boundsString.split(',').map(Number);
        return [[sw_lat, sw_lng], [ne_lat, ne_lng]];
    }

    /**
     * Add user location marker
     */
    addUserLocationMarker() {
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div class="user-pulse"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.userMarker = L.marker([0, 0], { icon: userIcon }).addTo(this.map);
        this.userMarker.setOpacity(0); // Hide until location is known
    }

    /**
     * Update user location on map
     */
    updateUserLocation(lat, lng) {
        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
            this.userMarker.setOpacity(1);

            // Only auto-center once, on the first location fix. After that the
            // map stays where the user leaves it so they can pan around (e.g.
            // to drop a destination pin). The center button re-centers on demand.
            if (!this.userLocationKnown) {
                this.userLocationKnown = true;
                this.map.panTo([lat, lng], {
                    animate: true,
                    duration: 1
                });
            }
        }
    }

    /**
     * Create custom icon based on app type and entity type
     */
    createIcon(appType, entityType) {
        let iconConfig = this.iconConfig[appType]?.[entityType];

        // Travel attractions: unknown specific type falls back to the generic
        // attraction marker, olmec heads get their own special icon.
        if (!iconConfig && appType === 'travel') {
            iconConfig = entityType === 'olmec'
                ? this.iconConfig.travel['attraction-olmec']
                : this.iconConfig.travel.attraction;
        }

        if (!iconConfig) {
            iconConfig = this.iconConfig.default;
        }

        // Transit vehicles use an emoji marker on a colored disc
        // (green = available, red = full). All other entities keep their
        // image-based L.icon.
        if (iconConfig.emoji) {
            return L.divIcon({
                className: 'transit-emoji-marker',
                html: `<span class="transit-emoji-disc" style="background:${iconConfig.color}">${iconConfig.emoji}</span>`,
                iconSize: iconConfig.iconSize,
                iconAnchor: iconConfig.iconAnchor,
                popupAnchor: iconConfig.popupAnchor
            });
        }

        return L.icon({
            iconUrl: iconConfig.iconUrl,
            iconSize: iconConfig.iconSize,
            iconAnchor: iconConfig.iconAnchor,
            popupAnchor: iconConfig.popupAnchor
        });
    }

    /**
     * Add or update a marker on the map
     */
    updateMarker(id, lat, lng, options = {}) {
        const { appType = this.config.appType, entityType = 'default', popupContent = null, animate = true, draggable = false } = options;

        // Create icon
        const icon = this.createIcon(appType, entityType);

        if (this.markers[id]) {
            // Update existing marker
            const marker = this.markers[id];
            marker.setIcon(icon);

            if (animate) {
                // Smooth animation to new position
                this.animateMarker(marker, lat, lng);
            } else {
                marker.setLatLng([lat, lng]);
            }

            // Update popup content if provided
            if (popupContent) {
                marker.setPopupContent(popupContent);
            }

            // Enable/disable drag on demand
            if (marker.dragging) {
                if (draggable) marker.dragging.enable();
                else marker.dragging.disable();
            }
        } else {
            // Create new marker
            const marker = L.marker([lat, lng], { icon, draggable });
            
            if (popupContent) {
                marker.bindPopup(popupContent);
            }

            marker.addTo(this.markerLayer);
            this.markers[id] = marker;
        }

        return this.markers[id];
    }

    /**
     * Get an existing marker by id (or null).
     */
    getMarker(id) {
        return this.markers[id] || null;
    }

    /**
     * Animate marker movement smoothly
     */
    animateMarker(marker, newLat, newLng) {
        const startLatLng = marker.getLatLng();
        const endLatLng = L.latLng(newLat, newLng);
        const duration = 1000; // 1 second animation
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentLat = startLatLng.lat + (endLatLng.lat - startLatLng.lat) * easedProgress;
            const currentLng = startLatLng.lng + (endLatLng.lng - startLatLng.lng) * easedProgress;
            
            marker.setLatLng([currentLat, currentLng]);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Remove a marker from the map
     */
    removeMarker(id) {
        if (this.markers[id]) {
            this.markerLayer.removeLayer(this.markers[id]);
            delete this.markers[id];
        }
    }

    /**
     * Clear all markers
     */
    clearMarkers() {
        this.markerLayer.clearLayers();
        this.markers = {};
    }

    /**
     * Add hidden gem marker with special styling
     */
    addHiddenGem(id, lat, lng, gemData) {
        const gemIcon = L.divIcon({
            className: 'hidden-gem-marker',
            html: `<div class="gem-icon ${gemData.rarity || 'common'}">💎</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        const popupContent = `
            <div class="gem-popup">
                <h3>${gemData.title}</h3>
                <p>${gemData.description}</p>
                ${gemData.image ? `<img src="${gemData.image}" alt="${gemData.title}" style="max-width: 100%">` : ''}
                <small>Added by ${gemData.author}</small>
            </div>
        `;

        const marker = L.marker([lat, lng], { icon: gemIcon })
            .bindPopup(popupContent)
            .addTo(this.markerLayer);

        this.markers[id] = marker;
        return marker;
    }

    /**
     * Add proximity alert icon (large animated icon)
     */
    addProximityAlert(id, lat, lng, attractionData) {
        const alertIcon = L.divIcon({
            className: 'proximity-alert-marker',
            html: `
                <div class="proximity-icon ${attractionData.type}">
                    <div class="icon-content">${attractionData.icon || '🏛️'}</div>
                    <div class="pulse-ring"></div>
                </div>
            `,
            iconSize: [80, 80],
            iconAnchor: [40, 80],
            popupAnchor: [0, -80]
        });

        const popupContent = `
            <div class="proximity-popup">
                <h3>${attractionData.name}</h3>
                <p>${attractionData.description}</p>
                <p class="distance">${attractionData.distance}m away</p>
            </div>
        `;

        const marker = L.marker([lat, lng], { icon: alertIcon })
            .bindPopup(popupContent)
            .addTo(this.markerLayer);

        this.markers[id] = marker;
        return marker;
    }

    /**
     * Set map view to specific location
     */
    setView(lat, lng, zoom = null) {
        this.map.setView([lat, lng], zoom || this.map.getZoom());
    }

    /**
     * Fit map to show all markers
     */
    fitToMarkers() {
        if (Object.keys(this.markers).length === 0) return;

        const bounds = L.latLngBounds(
            Object.values(this.markers).map(marker => marker.getLatLng())
        );
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    /**
     * Get map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Get marker by ID
     */
    getMarker(id) {
        return this.markers[id];
    }

    /**
     * Get all markers
     */
    getAllMarkers() {
        return this.markers;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalMap;
}
