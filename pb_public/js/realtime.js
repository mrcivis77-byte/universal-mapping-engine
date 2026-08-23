/**
 * Real-Time PocketBase Integration
 * Handles WebSocket connections, live data synchronization, and event management
 * Connects to PocketBase backend for real-time updates
 */

class RealtimeManager {
    constructor(options = {}) {
        this.pb = null;
        this.connected = false;
        this.subscriptions = {};
        
        this.config = {
            pocketbaseUrl: options.pocketbaseUrl !== undefined ? options.pocketbaseUrl : '',
            autoReconnect: options.autoReconnect !== false,
            reconnectInterval: options.reconnectInterval || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10
        };

        this.reconnectAttempts = 0;
        this.reconnectTimer = null;

        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onError: [],
            onMessage: []
        };
    }

    /**
     * Initialize PocketBase connection
     */
    async init() {
        try {
            // Load PocketBase SDK from CDN
            await this.loadPocketBaseSDK();
            
            // Initialize PocketBase instance
            this.pb = new PocketBase(this.config.pocketbaseUrl);
            
            // Test connection
            await this.testConnection();
            
            this.connected = true;
            this.notifyCallbacks('onConnect');
            
            // Setup auto-reconnect
            if (this.config.autoReconnect) {
                this.setupAutoReconnect();
            }
            
            return true;
        } catch (error) {
            console.error('Failed to initialize PocketBase:', error);
            this.notifyCallbacks('onError', error);
            return false;
        }
    }

    /**
     * Load PocketBase SDK from CDN
     */
    async loadPocketBaseSDK() {
        return new Promise((resolve, reject) => {
            if (window.PocketBase) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pocketbase@0.26.0/dist/pocketbase.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Test PocketBase connection
     */
    async testConnection() {
        try {
            // Simple health check
            const response = await fetch(`${this.config.pocketbaseUrl}/api/health`);
            if (!response.ok) {
                throw new Error('PocketBase health check failed');
            }
            return true;
        } catch (error) {
            throw new Error('Cannot connect to PocketBase server');
        }
    }

    /**
     * Setup auto-reconnect logic
     */
    setupAutoReconnect() {
        this.pb.beforeSend = (url, options) => {
            // Reset reconnect attempts on successful request
            this.reconnectAttempts = 0;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };

        // Handle connection errors
        window.addEventListener('offline', () => {
            this.handleDisconnect();
        });

        window.addEventListener('online', () => {
            this.handleReconnect();
        });
    }

    /**
     * Handle disconnection
     */
    handleDisconnect() {
        this.connected = false;
        this.notifyCallbacks('onDisconnect');
        
        if (this.config.autoReconnect) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval * this.reconnectAttempts;

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.testConnection();
                this.connected = true;
                this.reconnectAttempts = 0;
                this.notifyCallbacks('onConnect');
                
                // Resubscribe to all subscriptions
                await this.resubscribeAll();
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.scheduleReconnect();
            }
        }, delay);
    }

    /**
     * Handle manual reconnection
     */
    async handleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        await this.scheduleReconnect();
    }

    /**
     * Subscribe to collection changes
     * @param {string} collectionName - Collection to subscribe to
     * @param {function} callback - Event handler
     * @param {object} options - { filter: '<PB filter>', ... } optional
     */
    async subscribe(collectionName, callback, options = {}) {
        if (!this.connected) {
            console.warn('Not connected to PocketBase');
            return false;
        }

        try {
            const filter = options.filter || '*';

            // Subscribe to real-time changes. The SDK signature is
            // subscribe(topic, callback, options): topic must be '*' (or a
            // record id), and the filter goes in options (it is normalized
            // into options.query by the SDK). Passing the filter as the topic
            // would subscribe to a nonexistent record and never fire.
            // Unsubscribe first so re-subscribing (after a reconnect or a
            // duty change) never stacks duplicate live channels.
            this.pb.collection(collectionName).unsubscribe();
            this.pb.collection(collectionName).subscribe('*', (event) => {
                this.handleCollectionEvent(collectionName, event, callback);
            }, { filter });

            // Store subscription
            this.subscriptions[collectionName] = {
                callback,
                options,
                active: true
            };

            console.log(`Subscribed to ${collectionName}${filter !== '*' ? ` (filter: ${filter})` : ''}`);
            return true;
        } catch (error) {
            console.error(`Failed to subscribe to ${collectionName}:`, error);
            return false;
        }
    }

    /**
     * Handle collection events
     */
    handleCollectionEvent(collectionName, event, callback) {
        const { action, record } = event;

        console.log(`${collectionName} event:`, action, record);

        // Call the callback with event details
        if (callback) {
            try {
                callback({
                    collection: collectionName,
                    action: action, // 'create', 'update', 'delete'
                    record: record
                });
            } catch (error) {
                console.error('Error in subscription callback:', error);
            }
        }

        // Notify general message callbacks
        this.notifyCallbacks('onMessage', {
            collection: collectionName,
            action: action,
            record: record
        });
    }

    /**
     * Unsubscribe from collection
     */
    unsubscribe(collectionName) {
        if (this.subscriptions[collectionName]) {
            try {
                this.pb.collection(collectionName).unsubscribe();
                delete this.subscriptions[collectionName];
                console.log(`Unsubscribed from ${collectionName}`);
            } catch (error) {
                console.error(`Failed to unsubscribe from ${collectionName}:`, error);
            }
        }
    }

    /**
     * Resubscribe to all active subscriptions
     */
    async resubscribeAll() {
        for (const [collectionName, subscription] of Object.entries(this.subscriptions)) {
            if (subscription.active) {
                await this.subscribe(collectionName, subscription.callback, subscription.options);
            }
        }
    }

    /**
     * Get records from collection
     */
    async getRecords(collectionName, options = {}) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            const records = await this.pb.collection(collectionName).getList(
                options.page || 1,
                options.perPage || 50,
                {
                    // Only sort when explicitly requested: none of these
                    // collections define a `created`/`updated` autodate field,
                    // so a default `-created` sort makes every query fail.
                    sort: options.sort || '',
                    filter: options.filter || '',
                    expand: options.expand || ''
                }
            );
            return records.items;
        } catch (error) {
            console.error(`Failed to get records from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get single record
     */
    async getRecord(collectionName, recordId, options = {}) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            return await this.pb.collection(collectionName).getOne(recordId, {
                expand: options.expand || ''
            });
        } catch (error) {
            console.error(`Failed to get record ${recordId} from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Create record
     */
    async createRecord(collectionName, data) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            return await this.pb.collection(collectionName).create(data);
        } catch (error) {
            console.error(`Failed to create record in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Update record
     */
    async updateRecord(collectionName, recordId, data) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            return await this.pb.collection(collectionName).update(recordId, data);
        } catch (error) {
            console.error(`Failed to update record ${recordId} in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Delete record
     */
    async deleteRecord(collectionName, recordId) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            return await this.pb.collection(collectionName).delete(recordId);
        } catch (error) {
            console.error(`Failed to delete record ${recordId} from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Authenticate user
     */
    async authenticate(email, password) {
        if (!this.connected) {
            throw new Error('Not connected to PocketBase');
        }

        try {
            const authData = await this.pb.collection('users').authWithPassword(email, password);
            return authData;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Register callback for connection events
     */
    onConnect(callback) {
        this.callbacks.onConnect.push(callback);
    }

    /**
     * Register callback for disconnection events
     */
    onDisconnect(callback) {
        this.callbacks.onDisconnect.push(callback);
    }

    /**
     * Register callback for errors
     */
    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    /**
     * Register callback for messages
     */
    onMessage(callback) {
        this.callbacks.onMessage.push(callback);
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
     * Check connection status
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Switch to a different PocketBase instance (town hand-off) without
     * reloading the page. Resubscribes every active subscription.
     * @param {string} newUrl - new PocketBase base URL
     */
    async updateBaseUrl(newUrl) {
        if (!this.pb) {
            throw new Error('PocketBase not initialized');
        }

        const previous = { ...this.subscriptions };

        // Unsubscribe from the old instance
        for (const name of Object.keys(this.subscriptions)) {
            try {
                await this.pb.collection(name).unsubscribe();
            } catch (error) {
                console.warn(`Failed to unsubscribe from ${name}:`, error);
            }
        }
        this.subscriptions = {};

        this.pb.baseUrl = newUrl;
        this.config.pocketbaseUrl = newUrl;

        try {
            await this.testConnection();
            this.connected = true;
            this.reconnectAttempts = 0;
            this.notifyCallbacks('onConnect');

            for (const [name, sub] of Object.entries(previous)) {
                if (sub.active) {
                    await this.subscribe(name, sub.callback, sub.options);
                }
            }
            console.log(`Realtime switched to ${newUrl}`);
            return true;
        } catch (error) {
            this.connected = false;
            this.notifyCallbacks('onDisconnect');
            throw new Error(`Cannot reach new PocketBase at ${newUrl}`);
        }
    }

    /**
     * Disconnect from PocketBase
     */
    disconnect() {
        // Unsubscribe from all collections
        for (const collectionName of Object.keys(this.subscriptions)) {
            this.unsubscribe(collectionName);
        }

        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.connected = false;
        this.notifyCallbacks('onDisconnect');
    }

    /**
     * Get PocketBase instance
     */
    getPocketBase() {
        return this.pb;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeManager;
}
