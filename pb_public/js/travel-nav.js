/**
 * TravelNavController - bottom-bar layer toggles for travel apps (parque).
 * Treasures = hidden gems, Attractions = cultural sites, Restaurants = PB feed.
 * Each button toggles its marker group on/off the map.
 */
class TravelNavController {
    constructor(options = {}) {
        this.map = options.map;
        this.gems = options.gems || null;
        this.attractions = options.attractions || null;
        this.realtimeManager = options.realtimeManager || null;
        this.restaurants = [];
        this.visible = { treasures: true, attractions: true, restaurants: true };
    }

    pocketbaseUrl() {
        return (this.realtimeManager && this.realtimeManager.config && this.realtimeManager.config.pocketbaseUrl) || '';
    }

    async init() {
        await this.loadRestaurants();
        this.renderRestaurants();
        this.bind('travel-treasures-btn', 'treasures', () => this.toggleTreasures());
        this.bind('travel-attractions-btn', 'attractions', () => this.toggleAttractions());
        this.bind('travel-restaurants-btn', 'restaurants', () => this.toggleRestaurants());
    }

    bind(btnId, key, fn) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.classList.add('active');
        btn.addEventListener('click', () => {
            fn();
            btn.classList.toggle('active', this.visible[key]);
        });
    }

    async loadRestaurants() {
        try {
            const base = this.pocketbaseUrl();
            if (!base) return;
            const townId = window.APP_CONFIG && window.APP_CONFIG.TOWN_ID;
            let url = base + '/api/collections/restaurants/records?perPage=200&sort=-created';
            if (townId) url += '&filter=' + encodeURIComponent('town.town_id = "' + townId + '"');
            let res = await fetch(url);
            if (res.status === 400 && townId) {
                // Collection has no town relation - retry unfiltered
                res = await fetch(base + '/api/collections/restaurants/records?perPage=200');
            }
            if (!res.ok) {
                console.info('[travel-nav] no restaurants collection yet (' + res.status + ')');
                return;
            }
            const data = await res.json();
            this.restaurants = (data.items || []).filter(r => r.latitude && r.longitude);
        } catch (err) {
            console.info('[travel-nav] restaurants unavailable:', err && err.message);
        }
    }

    renderRestaurants() {
        this.restaurants.forEach(r => {
            this.map.updateMarker('restaurant_' + r.id, r.latitude, r.longitude, {
                appType: 'travel',
                entityType: 'restaurant',
                popupContent: '<div class="proximity-popup"><h3>' + (r.name || 'Restaurante') + '</h3>' +
                    (r.description ? '<p>' + r.description + '</p>' : '') +
                    (r.cuisine ? '<p>' + r.cuisine + '</p>' : '') + '</div>'
            });
        });
    }

    removeRestaurants() {
        this.restaurants.forEach(r => this.map.removeMarker('restaurant_' + r.id));
    }

    toggleTreasures() {
        this.visible.treasures = !this.visible.treasures;
        if (!this.gems) return;
        if (this.visible.treasures) {
            this.gems.renderAllGems();
        } else {
            this.gems.getGems().forEach(g => this.map.removeMarker(g.id));
        }
    }

    toggleAttractions() {
        this.visible.attractions = !this.visible.attractions;
        if (!this.attractions) return;
        if (this.visible.attractions) {
            this.attractions.addAttractionMarkers();
        } else {
            this.attractions.getAttractions().forEach(a => this.map.removeMarker(a.id));
        }
    }

    toggleRestaurants() {
        this.visible.restaurants = !this.visible.restaurants;
        if (this.visible.restaurants) this.renderRestaurants();
        else this.removeRestaurants();
    }
}
window.TravelNavController = TravelNavController;
