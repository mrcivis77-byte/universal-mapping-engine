/**
 * Cross-Country Hand-Off Manager
 * Automatically switches between town servers when user exits local boundaries
 * Handles seamless transitions between network zones
 */

class HandoffManager {
    constructor(options = {}) {
        this.currentTown = null;
        this.currentTownUrl = null;
        this.previousTown = null;
        this.centralRegistryUrl = (options.centralRegistryUrl || 'https://yucatanmx.com').replace(/\/+$/, '');
        this.handoffInProgress = false;
        this.geolocationManager = options.geolocationManager || null;
        this.realtimeManager = options.realtimeManager || null;
        this.mapManager = options.mapManager || null;
        this.welcomeBanner = options.welcomeBanner || null;
        this.config = options.config || {};
        
        this.callbacks = {
            onHandoffStart: [],
            onHandoffComplete: [],
            onHandoffFailed: [],
            onTownChanged: []
        };
    }

    /**
     * Initialize hand-off manager
     */
    async init() {
        // Load current town configuration
        this.currentTown = {
            id: this.config.TOWN_ID || 'unknown',
            name: this.config.TOWN_NAME || 'Unknown Town',
            latitude: parseFloat(this.config.INITIAL_LATITUDE) || 0,
            longitude: parseFloat(this.config.INITIAL_LONGITUDE) || 0,
            bounds: this.parseBounds(this.config.MAX_BOUNDS),
            welcomeMessage: this.config.WELCOME_MESSAGE || '',
            url: window.location.origin
        };
        
        this.currentTownUrl = window.location.origin;
        
        console.log(`Hand-off manager initialized for ${this.currentTown.name}`);
        
        // Start boundary checking
        this.startBoundaryCheck();
    }

    /**
     * Parse bounds string format
     */
    parseBounds(boundsString) {
        if (!boundsString) return null;
        
        try {
            const [sw_lat, sw_lng, ne_lat, ne_lng] = boundsString.split(',').map(Number);
            return {
                sw_lat, sw_lng, ne_lat, ne_lng,
                southwest: [sw_lat, sw_lng],
                northeast: [ne_lat, ne_lng]
            };
        } catch (error) {
            console.error('Error parsing bounds:', error);
            return null;
        }
    }

    /**
     * Start periodic boundary checking
     */
    startBoundaryCheck() {
        // Check every 30 seconds
        this.boundaryCheckInterval = setInterval(() => {
            this.checkBoundary();
        }, 30000);
        
        // Also check on significant location updates
        if (this.geolocationManager) {
            this.geolocationManager.onPositionUpdate((position) => {
                this.checkBoundary(position);
            });
        }
    }

    /**
     * Stop boundary checking
     */
    stopBoundaryCheck() {
        if (this.boundaryCheckInterval) {
            clearInterval(this.boundaryCheckInterval);
            this.boundaryCheckInterval = null;
        }
    }

    /**
     * Check if user is outside current town boundaries
     */
    async checkBoundary(position = null) {
        if (this.handoffInProgress) return;
        
        // Get current position
        let currentPosition;
        if (position) {
            currentPosition = position;
        } else if (this.geolocationManager) {
            currentPosition = this.geolocationManager.getPosition();
        }
        
        if (!currentPosition) {
            console.log('No position available for boundary check');
            return;
        }
        
        const { latitude, longitude } = currentPosition;
        
        // Check if outside current bounds
        if (this.isOutsideBounds(latitude, longitude, this.currentTown.bounds)) {
            console.log('User outside current town boundaries, initiating hand-off');
            await this.initiateHandOff(latitude, longitude);
        }
    }

    /**
     * Check if coordinates are outside bounds
     */
    isOutsideBounds(lat, lng, bounds) {
        if (!bounds) return false;
        
        return lat < bounds.sw_lat || lat > bounds.ne_lat ||
               lng < bounds.sw_lng || lng > bounds.ne_lng;
    }

    /**
     * Initiate hand-off to nearest town
     */
    async initiateHandOff(latitude, longitude) {
        if (this.handoffInProgress) return;
        
        this.handoffInProgress = true;
        this.notifyCallbacks('onHandoffStart', { latitude, longitude });
        
        try {
            // Find nearest town from central registry
            const nearestTown = await this.findNearestTown(latitude, longitude);
            
            if (nearestTown && nearestTown.tunnel_url) {
                console.log(`Handing off to ${nearestTown.town_name} at ${nearestTown.tunnel_url}`);
                
                // Perform hand-off
                await this.performHandOff(nearestTown);
            } else {
                console.log('No nearby town found for hand-off');
                this.notifyCallbacks('onHandoffFailed', { reason: 'no_nearby_town' });
            }
        } catch (error) {
            console.error('Hand-off failed:', error);
            this.notifyCallbacks('onHandoffFailed', { error });
        } finally {
            this.handoffInProgress = false;
        }
    }

