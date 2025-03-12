const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const Handlebars = require('handlebars');
const dotenv = require('dotenv');
const registerPartials = require('./register-partials');
const mockData = require('./mock-data');
const cache = require('./cache');

// Register JSON helper
Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

// Register the 'and' helper for logical AND operations
Handlebars.registerHelper('and', function() {
    return Array.prototype.every.call(arguments, Boolean);
});

// Register the 'eq' helper for equality comparison
Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

// Register the 'mod' helper for modulo operation
Handlebars.registerHelper('mod', function(a, b) {
    return a % b;
});

// Register Handlebars helper for date formatting
Handlebars.registerHelper('formatDate', function(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Register logical helpers
Handlebars.registerHelper('not', function(value) {
    return !value;
});

// Load environment variables
dotenv.config();

// API Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.getfrugal.ai';
const API_KEY = process.env.API_KEY;
const IS_DEV = process.env.NODE_ENV === 'development';
const CACHE_ENABLED = !IS_DEV && process.env.CACHE_ENABLED !== 'false';

if (!IS_DEV && !API_KEY) {
    console.error('❌ API_KEY is not set in .env file');
    process.exit(1);
}

async function fetchWithRetry(url, options, retries = 3) {
    // Define retryable status codes
    const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);
                
                // For non-retryable errors, fail fast
                if (!isRetryable) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}. This error is not retryable.`);
                }
                
                // For retryable errors on last attempt, throw error
                if (i === retries - 1) {
                    throw new Error(`Failed after ${retries} retries. Last error: HTTP ${response.status} - ${response.statusText}`);
                }
                
                // Log retry attempt for retryable errors
                console.log(`Retryable error (HTTP ${response.status}) on attempt ${i + 1}/${retries} for ${url}`);
                
                // Exponential backoff with jitter
                const backoffMs = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000, 10000);
                console.log(`Waiting ${Math.round(backoffMs/1000)}s before next retry...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }
            
            return await response.json();
            
        } catch (error) {
            // Network errors or JSON parsing errors
            if (i === retries - 1) {
                throw new Error(`Failed after ${retries} retries. Last error: ${error.message}`);
            }
            
            console.log(`Error on attempt ${i + 1}/${retries} for ${url}: ${error.message}`);
            
            // Exponential backoff with jitter for other errors
            const backoffMs = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000, 10000);
            console.log(`Waiting ${Math.round(backoffMs/1000)}s before next retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
    }
}

async function fetchData() {
    // Use mock data in development mode
    if (IS_DEV) {
        console.log('🔧 Using mock data for development');
        return {
            warehouses: mockData.warehouses,
            deals: mockData.warehouses.flatMap(w => w.deals)
        };
    }

    // Check cache first in production with TTL validation
    if (CACHE_ENABLED) {
        const cachedData = await cache.get('warehouses-data');
        if (cachedData && cachedData.timestamp) {
            const cacheAge = Date.now() - cachedData.timestamp;
            const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            
            if (cacheAge < CACHE_TTL) {
                console.log('📦 Using cached data (age: ' + Math.round(cacheAge / (60 * 60 * 1000)) + ' hours)');
                return cachedData.data;
            } else {
                console.log('🔄 Cache expired, fetching fresh data...');
            }
        }
    }

    try {
        console.log(`Fetching warehouses from ${API_BASE_URL}/cloud/costco-warehouses`);
        
        // Fetch warehouses
        const warehouses = await fetchWithRetry(
            `${API_BASE_URL}/cloud/costco-warehouses`,
            {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            }
        );

        console.log(`Found ${warehouses.length} warehouses`);

        // Process warehouses to add slugs
        const processedWarehouses = warehouses.map(warehouse => ({
            ...warehouse,
            id: warehouse.warehouse_id, // Explicitly set id
            slug: `${warehouse.city.toLowerCase()}-${warehouse.state.toLowerCase()}-${warehouse.warehouse_id}`,
            lat: parseFloat(warehouse.latitude || 0), // Ensure numeric values with fallback
            lon: parseFloat(warehouse.longitude || 0),
            deals: [] // Initialize empty deals array
        }));

        // Filter out warehouses with invalid coordinates
        const validWarehouses = processedWarehouses.filter(warehouse => 
            !isNaN(warehouse.lat) && 
            !isNaN(warehouse.lon) && 
            warehouse.lat !== 0 &&  
            warehouse.lon !== 0
        );

        if (validWarehouses.length < processedWarehouses.length) {
            console.log(`⚠️ Filtered out ${processedWarehouses.length - validWarehouses.length} warehouses with invalid coordinates`);
        }

        // Fetch deals for each warehouse sequentially
        console.log('Fetching deals for warehouses sequentially...');
        
        for (const warehouse of validWarehouses) {
            console.log(`Fetching deals for ${warehouse.city}, ${warehouse.state} (${warehouse.zip_code})`);
            
            let allDeals = [];
            let hasMore = true;
            let skip = 0;
            const limit = 100;

            while (hasMore) {
                const dealsData = await fetchWithRetry(
                    `${API_BASE_URL}/cloud/get_costco_savings?zipcode=${warehouse.zip_code}&country=${warehouse.country}&limit=${limit}&skip=${skip}`,
                    {
                        headers: { 'Authorization': `Bearer ${API_KEY}` }
                    }
                );
                
                // Process deals from current page
                const processedDeals = dealsData.deals.map(deal => ({
                    id: deal.item_number,
                    title: deal.product_title || deal.description,
                    slug: `${deal.item_number}-${slugify(deal.description)}`,
                    savings: formatPrice(deal.instant_saving, deal.country),
                    savingsValue: deal.instant_saving, // Numerical value
                    imageUrl: deal.product_image_url || deal.image_url || '/images/placeholder.svg',
                    finalPrice: formatPrice(deal.final_price, deal.country),
                    originalPrice: formatPrice(deal.product_current_price, deal.country),
                    itemNumber: deal.item_number,
                    startDate: new Date(deal.start_date),
                    endDate: new Date(deal.end_date),
                    daysLeft: Math.ceil((new Date(deal.end_date) - new Date()) / (1000 * 60 * 60 * 24)),
                    description: deal.description,
                    isOnlineOnly: deal.is_online_only,
                    onlineLink: deal.online_link || deal.product_url,
                    dealHash: deal.deal_hash
                }));

                allDeals = [...allDeals, ...processedDeals];
                
                // Check if there are more pages
                hasMore = dealsData.metadata.has_more;
                if (hasMore) {
                    skip += limit;
                    console.log(`Fetching more deals for ${warehouse.city} (${allDeals.length} deals so far)`);
                }
            }

            warehouse.deals = allDeals;
            console.log(`✓ Completed fetching ${allDeals.length} deals for ${warehouse.city}`);
        }

        const data = {
            warehouses: validWarehouses,
            deals: validWarehouses.flatMap(w => w.deals)
        };

        // Cache the data in production with timestamp
        if (CACHE_ENABLED) {
            await cache.set('warehouses-data', {
                data,
                timestamp: Date.now()
            });
            console.log('📦 Data cached successfully with 24-hour TTL');
        }

        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

// Helper function to format price
function formatPrice(price, country = 'US') {
    if (price === null || price === undefined) return null;
    return new Intl.NumberFormat(country === 'CA' ? 'en-CA' : 'en-US', {
        style: 'currency',
        currency: country === 'CA' ? 'CAD' : 'USD'
    }).format(price);
}

// Helper function to create URL-friendly slugs
function slugify(text) {
    if (!text) return '';
    
    // Convert to lowercase and remove accents/diacritics
    const slug = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Replace non-word chars (except spaces and hyphens) with empty string
        .replace(/[^\w\s-]/g, '')
        // Replace multiple spaces or hyphens with single hyphen
        .replace(/[\s_-]+/g, '-')
        // Remove leading and trailing hyphens
        .replace(/^-+|-+$/g, '');
    
    // If slug is already short enough, return it
    if (slug.length <= 50) return slug;
    
    // Find the last word boundary (hyphen) within the 50-char limit
    const truncated = slug.substring(0, 50);
    const lastHyphen = truncated.lastIndexOf('-');
    
    // If no hyphen found or it's at the start, just return the truncated string
    if (lastHyphen <= 0) return truncated;
    
    // Return the slug truncated at the last word boundary
    return truncated.substring(0, lastHyphen);
}

// Template cache for compiled templates
const templateCache = new Map();

async function loadTemplate(templateName) {
    // Check if template is already cached
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }

    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    
    // Cache the compiled template
    templateCache.set(templateName, compiledTemplate);
    return compiledTemplate;
}

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

async function generateWarehouseData(warehouses) {
    // Create a simplified version of warehouse data for search
    const warehouseData = warehouses.map(w => ({
        id: w.warehouse_id,
        name: 'Costco Wholesale',
        address: w.address,
        city: w.city,
        state: w.state,
        zip_code: w.zip_code,
        slug: w.slug
    }));

    // Save warehouse data to a JSON file
    const warehouseDataPath = path.join(__dirname, '..', 'public', 'data');
    await ensureDirectoryExists(warehouseDataPath);
    await fs.writeFile(
        path.join(warehouseDataPath, 'warehouses.json'),
        JSON.stringify(warehouseData, null, 2)
    );
    console.log('✓ Generated warehouses.json');
}
async function generateWarehousePages(warehouses, template) {
    console.log('🏗️ Generating warehouse pages...');
    await Promise.all(warehouses.map(async (warehouse) => {
        const warehousePath = path.join(__dirname, '..', 'public', 'costco-deals', warehouse.slug);
        await ensureDirectoryExists(warehousePath);
        const html = template({
            warehouse,
            title: `Costco Deals in ${warehouse.city}, ${warehouse.state} | Frugal`,
            description: `Browse the latest deals and savings at Costco ${warehouse.city}, ${warehouse.state}.`
        });
        await fs.writeFile(path.join(warehousePath, 'index.html'), html);
        console.log(`✓ Generated warehouse page: ${warehouse.city}, ${warehouse.state}`);
    }));
    console.log('✅ All warehouse pages generated');
}
async function generateDealPages(warehouses, template) {
    console.log('🏗️ Generating deal pages in parallel...');
    
    const generateDealPage = async (warehouse, deal) => {
        const dealPath = path.join(__dirname, '..', 'public', 'costco-deals', warehouse.slug, deal.slug);
        await ensureDirectoryExists(dealPath);

        // Format dates for display
        const formattedEndDate = deal.endDate instanceof Date 
            ? deal.endDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })
            : new Date(deal.endDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

        const html = template({
            deal: {
                ...deal,
                endDate: formattedEndDate
            },
            warehouse,
            allWarehouses: warehouses,
            title: `${deal.title} Deal at ${warehouse.city} Costco | Frugal`,
            description: `Save ${deal.savings} on ${deal.title} at Costco ${warehouse.city}. Limited time offer, valid through ${formattedEndDate}.`
        });

        await fs.writeFile(path.join(dealPath, 'index.html'), html);
        console.log(`✓ Generated deal page: ${deal.title.substring(0, 30)}... (${warehouse.city})`);
    };

    // Process deals in parallel with chunking for memory efficiency
    const CHUNK_SIZE = 10; // Adjust based on system capabilities
    let totalDealsProcessed = 0;

    for (const warehouse of warehouses) {
        const deals = warehouse.deals;
        const chunks = [];
        
        for (let i = 0; i < deals.length; i += CHUNK_SIZE) {
            const chunk = deals.slice(i, i + CHUNK_SIZE);
            chunks.push(chunk);
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(deal => generateDealPage(warehouse, deal)));
            totalDealsProcessed += chunk.length;
            console.log(`Progress: ${totalDealsProcessed} deals processed`);
        }
    }

    console.log('✅ All deal pages generated successfully');
}

async function generateIndexPage(warehouses, template) {
    const defaultWarehouse = warehouses[0];
    if (!defaultWarehouse) {
        console.error('❌ No warehouses available to use as default');
        process.exit(1);
    }
    const indexPath = path.join(__dirname, '..', 'public', 'costco-deals');
    await ensureDirectoryExists(indexPath);
    const html = template({
        warehouse: defaultWarehouse, // Changed from defaultWarehouse to warehouse
        allWarehouses: warehouses,
        title: `Costco Deals | Find the Best Savings at Your Local Warehouse`,
        description: `Browse the latest Costco deals and instant savings...`
    });
    await fs.writeFile(path.join(indexPath, 'index.html'), html);
    console.log(`✓ Generated index page`);
}
async function generateRedirectPages(warehouses) {
    console.log('🏗️ Generating redirect pages...');
    const redirectBasePath = path.join(__dirname, '..', 'public', 'redirect');
    await ensureDirectoryExists(redirectBasePath); // Ensure the redirect directory exists

    for (const warehouse of warehouses) {
        for (const deal of warehouse.deals) {
                        // Skip if dealHash is undefined
                        if (!deal.dealHash) {
                            console.warn(`⚠️ Skipping redirect page for deal "${deal.title}" - no dealHash available`);
                            continue;
                        }
            const redirectPath = path.join(redirectBasePath, deal.dealHash);
            await ensureDirectoryExists(redirectPath);
            const dealUrl = `/costco-deals/${warehouse.slug}/${deal.slug}`;
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=${dealUrl}">
    <title>Redirecting to Deal</title>
</head>
<body>
    <p>Redirecting to <a href="${dealUrl}">${deal.title}</a>...</p>
</body>
</html>
            `.trim();
            await fs.writeFile(path.join(redirectPath, 'index.html'), htmlContent);
            console.log(`✓ Generated redirect page for deal: ${deal.dealHash}`);
        }
    }
    console.log('✅ All redirect pages generated');
}
async function ensureStaticDirectories() {
    const dirs = [
        path.join(__dirname, '..', 'public'),
        path.join(__dirname, '..', 'public', 'costco-deals'),
        path.join(__dirname, '..', 'public', 'images'),
        path.join(__dirname, '..', 'public', 'css'),
        path.join(__dirname, '..', 'public', 'data')
    ];

    for (const dir of dirs) {
        await ensureDirectoryExists(dir);
    }
}

