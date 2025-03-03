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
        // Earth's radius in kilometers
        this.EARTH_RADIUS = 6371.0;
        
        // Default location (configurable, defaults to San Francisco)
        this.defaultLocation = config.defaultLocation || {
            lat: 37.7749,
            lon: -122.4194
        };

        // Maximum distance to consider a warehouse "nearby" (in km)
        this.maxDistance = config.maxDistance || 100;
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
     * @param {number} lat1 - Latitude of first point in decimal degrees
     * @param {number} lon1 - Longitude of first point in decimal degrees
     * @param {number} lat2 - Latitude of second point in decimal degrees
     * @param {number} lon2 - Longitude of second point in decimal degrees
     * @returns {number|null} Distance in kilometers or null if coordinates are invalid
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        // Validate coordinates
        if (!this.isValidCoordinates(lat1, lon1) || !this.isValidCoordinates(lat2, lon2)) {
            console.warn('Invalid coordinates provided to haversineDistance');
            return null;
        }

        try {
            // Convert lat/long to radians
            const phi1 = this.toRadians(lat1);
            const phi2 = this.toRadians(lat2);
            const deltaPhi = this.toRadians(lat2 - lat1);
            const deltaLambda = this.toRadians(lon2 - lon1);

            // Haversine formula
            const a = Math.sin(deltaPhi / 2) ** 2 +
                     Math.cos(phi1) * Math.cos(phi2) *
                     Math.sin(deltaLambda / 2) ** 2;
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
     * @param {Array} locations - Array of warehouse objects with lat and lon properties
     * @returns {Object} Object containing nearest warehouses and their distances
     */
    findNearestWarehouses(referenceLat, referenceLon, locations) {
        if (!this.isValidCoordinates(referenceLat, referenceLon)) {
            throw new Error('Invalid reference coordinates');
        }

        let minDistance = Infinity;
        let nearestWarehouses = [];

        // First pass: find minimum distance
        locations.forEach(warehouse => {
            if (!this.isValidCoordinates(warehouse.lat, warehouse.lon)) {
                console.warn(`Invalid coordinates for warehouse: ${warehouse.name || 'unnamed'}`);
                return;
            }

            const distance = this.haversineDistance(
                referenceLat,
                referenceLon,
                warehouse.lat,
                warehouse.lon
            );

            if (distance === null) return;

            if (distance < minDistance) {
                minDistance = distance;
                nearestWarehouses = [{ warehouse, distance }];
            } else if (Math.abs(distance - minDistance) < 0.1) { // Consider warehouses within 100m as equidistant
                nearestWarehouses.push({ warehouse, distance });
            }
        });

        // Sort by additional criteria if multiple warehouses at same distance
        if (nearestWarehouses.length > 1) {
            nearestWarehouses.sort((a, b) => {
                // Sort by name if distances are equal
                return a.warehouse.name?.localeCompare(b.warehouse.name || '') || 0;
            });
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
                    const coords = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    };

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
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
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

        // Only include essential, serializable properties
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
     * Initialize warehouse location handling
     * @param {Array} warehouses - Array of warehouse objects
     * @returns {Promise} Resolves with the nearest warehouse
     */
    async initialize(warehouses) {
        try {
            if (!warehouses || !Array.isArray(warehouses) || warehouses.length === 0) {
                throw new Error('No warehouse data available');
            }

            // Get user's location
            const userLocation = await this.getUserLocation();
            
            // Find nearest warehouses
            const result = this.findNearestWarehouses(
                userLocation.lat,
                userLocation.lon,
                warehouses
            );

            // Get the closest warehouse (first one after sorting)
            const nearest = result.warehouses[0];

            if (nearest && nearest.warehouse) {
                // Only store if within maximum distance
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
                    alternativeWarehouses: result.warehouses.slice(1) // Other equidistant warehouses
                };
            }

            throw new Error('No valid warehouses found');
        } catch (error) {
            console.error('Error initializing warehouse locator:', error);
            
            // Return the first valid warehouse as fallback
            const fallbackWarehouse = warehouses.find(w => 
                this.isValidCoordinates(w.lat, w.lon)
            );

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