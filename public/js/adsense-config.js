// AdSense Configuration
const ADSENSE_CONFIG = {
    clientId: 'ca-pub-7930233358759132',
    slots: {
        dealListTop: '5922562475',
        dealCard: '2522373517',
        dealDetailInArticle: '9744319615',
        dealDetailBottom: '8431236946'
    },
    sizes: {
        dealListTop: {
            desktop: { width: 970, height: 250 },
            tablet: { width: 728, height: 90 },
            mobile: { width: 320, height: 100 }
        },
        dealCard: {
            desktop: { width: 336, height: 280 },
            tablet: { width: 336, height: 280 },
            mobile: { width: 300, height: 250 }
        },
        dealDetailInArticle: {
            desktop: { width: 728, height: 280 },
            tablet: { width: 468, height: 280 },
            mobile: { width: 300, height: 250 }
        },
        dealDetailBottom: {
            desktop: { width: 728, height: 90 },
            tablet: { width: 468, height: 60 },
            mobile: { width: 320, height: 50 }
        }
    }
};

// Get device type based on window width
function getDeviceType() {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

// Initialize AdSense
window.addEventListener('load', function() {
    window.adsbygoogle = window.adsbygoogle || [];
});

// Track loaded ad slots
const loadedAds = new WeakSet();

// Ensure container has proper dimensions before loading ad
function ensureContainerDimensions(container, type) {
    const deviceType = getDeviceType();
    const sizes = ADSENSE_CONFIG.sizes[type][deviceType];
    
    // Set minimum dimensions based on ad size
    container.style.minWidth = sizes.width + 'px';
    container.style.minHeight = sizes.height + 'px';
    
    // Ensure the container is visible and has layout
    container.style.display = 'block';
    container.style.overflow = 'hidden';
    
    // Force layout recalculation
    container.offsetHeight;
    
    return container.offsetWidth > 0 && container.offsetHeight > 0;
}

// Lazy loading utility for ads with error handling and retries
function lazyLoadAd(element, maxRetries = 3) {
    if (!element || !element.parentElement || loadedAds.has(element)) {
        return; // Skip if already loaded or invalid
    }
    
    let retryCount = 0;
    
    function tryLoadAd() {
        if (!element || !element.parentElement || loadedAds.has(element)) {
            return; // Double-check in case conditions changed
        }
        
        const container = element.closest('.ad-unit-container');
        const type = Object.keys(ADSENSE_CONFIG.slots).find(key => 
            container.classList.contains(`${key}-ad`));
            
        if (!type) return;
        
        // Ensure container has proper dimensions
        if (!ensureContainerDimensions(container, type)) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryLoadAd, 1000); // Retry after 1 second
                return;
            }
            console.error('Failed to establish proper container dimensions');
            return;
        }
        
        try {
            if (!element.getAttribute('data-ad-loaded')) {
                (adsbygoogle = window.adsbygoogle || []).push({});
                element.setAttribute('data-ad-loaded', 'true');
                loadedAds.add(element);
            }
        } catch (e) {
            console.error('Error loading ad:', e);
            if (retryCount < maxRetries && !loadedAds.has(element)) {
                retryCount++;
                setTimeout(tryLoadAd, 1000);
            }
        }
    }
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !loadedAds.has(element)) {
                    tryLoadAd();
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });
        
        observer.observe(element);
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        tryLoadAd();
    }
}

// Create responsive ad unit with proper sizing
function createAdUnit(type, container) {
    const deviceType = getDeviceType();
    const sizes = ADSENSE_CONFIG.sizes[type][deviceType];
    
    const adContainer = container || document.createElement('div');
    adContainer.className = `ad-unit-container ${type}-ad`;
    
    // Skip if container already has a loaded ad
    const existingAd = adContainer.querySelector('.adsbygoogle[data-ad-loaded="true"]');
    if (existingAd && loadedAds.has(existingAd)) {
        return adContainer;
    }
    
    // Set container styles to ensure proper dimensions
    adContainer.style.minWidth = sizes.width + 'px';
    adContainer.style.minHeight = sizes.height + 'px';
    adContainer.style.display = 'block';
    adContainer.style.overflow = 'hidden';
    
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.style.height = '100%';
    ins.setAttribute('data-ad-client', ADSENSE_CONFIG.clientId);
    ins.setAttribute('data-ad-slot', ADSENSE_CONFIG.slots[type]);
    
    // Set specific configurations based on ad type
    if (type === 'dealDetailBottom') {
        ins.style.width = sizes.width + 'px';
        ins.style.height = sizes.height + 'px';
        ins.style.display = 'inline-block';
    } else {
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
    }
    
    // Clear existing content
    adContainer.innerHTML = '';
    adContainer.appendChild(ins);
    
    // Force layout recalculation
    adContainer.offsetHeight;
    
    return adContainer;
}

// Handle window resize events with state tracking
let isResizing = false;
window.addEventListener('resize', debounce(() => {
    if (isResizing) return; // Prevent duplicate resize handling
    isResizing = true;
    
    try {
        const adContainers = document.querySelectorAll('.ad-unit-container');
        adContainers.forEach(container => {
            const type = Object.keys(ADSENSE_CONFIG.slots).find(key => 
                container.classList.contains(`${key}-ad`));
            if (type) {
                const existingAd = container.querySelector('.adsbygoogle');
                if (existingAd && loadedAds.has(existingAd)) {
                    // Only update dimensions for loaded ads
                    const deviceType = getDeviceType();
                    const sizes = ADSENSE_CONFIG.sizes[type][deviceType];
                    container.style.minWidth = sizes.width + 'px';
                    container.style.minHeight = sizes.height + 'px';
                } else {
                    // Create and load new ad if none exists
                    createAdUnit(type, container);
                    const newAd = container.querySelector('.adsbygoogle');
                    if (newAd && !loadedAds.has(newAd)) {
                        lazyLoadAd(newAd);
                    }
                }
            }
        });
    } finally {
        isResizing = false;
    }
}, 250));

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 