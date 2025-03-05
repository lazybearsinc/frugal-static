class WarehouseLocator {
    constructor() {
        this.warehouses = null; // Cache for warehouse data
    }

    async fetchWarehouses() {
        if (this.warehouses) return this.warehouses;
        try {
            const response = await fetch('/data/warehouses.json');
            if (!response.ok) throw new Error('Failed to load warehouse data');
            this.warehouses = await response.json();
            return this.warehouses;
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            return [];
        }
    }

    getSelectedWarehouse() {
        try {
            const stored = localStorage.getItem('selectedWarehouse');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }

    setSelectedWarehouse(warehouse) {
        try {
            const serialized = {
                id: warehouse.id || warehouse.warehouse_id,
                name: warehouse.name || 'Costco Wholesale',
                address: warehouse.address,
                city: warehouse.city,
                state: warehouse.state,
                slug: warehouse.slug
            };
            localStorage.setItem('selectedWarehouse', JSON.stringify(serialized));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    async showWarehouseSelectorModal() {
        const warehouses = await this.fetchWarehouses();
        if (!warehouses || !warehouses.length) {
            console.error('No warehouses available');
            return;
        }
        
        // Remove existing modal if present
        const existingModal = document.querySelector('.warehouse-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'warehouse-modal';
        modal.innerHTML = `
            <div class="warehouse-modal-content">
                <h2>Select Your Costco Warehouse</h2>
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="Search by city, state or zip code">
                    <div id="searchResults"></div>
                </div>
                <div id="warehouseList">
                    ${warehouses.map(w => `
                        <div class="warehouse-item" data-slug="${w.slug}" data-id="${w.id}">
                            <strong>${w.city}, ${w.state}</strong>
                            <p>${w.address}</p>
                        </div>
                    `).join('')}
                </div>
                <button class="close-modal">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Search functionality
        const searchInput = modal.querySelector('#searchInput');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) {
                modal.querySelectorAll('.warehouse-item').forEach(item => {
                    item.style.display = 'block';
                });
                return;
            }
            
            modal.querySelectorAll('.warehouse-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'block' : 'none';
            });
        });
        
        // Handle warehouse selection
        modal.querySelectorAll('.warehouse-item').forEach(item => {
            item.addEventListener('click', () => {
                const slug = item.dataset.slug;
                const id = item.dataset.id;
                const warehouse = warehouses.find(w => w.slug === slug || w.id === id);
                
                if (warehouse) {
                    this.setSelectedWarehouse(warehouse);
                    modal.remove();
                    window.location.href = `/costco-deals/${slug}`;
                }
            });
        });
        
        // Close modal
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Allow clicking outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async initialize() {
        // Process current URL to determine context
        const pathname = window.location.pathname;
        const pathParts = pathname.split('/').filter(p => p);
        
        // Check if we're on a Costco deals page
        if (pathParts[0] !== 'costco-deals') return;
        
        const selectedWarehouse = this.getSelectedWarehouse();
        
        // Handle index page (costco-deals/)
        if (pathParts.length === 1) {
            if (selectedWarehouse) {
                // Redirect to selected warehouse
                window.location.href = `/costco-deals/${selectedWarehouse.slug}`;
                return;
            } else {
                // No warehouse selected, show selector
                await this.showWarehouseSelectorModal();
                return;
            }
        }
        
        // Handle warehouse page (costco-deals/{warehouse-slug})
        // or deal page (costco-deals/{warehouse-slug}/{deal-slug})
        if (pathParts.length >= 2) {
            const currentSlug = pathParts[1];
            
            // If already has selected warehouse, nothing to do
            if (selectedWarehouse) return;
            
            // Extract warehouse from URL and set it
            const warehouses = await this.fetchWarehouses();
            const currentWarehouse = warehouses.find(w => w.slug === currentSlug);
            
            if (currentWarehouse) {
                // Set the warehouse from the URL
                this.setSelectedWarehouse(currentWarehouse);
                
                // Update any UI that shows the current warehouse
                this.updateWarehouseUI(currentWarehouse);
            }
        }
    }
    
    updateWarehouseUI(warehouse) {
        // Update any UI elements that show the current warehouse
        const addressElement = document.querySelector('.warehouse-address');
        if (addressElement) {
            addressElement.textContent = `${warehouse.address}, ${warehouse.city}`;
        }
        
        const cityElement = document.querySelector('.warehouse-info .warehouse-label');
        if (cityElement) {
            cityElement.textContent = 'Costco Warehouse Deals';
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const locator = new WarehouseLocator();
    
    // Make it globally available
    window.warehouseLocator = locator;
    
    // Initialize the warehouse logic
    locator.initialize();
    
    // Attach event handlers to all warehouse selector buttons
    document.querySelectorAll('.change-warehouse').forEach(button => {
        button.addEventListener('click', () => {
            locator.showWarehouseSelectorModal();
        });
    });
});