    /**
     * Find nearest town from central registry
     */
    async findNearestTown(latitude, longitude) {
        try {
            const response = await fetch(`${this.centralRegistryUrl}/api/nearest-town`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude: latitude,
                    longitude: longitude,
                    current_town: this.currentTown.id
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to find nearest town');
            }
            
            const data = await response.json();
            return data.town;
        } catch (error) {
            console.error('Error finding nearest town:', error);
            
            // Fallback: return null to trigger failed hand-off
            return null;
        }
    }

    /**
     * Perform hand-off to new town - no page reload.
     * Switches the realtime connection, pans the map, shows the welcome
     * banner and updates the browser URL. Falls back to a hard navigation
     * if the target town's API is not reachable cross-origin.
     */
    async performHandOff(newTown) {
        try {
            const targetUrl = (newTown.tunnel_url || '').replace(/\/+$/, '');
            if (!targetUrl) {
                throw new Error('Target town has no tunnel_url');
            }

            // Store previous town info
            this.previousTown = { ...this.currentTown };

            // 1. Switch the live realtime connection (no reload).
            // Cross-origin calls work because PocketBase answers with
            // permissive CORS headers; if not, fall back to navigation.
            if (this.realtimeManager) {
                try {
                    await this.realtimeManager.updateBaseUrl(targetUrl);
                } catch (error) {
                    console.error('Live hand-off failed, navigating instead:', error);
                    window.location.href = targetUrl;
                    return;
                }
            }

            // 2. Update town state
            this.currentTown = {
                id: newTown.town_id,
                name: newTown.town_name,
                latitude: newTown.latitude,
                longitude: newTown.longitude,
                bounds: this.parseBounds(newTown.max_bounds),
                welcomeMessage: newTown.welcome_message,
                url: targetUrl
            };
            
            this.currentTownUrl = targetUrl;

            // 3. Reposition the map to the new town
            if (this.mapManager && this.mapManager.getMap()) {
                const map = this.mapManager.getMap();
                map.clearMarkers();

                if (newTown.max_bounds) {
                    const bounds = this.parseBounds(newTown.max_bounds);
                    if (bounds) map.setMaxBounds([[bounds.sw_lat, bounds.sw_lng], [bounds.ne_lat, bounds.ne_lng]]);
                }

                if (newTown.latitude && newTown.longitude) {
                    map.setView([newTown.latitude, newTown.longitude], 14, { animate: true });
                }
            }

            // 4. Show the new town's welcome banner
            if (this.welcomeBanner) {
                await this.welcomeBanner.showForTown(this.currentTown.id, {
                    id: this.currentTown.id,
                    name: this.currentTown.name,
                    welcomeMessage: this.currentTown.welcomeMessage
                });
            }

            // 5. Update the browser URL without reloading
            window.history.pushState(
                { handoff: true, previousTown: this.previousTown },
                '',
                targetUrl
            );

            this.notifyCallbacks('onHandoffComplete', { newTown });
            this.notifyCallbacks('onTownChanged', { newTown, previousTown: this.previousTown });
            
        } catch (error) {
            console.error('Error performing hand-off:', error);
            throw error;
        }
    }

    /**
     * Manually trigger hand-off to specific town
     */
    async manualHandOff(townUrl) {
        if (this.handoffInProgress) return;
        
        this.handoffInProgress = true;
        this.notifyCallbacks('onHandoffStart', { targetUrl: townUrl });
        
        try {
            // Update current town URL
            this.currentTownUrl = townUrl;
            
            // Navigate to new town
            window.location.href = townUrl;
            
        } catch (error) {
            console.error('Manual hand-off failed:', error);
            this.notifyCallbacks('onHandoffFailed', { error });
            this.handoffInProgress = false;
        }
    }

    /**
     * Get current town information
     */
    getCurrentTown() {
        return this.currentTown;
    }

    /**
     * Get previous town information
     */
    getPreviousTown() {
        return this.previousTown;
    }

    /**
     * Check if hand-off is in progress
     */
    isHandoffInProgress() {
        return this.handoffInProgress;
    }

    /**
     * Register callback for hand-off start
     */
    onHandoffStart(callback) {
        this.callbacks.onHandoffStart.push(callback);
    }

    /**
     * Register callback for hand-off complete
     */
    onHandoffComplete(callback) {
        this.callbacks.onHandoffComplete.push(callback);
    }

    /**
     * Register callback for hand-off failed
     */
    onHandoffFailed(callback) {
        this.callbacks.onHandoffFailed.push(callback);
    }

    /**
     * Register callback for town changed
     */
    onTownChanged(callback) {
        this.callbacks.onTownChanged.push(callback);
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
     * Destroy hand-off manager
     */
    destroy() {
        this.stopBoundaryCheck();
        this.callbacks = {
            onHandoffStart: [],
            onHandoffComplete: [],
            onHandoffFailed: [],
            onTownChanged: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandoffManager;
}
