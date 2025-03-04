// Warehouse location utilities
class WarehouseLocator {
    /**
     * @param {Object} config - Configuration object
     * @param {Object} config.defaultLocation - Default location coordinates
     * @param {number} config.defaultLocation.lat - Default latitude
     * @param {number} config.defaultLocation.lon - Default longitude
     * @param {number} config.maxDistance - Maximum distance in km to consider a warehouse "nearby"
     */
    constructor(config = {}) {
        console.log('WarehouseLocator: Initializing...', config);
        this.EARTH_RADIUS = 6371.0;
        this.defaultLocation = config.defaultLocation || { lat: 37.7749, lon: -122.4194 };
        this.maxDistance = config.maxDistance || 100;
        this.warehouses = null; // Cache for warehouse data
        console.log('WarehouseLocator: Initialized with config:', {
            defaultLocation: this.defaultLocation,
            maxDistance: this.maxDistance
        });
    }

    /**
     * Fetch warehouse data dynamically from warehouses.json
     * @returns {Promise<Array>} Array of warehouse objects
     */
    async fetchWarehouses() {
        if (this.warehouses) {
            return this.warehouses; // Return cached data if available
        }
        try {
            const response = await fetch('/data/warehouses.json');
            if (!response.ok) {
                throw new Error('Failed to load warehouse data');
            }
            this.warehouses = await response.json();
            return this.warehouses;
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            return []; // Return empty array as fallback
        }
    }

    /**
     * Validate latitude and longitude values
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {boolean} True if coordinates are valid
     */
    isValidCoordinates(lat, lon) {
        return (
            typeof lat === 'number' &&
            typeof lon === 'number' &&
            !isNaN(lat) &&
            !isNaN(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
        );
    }

    /**
     * Calculate the great-circle distance between two points using the Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number|null} Distance in kilometers or null if invalid
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        if (!this.isValidCoordinates(lat1, lon1) || !this.isValidCoordinates(lat2, lon2)) {
            console.warn('Invalid coordinates provided to haversineDistance');
            return null;
        }
        try {
            const phi1 = this.toRadians(lat1);
            const phi2 = this.toRadians(lat2);
            const deltaPhi = this.toRadians(lat2 - lat1);
            const deltaLambda = this.toRadians(lon2 - lon1);
            const a = Math.sin(deltaPhi / 2) ** 2 +
                     Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
            const c = 2 * Math.asin(Math.sqrt(a));
            return this.EARTH_RADIUS * c;
        } catch (error) {
            console.error('Error calculating distance:', error);
            return null;
        }
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Find all warehouses within the minimum distance from a reference point
     * @param {number} referenceLat - Reference latitude
     * @param {number} referenceLon - Reference longitude
     * @returns {Object} Object containing nearest warehouses and their distances
     */
    async findNearestWarehouses(referenceLat, referenceLon) {
        if (!this.isValidCoordinates(referenceLat, referenceLon)) {
            throw new Error('Invalid reference coordinates');
        }
        const warehouses = await this.fetchWarehouses();
        let minDistance = Infinity;
        let nearestWarehouses = [];
        
        warehouses.forEach(warehouse => {
            if (!this.isValidCoordinates(warehouse.lat, warehouse.lon)) {
                console.warn(`Invalid coordinates for warehouse: ${warehouse.name || 'unnamed'}`);
                return;
            }
            const distance = this.haversineDistance(referenceLat, referenceLon, warehouse.lat, warehouse.lon);
            if (distance === null) return;
            if (distance < minDistance) {
                minDistance = distance;
                nearestWarehouses = [{ warehouse, distance }];
            } else if (Math.abs(distance - minDistance) < 0.1) {
                nearestWarehouses.push({ warehouse, distance });
            }
        });
        
        if (nearestWarehouses.length > 1) {
            nearestWarehouses.sort((a, b) => a.warehouse.name?.localeCompare(b.warehouse.name || '') || 0);
        }
        
        return {
            warehouses: nearestWarehouses,
            distance: minDistance
        };
    }

    /**
     * Get user's current location using the Geolocation API
     * @returns {Promise} Resolves with the user's coordinates
     */
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                position => {
                    const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
                    if (!this.isValidCoordinates(coords.lat, coords.lon)) {
                        resolve(this.defaultLocation);
                        return;
                    }
                    resolve(coords);
                },
                error => {
                    console.warn('Error getting location:', error.message);
                    resolve(this.defaultLocation);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    }

    /**
     * Safely serialize warehouse data for storage
     * @param {Object} warehouse - Warehouse object to serialize
     * @returns {Object} Serializable warehouse data
     */
    serializeWarehouse(warehouse) {
        if (!warehouse) return null;
        return {
            id: warehouse.id,
            name: warehouse.name,
            address: warehouse.address,
            city: warehouse.city,
            lat: warehouse.lat,
            lon: warehouse.lon,
            slug: warehouse.slug
        };
    }

    /**
     * Check if this is the user's first visit
     * @returns {boolean} True if no warehouse is selected
     */
    isFirstVisit() {
        return !this.getSelectedWarehouse();
    }

    /**
     * Show warehouse selector modal with dynamically fetched data
     */
    async showWarehouseSelectorModal() {
        const warehouses = await this.fetchWarehouses();
        if (!warehouses || warehouses.length === 0) {
            console.error('No warehouses available to display');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'warehouse-modal';
        modal.innerHTML = `
            <div class="warehouse-modal-content">
                <button class="close-modal" aria-label="Close modal">×</button>
                <h2>Select Your Costco Warehouse</h2>
                <div class="warehouse-search">
                    <input type="text" placeholder="Search by city or zip code" id="warehouseSearch">
                </div>
                <div class="warehouse-list">
                    ${warehouses.map(w => `
                        <div class="warehouse-item" data-slug="${w.slug}">
                            <div class="warehouse-item-info">
                                <strong>${w.city}, ${w.state}</strong>
                                <span>${w.address}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const styles = document.createElement('style');
        styles.textContent = `
            .warehouse-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
            .warehouse-modal-content { background: white; padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; }
            .close-modal { position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; border: none; background: none; cursor: pointer; padding: 0.5rem; }
            .close-modal:hover { opacity: 0.7; }
            .warehouse-search { margin: 1rem 0; }
            .warehouse-search input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
            .warehouse-list { max-height: 400px; overflow-y: auto; }
            .warehouse-item { padding: 1rem; border: 1px solid #eee; margin: 0.5rem 0; border-radius: 6px; cursor: pointer; transition: background-color 0.2s ease; }
            .warehouse-item:hover { background: #f9f9f9; }
            .warehouse-item-info { display: flex; flex-direction: column; gap: 0.25rem; }
        `;
        document.head.appendChild(styles);

        // Close modal handlers
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Warehouse selection handler
        modal.querySelectorAll('.warehouse-item').forEach(item => {
            item.addEventListener('click', () => {
                const slug = item.dataset.slug;
                const warehouse = warehouses.find(w => w.slug === slug);
                if (warehouse) {
                    this.setSelectedWarehouse(warehouse);
                    window.location.href = `/costco-deals/${slug}`;
                }
                closeModal();
            });
        });

        // Search functionality
        const searchInput = modal.querySelector('#warehouseSearch');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            modal.querySelectorAll('.warehouse-item').forEach(item => {
                const warehouse = warehouses.find(w => w.slug === item.dataset.slug);
                const searchText = `${warehouse.city} ${warehouse.state} ${warehouse.zip_code || ''}`.toLowerCase();
                item.style.display = searchText.includes(query) ? 'block' : 'none';
            });
        });

        document.body.appendChild(modal);
    }

