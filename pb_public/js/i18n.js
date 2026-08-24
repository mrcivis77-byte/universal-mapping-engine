/**
 * Pure JavaScript i18n Translation Engine
 * Lightweight, framework-free internationalization system
 * Loads translations from external JSON files and manages language switching
 */

class I18nEngine {
    constructor() {
        this.currentLanguage = null;
        this.translations = {};
        this.fallbackLanguage = 'en';
        this.storageKey = 'app_language';
        this.localesPath = '/locales/';
    }

    /**
     * Initialize the i18n engine
     * @param {string} defaultLanguage - Default language code
     */
    init(defaultLanguage = null) {
        // Return the same in-flight initialization so concurrent callers
        // await the actual translation load instead of racing past it.
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doInit(defaultLanguage);
        return this._initPromise;
    }

    async _doInit(defaultLanguage = null) {

        // Wait for runtime config so DEFAULT_LANGUAGE is the real value
        if (window.RTM_CONFIG_READY) {
            try {
                await window.RTM_CONFIG_READY;
            } catch (err) {
                console.error('Error waiting for config:', err);
            }
        }
        if (!defaultLanguage && window.APP_CONFIG) {
            defaultLanguage = window.APP_CONFIG.DEFAULT_LANGUAGE;
        }

        // Try to get saved language preference
        const savedLanguage = localStorage.getItem(this.storageKey);
        
        // Detect browser language if no preference saved
        if (savedLanguage) {
            this.currentLanguage = savedLanguage;
        } else if (defaultLanguage) {
            this.currentLanguage = defaultLanguage;
        } else {
            this.currentLanguage = this.detectBrowserLanguage();
        }

        // Load translations for current language
        await this.loadLanguage(this.currentLanguage);
        
        // Apply translations to DOM
        this.applyTranslations();
        
        // Setup language switcher listeners
        this.setupLanguageSwitcher();

        return this;
    }

    /**
     * Detect browser language
     * @returns {string} Detected language code
     */
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0]; // Get primary language code
        
        // Check if we support this language, otherwise fallback
        const supportedLanguages = this.getSupportedLanguages();
        return supportedLanguages.includes(langCode) ? langCode : this.fallbackLanguage;
    }

    /**
     * Load translation file for a specific language
     * @param {string} language - Language code to load
     */
    async loadLanguage(language) {
        try {
            const response = await fetch(`${this.localesPath}${language}.json?v=10`);
            if (!response.ok) {
                throw new Error(`Failed to load ${language}.json`);
            }
            this.translations[language] = await response.json();
            this.currentLanguage = language;
        } catch (error) {
            console.error(`Error loading ${language} translations:`, error);
            
            // Fallback to English if current language fails
            if (language !== this.fallbackLanguage) {
                console.log(`Falling back to ${this.fallbackLanguage}`);
                await this.loadLanguage(this.fallbackLanguage);
            }
        }
    }

    /**
     * Get translation for a key
     * @param {string} key - Translation key (supports nested keys with dots)
     * @param {object} params - Parameters for string interpolation
     * @returns {string} Translated string
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        // Navigate through nested object
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Return key if translation not found
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }
        
        // Handle string interpolation
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return this.interpolate(value, params);
        }
        
        return value;
    }

    /**
     * Interpolate parameters into translated string
     * @param {string} string - String with placeholders
     * @param {object} params - Parameters to replace
     * @returns {string} Interpolated string
     */
    interpolate(string, params) {
        return string.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            // Set text content or placeholder based on element type
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Handle title attributes for elements with data-i18n-title
        const titled = document.querySelectorAll('[data-i18n-title]');
        titled.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
    }

    /**
     * Switch to a different language
     * @param {string} language - New language code
     */
    async switchLanguage(language) {
        if (language === this.currentLanguage) return;
        
        await this.loadLanguage(language);
        localStorage.setItem(this.storageKey, language);
        this.applyTranslations();
        
        // Dispatch custom event for other components to react
        document.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language } 
        }));
    }

    /**
     * Setup language switcher button listeners
     */
    setupLanguageSwitcher() {
        const switchers = document.querySelectorAll('[data-language-switcher]');
        
        switchers.forEach(switcher => {
            switcher.addEventListener('click', (e) => {
                const language = e.target.getAttribute('data-lang');
                if (language) {
                    this.switchLanguage(language);
                }
            });
        });
    }

    /**
     * Get current language
     * @returns {string} Current language code
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get available languages
     * @returns {array} Array of available language codes
     */
    getAvailableLanguages() {
        return Object.keys(this.translations);
    }

    /**
     * Supported languages come from APP_CONFIG.LANGUAGES (comma-separated),
     * falling back to the built-in es/en set.
     * @returns {array} Array of supported language codes
     */
    getSupportedLanguages() {
        const cfg = window.APP_CONFIG && window.APP_CONFIG.LANGUAGES;
        if (cfg) {
            const list = String(cfg).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            if (list.length) return list;
        }
        return ['en', 'es'];
    }
}

// Initialize global i18n instance
const i18n = new I18nEngine();
window.i18n = i18n;

// Auto-initialize when DOM is ready
function autoInit() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => i18n.init(), { once: true });
    } else {
        i18n.init();
    }
}
autoInit();
