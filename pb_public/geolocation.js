/**
 * Shared Geolocation Module
 * Captures live phone GPS data and manages location tracking
 * Handles permissions, accuracy, and data transmission to backend
 */

class GeolocationManager {
    constructor(options = {}) {
        this.watchId = null;
        this.currentPosition = null;
        this.accuracy = null;
        this.updateInterval = options.updateInterval || 5000; // 5 seconds default
        this.enableHighAccuracy = options.enableHighAccuracy || true;
        this.timeout = options.timeout || 10000; // 10 seconds
        this.maximumAge = options.maximumAge || 0; // Always get fresh data
        
        this.callbacks = {
            onPositionUpdate: [],
            onError: [],
            onPermissionGranted: [],
            onPermissionDenied: []
        };
    }

    /**
     * Initialize geolocation and request permissions
     */
    async init() {
        if (!navigator.geolocation) {
            this.handleError(new Error('Geolocation not supported by this browser'));
            return false;
        }

        try {
            // Check permission status
            const permission = await this.checkPermission();
            
            if (permission === 'granted') {
                this.startWatching();
                this.notifyCallbacks('onPermissionGranted');
                return true;
            } else if (permission === 'prompt') {
                // Request permission
                return this.requestPermission();
            } else {
                this.notifyCallbacks('onPermissionDenied');
                return false;
            }
        } catch (error) {
            this.handleError(error);
            return false;
        }
    }

    /**
     * Check geolocation permission status
     */
    async checkPermission() {
        if ('permissions' in navigator) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                return result.state;
            } catch (error) {
                console.error('Error checking geolocation permission:', error);
                return 'prompt';
            }
        }
        return 'prompt';
    }

    /**
     * Request geolocation permission
     */
    requestPermission() {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => {
                    this.startWatching();
                    this.notifyCallbacks('onPermissionGranted');
                    resolve(true);
                },
                (error) => {
                    this.handleError(error);
                    this.notifyCallbacks('onPermissionDenied');
                    resolve(false);
                },
                {
                    enableHighAccuracy: this.enableHighAccuracy,
                    timeout: this.timeout,
                    maximumAge: this.maximumAge
                }
            );
        });
    }

    /**
     * Start continuous position watching
     */
    startWatching() {
        if (this.watchId !== null) {
            this.stopWatching();
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handleError(error),
            {
                enableHighAccuracy: this.enableHighAccuracy,
                timeout: this.timeout,
                maximumAge: this.maximumAge
            }
        );
    }

    /**
     * Stop position watching
     */
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Handle successful position update
     */
    handlePositionUpdate(position) {
        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || null,
            altitudeAccuracy: position.coords.altitudeAccuracy || null,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null,
            timestamp: position.timestamp
        };

        this.accuracy = position.coords.accuracy;
        this.notifyCallbacks('onPositionUpdate', this.currentPosition);
    }

    /**
     * Handle geolocation errors
     */
    handleError(error) {
        let errorMessage = 'Unknown geolocation error';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'User denied geolocation request';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
        }

        console.error('Geolocation error:', errorMessage);
        this.notifyCallbacks('onError', { message: errorMessage, code: error.code });
    }

    /**
     * Get current position (single request)
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (this.currentPosition) {
                resolve(this.currentPosition);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.handlePositionUpdate(position);
                    resolve(this.currentPosition);
                },
                (error) => {
                    this.handleError(error);
                    reject(error);
                },
                {
                    enableHighAccuracy: this.enableHighAccuracy,
                    timeout: this.timeout,
                    maximumAge: this.maximumAge
                }
            );
        });
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
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
     * Check if current position is within bounding box
     */
    isWithinBounds(bounds) {
        if (!this.currentPosition) return false;

        const { sw_lat, sw_lng, ne_lat, ne_lng } = bounds;
        const { latitude, longitude } = this.currentPosition;

        return latitude >= sw_lat && latitude <= ne_lat &&
               longitude >= sw_lng && longitude <= ne_lng;
    }

    /**
     * Register callback for position updates
     */
    onPositionUpdate(callback) {
        this.callbacks.onPositionUpdate.push(callback);
    }

    /**
     * Register callback for errors
     */
    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    /**
     * Register callback for permission granted
     */
    onPermissionGranted(callback) {
        this.callbacks.onPermissionGranted.push(callback);
    }

    /**
     * Register callback for permission denied
     */
    onPermissionDenied(callback) {
        this.callbacks.onPermissionDenied.push(callback);
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
     * Get current position data
     */
    getPosition() {
        return this.currentPosition;
    }

    /**
     * Get accuracy of current position
     */
    getAccuracy() {
        return this.accuracy;
    }

    /**
     * Check if location is actively being tracked
     */
    isTracking() {
        return this.watchId !== null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeolocationManager;
}