    /**
     * Initialize warehouse location handling with first visit check
     * @returns {Promise} Resolves with the nearest warehouse
     */
    async initialize() {
        console.log('WarehouseLocator: Starting initialization');
        try {
            const warehouses = await this.fetchWarehouses();
            if (!warehouses || warehouses.length === 0) {
                console.error('No warehouse data available');
                throw new Error('No warehouse data available');
            }

            const currentPath = window.location.pathname;
            const isDealsListPage = currentPath === '/costco-deals/' || currentPath === '/costco-deals';
            
            if (isDealsListPage && this.isFirstVisit()) {
                console.log('Showing warehouse selector modal');
                await this.showWarehouseSelectorModal();
                return null;
            }

            const userLocation = await this.getUserLocation();
            const result = await this.findNearestWarehouses(userLocation.lat, userLocation.lon);
            const nearest = result.warehouses[0];

            if (nearest && nearest.warehouse) {
                if (nearest.distance <= this.maxDistance) {
                    const serializedWarehouse = this.serializeWarehouse(nearest.warehouse);
                    if (serializedWarehouse) {
                        localStorage.setItem('selectedWarehouse', JSON.stringify(serializedWarehouse));
                        localStorage.setItem('warehouseDistance', nearest.distance.toFixed(1));
                    }
                }
                return {
                    warehouse: nearest.warehouse,
                    distance: nearest.distance,
                    alternativeWarehouses: result.warehouses.slice(1)
                };
            }

            throw new Error('No valid warehouses found');
        } catch (error) {
            console.error('Error during initialization:', error);
            const warehouses = await this.fetchWarehouses();
            const fallbackWarehouse = warehouses.find(w => this.isValidCoordinates(w.lat, w.lon));
            return {
                warehouse: fallbackWarehouse || null,
                distance: null,
                alternativeWarehouses: []
            };
        }
    }

    /**
     * Get the currently selected warehouse
     * @returns {Object|null} The selected warehouse or null if none selected
     */
    getSelectedWarehouse() {
        try {
            const stored = localStorage.getItem('selectedWarehouse');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }

    /**
     * Set a new selected warehouse
     * @param {Object} warehouse - The warehouse object to set as selected
     * @returns {boolean} Success status
     */
    setSelectedWarehouse(warehouse) {
        try {
            const serialized = this.serializeWarehouse(warehouse);
            if (serialized) {
                localStorage.setItem('selectedWarehouse', JSON.stringify(serialized));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving warehouse to localStorage:', error);
            return false;
        }
    }
}

// Initialize the warehouse locator when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const locator = new WarehouseLocator();
    await locator.initialize();
}); 