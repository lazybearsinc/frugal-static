// Add warehouses cache at the top of the file
let warehousesCache = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get all warehouse change buttons
    const changeButtons = document.querySelectorAll('.change-warehouse');
    
    // Handle warehouse change button clicks
    changeButtons.forEach(button => {
        button.addEventListener('click', showWarehouseSelector);
    });

    // Handle filter buttons
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilter);
    });
});

function handleFilter() {
    // Remove active class from all buttons in the group
    const group = this.closest('.filter-group');
    group.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    this.classList.add('active');
    
    // Get all deal cards
    const deals = document.querySelectorAll('.deal-card');
    const filterType = this.textContent.trim().toLowerCase();

    deals.forEach(deal => {
        const savings = deal.querySelector('.deal-saving').textContent;
        const daysLeft = deal.querySelector('.expires').textContent;
        
        // Show all deals if "All Savings" is selected
        if (filterType === 'all savings') {
            deal.style.display = 'flex';
            return;
        }

        // Handle savings range filters
        if (filterType.includes('$')) {
            const amount = parseInt(savings.match(/\$(\d+)/)[1]);
            const [min, max] = filterType.match(/\d+/g).map(Number);
            
            if (max) {
                deal.style.display = (amount >= min && amount <= max) ? 'flex' : 'none';
            } else {
                deal.style.display = (amount >= min) ? 'flex' : 'none';
            }
        }

        // Handle "Ending Soon" filter
        if (filterType === 'ending soon') {
            const days = parseInt(daysLeft.match(/\d+/)[0]);
            deal.style.display = (days <= 7) ? 'flex' : 'none';
        }

        // Handle "Highest Savings" filter
        if (filterType === 'highest savings') {
            const amount = parseInt(savings.match(/\$(\d+)/)[1]);
            deal.style.display = (amount >= 50) ? 'flex' : 'none';
        }
    });
}

function showWarehouseSelector() {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'warehouse-modal';
    modal.innerHTML = `
        <div class="warehouse-modal-content">
            <h2>Choose Your Warehouse</h2>
            <div class="warehouse-search">
                <input type="text" id="zipcode" placeholder="Enter ZIP code or city..." autocomplete="postal-code">
                <button id="search-warehouses">Search</button>
            </div>
            <div class="warehouse-list">
                <div class="loading" style="display: none;">
                    <svg class="spinner" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5"></circle>
                    </svg>
                    <p>Searching warehouses...</p>
                </div>
                <div class="results"></div>
            </div>
            <button class="close-modal">Close</button>
        </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
        .warehouse-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .warehouse-modal-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .warehouse-search {
            display: flex;
            gap: 10px;
            margin: 20px 0;
        }
        
        .warehouse-search input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
        }
        
        .warehouse-search button {
            padding: 10px 20px;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            min-width: 100px;
        }

        .warehouse-search button:hover {
            opacity: 0.9;
        }

        .warehouse-list {
            margin-top: 20px;
        }

        .warehouse-item {
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 8px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .warehouse-item:hover {
            border-color: var(--primary-color);
            background: #f8f9fa;
        }

        .warehouse-item h3 {
            margin: 0 0 5px 0;
            color: var(--text-color);
        }

        .warehouse-item p {
            margin: 5px 0;
            color: #666;
        }

        .loading {
            text-align: center;
            color: #666;
            padding: 20px;
        }

        .spinner {
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }

        .close-modal {
            display: block;
            width: 100%;
            padding: 12px;
            margin-top: 20px;
            background: #f0f0f0;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
        }

        .close-modal:hover {
            background: #e5e5e5;
        }

        @keyframes spin {
            100% { transform: rotate(360deg); }
        }

        .no-results {
            text-align: center;
            color: #666;
            padding: 20px;
        }
    `;

    // Add modal and styles to document
    document.head.appendChild(styles);
    document.body.appendChild(modal);

    // Get DOM elements
    const searchButton = modal.querySelector('#search-warehouses');
    const input = modal.querySelector('#zipcode');
    const closeButton = modal.querySelector('.close-modal');
    const loading = modal.querySelector('.loading');
    const results = modal.querySelector('.results');

    // Handle search button click
    searchButton.addEventListener('click', () => searchWarehouses(loading, results));

    // Handle input enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchWarehouses(loading, results);
        }
    });

    // Handle close button
    closeButton.addEventListener('click', () => {
        modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Focus input after modal is shown
    setTimeout(() => input.focus(), 100);
}

async function searchWarehouses(loading, results) {
    const query = document.querySelector('#zipcode').value.trim().toLowerCase();
    if (!query) {
        results.innerHTML = '<div class="no-results">Please enter a ZIP code or city name</div>';
        return;
    }

    loading.style.display = 'block';
    results.innerHTML = '';

    try {
        // Load warehouses data if not cached
        if (!warehousesCache) {
            const response = await fetch('/data/warehouses.json');
            if (!response.ok) {
                throw new Error('Failed to load warehouse data');
            }
            warehousesCache = await response.json();
        }

        // Filter warehouses based on search
        const matchingWarehouses = warehousesCache.filter(w => 
            w.city.toLowerCase().includes(query) ||
            w.state.toLowerCase().includes(query) ||
            w.zip_code.toLowerCase().includes(query) ||
            w.address.toLowerCase().includes(query)
        );

        loading.style.display = 'none';
        
        if (matchingWarehouses.length === 0) {
            results.innerHTML = '<div class="no-results">No warehouses found near this location</div>';
            return;
        }

        matchingWarehouses.forEach(warehouse => {
            const div = document.createElement('div');
            div.className = 'warehouse-item';
            div.innerHTML = `
                <h3>${warehouse.name}</h3>
                <p>${warehouse.address}, ${warehouse.city}, ${warehouse.state}</p>
            `;
            div.addEventListener('click', () => selectWarehouse(warehouse));
            results.appendChild(div);
        });
    } catch (error) {
        loading.style.display = 'none';
        results.innerHTML = '<div class="no-results">Error loading warehouses. Please try again.</div>';
        console.error('Warehouse search error:', error);
    }
}

function selectWarehouse(warehouse) {
    // Update the warehouse info in the header
    const address = document.querySelector('.warehouse-address');
    if (address) {
        address.textContent = warehouse.address || `${warehouse.address}, ${warehouse.city}`;
    }

    // Close the modal
    const modal = document.querySelector('.warehouse-modal');
    if (modal) {
        modal.remove();
    }

    // Redirect to the warehouse page
    const slug = `${warehouse.city.toLowerCase()}-${warehouse.state.toLowerCase()}-${warehouse.id}`;
    window.location.href = `/costco-deals/${slug}`;
} 