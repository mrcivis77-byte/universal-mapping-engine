/**
 * Welcome Notification Banner System
 * Displays elegant, non-intrusive welcome banners when users enter new towns
 * Handles town transitions and custom host messages
 */

class WelcomeBanner {
    constructor(options = {}) {
        this.banner = null;
        this.isVisible = false;
        this.currentTown = null;
        this.storageKey = 'welcome_banners_dismissed';
        this.dismissedBanners = this.loadDismissedBanners();
        
        this.config = {
            autoShow: options.autoShow !== false,
            showDuration: options.showDuration || 8000, // 8 seconds
            dismissible: options.dismissible !== false,
            position: options.position || 'top',
            animationDuration: options.animationDuration || 500
        };
        
        this.callbacks = {
            onShow: [],
            onDismiss: [],
            onTownChange: []
        };
    }

    /**
     * Initialize welcome banner system
     */
    init() {
        this.createBannerElement();
        this.setupEventListeners();
        
        // Check for stored town change
        this.checkForTownChange();
    }

    /**
     * Create banner DOM element
     */
    createBannerElement() {
        // Remove existing banner if present
        const existing = document.getElementById('welcome-banner');
        if (existing) {
            existing.remove();
        }

        // Create banner element
        this.banner = document.createElement('div');
        this.banner.id = 'welcome-banner';
        this.banner.className = 'welcome-banner hidden';
        this.banner.innerHTML = `
            <div class="welcome-banner-content">
                <h2 data-i18n="welcome.banner_title"></h2>
                <p data-i18n="welcome.banner_message"></p>
            </div>
            <button class="welcome-banner-close" aria-label="Close welcome banner">&times;</button>
        `;

        // Add to document
        document.body.appendChild(this.banner);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.banner.querySelector('.welcome-banner-close');
        closeBtn.addEventListener('click', () => this.dismiss());

        // Allow dismissal by clicking banner content
        const content = this.banner.querySelector('.welcome-banner-content');
        content.addEventListener('click', () => this.dismiss());

        // Listen for language changes to update translations
        document.addEventListener('languageChanged', () => {
            if (this.isVisible && this.currentTown) {
                this.updateContent(this.currentTown);
            }
        });
    }

    /**
     * Check for town change from URL parameters or storage
     */
    checkForTownChange() {
        // Check URL parameters for town change indication
        const urlParams = new URLSearchParams(window.location.search);
        const newTown = urlParams.get('new_town');
        
        if (newTown) {
            // Fetch town info and show banner
            this.showForTown(newTown);
        }
    }

    /**
     * Show welcome banner for a specific town
     */
    async showForTown(townId, townData = null) {
        // Check if already dismissed for this town
        if (this.isDismissed(townId)) {
            console.log(`Welcome banner already dismissed for town ${townId}`);
            return;
        }

        let townInfo = townData;
        
        // If no town data provided, try to fetch it
        if (!townInfo) {
            townInfo = await this.fetchTownInfo(townId);
        }

        if (townInfo) {
            this.currentTown = townInfo;
            this.show(townInfo);
        }
    }

    /**
     * Fetch town information from local config or API
     */
    async fetchTownInfo(townId) {
        // First try to get from window config
        if (window.APP_CONFIG && window.APP_CONFIG.TOWN_ID === townId) {
            return {
                id: window.APP_CONFIG.TOWN_ID,
                name: window.APP_CONFIG.TOWN_NAME,
                welcomeMessage: window.APP_CONFIG.WELCOME_MESSAGE
            };
        }

        // Otherwise try to fetch from local API
        try {
            const response = await fetch(`/api/towns/${townId}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching town info:', error);
        }

        return null;
    }

    /**
     * Show welcome banner with town information
     */
    show(townInfo) {
        if (!townInfo) return;

        this.currentTown = townInfo;
        this.updateContent(townInfo);
        
        // Show banner
        this.banner.classList.remove('hidden');
        this.isVisible = true;
        
        // Auto-hide after duration if configured
        if (this.config.showDuration > 0) {
            this.autoHideTimer = setTimeout(() => {
                this.dismiss();
            }, this.config.showDuration);
        }
        
        this.notifyCallbacks('onShow', townInfo);
    }

    /**
     * Update banner content with town information
     */
    updateContent(townInfo) {
        const title = this.banner.querySelector('h2');
        const message = this.banner.querySelector('p');
        
        // Use i18n if available, otherwise use direct content
        if (window.i18n) {
            title.textContent = window.i18n.t('welcome.banner_title', { 
                town: townInfo.name 
            });
            message.textContent = window.i18n.t('welcome.banner_message', { 
                message: townInfo.welcomeMessage 
            });
        } else {
            title.textContent = `Welcome to ${townInfo.name}!`;
            message.textContent = townInfo.welcomeMessage;
        }
    }

    /**
     * Dismiss the welcome banner
     */
    dismiss() {
        if (!this.isVisible) return;

        // Clear auto-hide timer
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }

        // Hide banner
        this.banner.classList.add('hidden');
        this.isVisible = false;

        // Mark as dismissed for this town
        if (this.currentTown) {
            this.markAsDismissed(this.currentTown.id);
        }

        this.notifyCallbacks('onDismiss', this.currentTown);
    }

    /**
     * Mark a town's banner as dismissed
     */
    markAsDismissed(townId) {
        if (!this.dismissedBanners.includes(townId)) {
            this.dismissedBanners.push(townId);
            this.saveDismissedBanners();
        }
    }

    /**
     * Check if a town's banner has been dismissed
     */
    isDismissed(townId) {
        return this.dismissedBanners.includes(townId);
    }

    /**
     * Load dismissed banners from localStorage
     */
    loadDismissedBanners() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading dismissed banners:', error);
            return [];
        }
    }

    /**
     * Save dismissed banners to localStorage
     */
    saveDismissedBanners() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.dismissedBanners));
        } catch (error) {
            console.error('Error saving dismissed banners:', error);
        }
    }

    /**
     * Clear dismissed banners history
     */
    clearDismissedHistory() {
        this.dismissedBanners = [];
        this.saveDismissedBanners();
    }

    /**
     * Reset banner for a specific town (show it again)
     */
    resetForTown(townId) {
        const index = this.dismissedBanners.indexOf(townId);
        if (index > -1) {
            this.dismissedBanners.splice(index, 1);
            this.saveDismissedBanners();
        }
    }

    /**
     * Manually trigger banner show
     */
    manualShow(townInfo) {
        this.clearDismissedHistory();
        this.show(townInfo);
    }

    /**
     * Check if banner is currently visible
     */
    isBannerVisible() {
        return this.isVisible;
    }

    /**
     * Get current town information
     */
    getCurrentTown() {
        return this.currentTown;
    }

    /**
     * Register callback for banner show
     */
    onShow(callback) {
        this.callbacks.onShow.push(callback);
    }

    /**
     * Register callback for banner dismiss
     */
    onDismiss(callback) {
        this.callbacks.onDismiss.push(callback);
    }

    /**
     * Register callback for town change
     */
    onTownChange(callback) {
        this.callbacks.onTownChange.push(callback);
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
     * Destroy welcome banner
     */
    destroy() {
        // Clear timers
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }

        // Remove banner from DOM
        if (this.banner) {
            this.banner.remove();
            this.banner = null;
        }

        // Clear callbacks
        this.callbacks = {
            onShow: [],
            onDismiss: [],
            onTownChange: []
        };

        this.isVisible = false;
        this.currentTown = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WelcomeBanner;
}