// Copy static assets
async function copyStaticAssets() {
    const defaultImage = `
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#F8F9FA"/>
            <path d="M100 70C94.4772 70 90 74.4772 90 80V95H75C69.4772 95 65 99.4772 65 105C65 110.523 69.4772 115 75 115H90V130C90 135.523 94.4772 140 100 140C105.523 140 110 135.523 110 130V115H125C130.523 115 135 110.523 135 105C135 99.4772 130.523 95 125 95H110V80C110 74.4772 105.523 70 100 70Z" fill="#CED4DA"/>
            <text x="50%" y="170" text-anchor="middle" font-family="system-ui" font-size="14" fill="#6C757D">No Image Available</text>
        </svg>
    `;

    const placeholderPath = path.join(__dirname, '..', 'public', 'images', 'placeholder.svg');
    await fs.writeFile(placeholderPath, defaultImage.trim());
    console.log('✓ Created placeholder image');
}

async function copyCssFiles() {
    const cssDir = path.join(__dirname, '..', 'public', 'css');
    await ensureDirectoryExists(cssDir);

// Copy header-improvements.css
const headerCssContent = `
:root {
    --primary-color: #0A4D68;
    --primary-hover: #234876;
    --secondary-color: #D0021B;
    --secondary-gradient: linear-gradient(135deg, #D0021B, #B7021B);
    --background-color: #f8f9fa;
    --text-color: #1A1A1A;
    --text-muted: #4A5568;
    --border-color: #E2E8F0;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.08);
    --shadow-hover: 0 8px 12px rgba(0,0,0,0.1);
}

.deals-navbar {
    background: var(--primary-color);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.deals-logo {
    height: 40px;
}

.deals-logo-image {
    height: 100%;
    width: auto;
}

.cta-button-deals {
    background-color: var(--sage-green); /* Customize if needed */
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1rem;
    transition: transform 0.3s ease;
    white-space: nowrap;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.warehouse-header {
    background: white;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(8px);
    background-color: rgba(255, 255, 255, 0.95);
}

.warehouse-selector {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.current-warehouse {
    display: flex;
    align-items: center;
    gap: 12px;
}

.warehouse-info {
    display: flex;
    flex-direction: column;
}

.warehouse-label {
    font-size: 0.9em;
    color: var(--text-muted);
    font-weight: 500;
}

.warehouse-address {
    font-size: 1.1em;
    color: var(--text-color);
    font-weight: 600;
}

.change-warehouse {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.change-warehouse:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
}

@media (max-width: 768px) {
    .warehouse-selector {
        padding: 12px 16px;
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
}

/* Warehouse modal styles */
.warehouse-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.warehouse-modal-content {
    background-color: white;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.warehouse-modal h2 {
    font-size: 1.5rem;
    margin: 0 0 16px 0;
    color: var(--primary-color);
}

.warehouse-modal .search-container {
    margin-bottom: 16px;
}

.warehouse-modal #searchInput {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    margin-bottom: 8px;
}

.warehouse-modal #warehouseList {
    overflow-y: auto;
    max-height: 50vh;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
}

.warehouse-modal .warehouse-item {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s;
}

.warehouse-modal .warehouse-item:hover {
    background-color: #f5f7fa;
}

.warehouse-modal .close-modal {
    margin-top: 20px;
    padding: 12px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s;
}

.warehouse-modal .close-modal:hover {
    background-color: var(--primary-hover);
}

@media (max-width: 768px) {
    .warehouse-modal-content {
        width: 95%;
        max-height: 90vh;
        padding: 16px;
    }
    
    .warehouse-modal #warehouseList {
        max-height: 60vh;
    }
}

/* Style the search container */
.search-container {
    display: flex;
    align-items: center;
    gap: 8px; /* Consistent spacing between elements */
}

/* Style the search input */
#searchInput {
    padding: 10px 16px; /* Matches .change-warehouse padding */
    border: 1px solid var(--border-color);
    border-radius: 8px; /* Matches existing rounded buttons */
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 0.9em;
    font-weight: 500;
    color: var(--text-color);
    background-color: white;
    outline: none;
    transition: border-color 0.2s ease;
}

#searchInput:focus {
    border-color: var(--primary-color); /* Highlights on focus */
}

/* Style the clear button */
#clearSearch {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: white;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
}

#clearSearch:hover {
    background: var(--primary-hover);
}

/* Ensure responsiveness */
@media (max-width: 768px) {
    .warehouse-selector {
        flex-direction: column;
        align-items: stretch;
    }
    .search-container {
        width: 100%;
        margin: 12px 0;
    }
    #searchInput, #clearSearch {
        width: 100%;
    }
}
`;

    await fs.writeFile(path.join(cssDir, 'header-improvements.css'), headerCssContent.trim());
    console.log('✓ Generated header-improvements.css');
}

async function build() {
    try {
        console.log('🏗️ Starting build process...');
        
        // Register Handlebars partials
        await registerPartials();
        
        // Ensure static directories exist
        await ensureStaticDirectories();
        
        // Copy static assets
        await copyStaticAssets();
        
        // Copy CSS files
        await copyCssFiles();
        
        // Load templates
        const dealTemplate = await loadTemplate('deal');
        const indexTemplate = await loadTemplate('index');
        const warehouseTemplate = await loadTemplate('warehouse');
        
        // Fetch data
        const { warehouses } = await fetchData();
        
        // Generate warehouse data JSON file
        await generateWarehouseData(warehouses);
        
        // Generate pages
        await generateDealPages(warehouses, dealTemplate);
        await generateWarehousePages(warehouses, warehouseTemplate);
        await generateIndexPage(warehouses, indexTemplate);
        // Generate redirect pages (add this line)
        await generateRedirectPages(warehouses);
        
        console.log('✅ Build completed successfully!');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Add cache clear command
if (process.argv.includes('--clear-cache')) {
    cache.clear().then(() => {
        console.log('🧹 Cache cleared successfully');
        process.exit(0);
    });
} else {
    // Run build
    build();
} 