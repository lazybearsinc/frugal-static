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

// CSS for ad containers and fallbacks
const adStyles = `
    .ad-unit-container {
        position: relative;
        transition: opacity 0.3s ease;
        margin: 1.5rem 0;
        width: 100%;
        text-align: center;
        background: #f9f9f9;
        padding: 1rem;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .ad-unit-container[data-ad-status="unfilled"] {
        display: none;
    }
    
    .ad-unit-container[data-ad-status="filled"] {
        display: block;
    }
    
    .ad-fallback {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border: 1px dashed #ddd;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .ad-unit-container[data-ad-status="unfilled"] .ad-fallback {
        opacity: 1;
    }
    
    .ad-fallback-message {
        color: #666;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Deal Card Ad Placement Rules */
    .deal-card-ad {
        grid-column: 1 / -1;
        display: none;
        margin: 2rem 0;
    }

    @media (min-width: 769px) {
        .deals-grid .deal-card-ad:nth-of-type(7n) {
            display: block;
        }
    }

    @media (max-width: 768px) {
        .deals-grid .deal-card-ad:nth-of-type(4n) {
            display: block;
            margin: 1rem 0;
        }
    }

    /* Deal List Top Ad */
    .deal-list-top-ad {
        max-width: 970px;
        margin: 2rem auto;
    }

    @media (max-width: 1024px) {
        .deal-list-top-ad {
            max-width: 728px;
        }
    }

    @media (max-width: 768px) {
        .deal-list-top-ad {
            max-width: 320px;
        }
    }

    /* Deal Detail Bottom Ad */
    .deal-detail-bottom-ad {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: white;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .deal-detail-bottom-ad.hidden {
        transform: translateY(100%);
    }

    /* Deal Detail In-Article Ad */
    .deal-detail-ad {
        margin: 2rem 0;
        display: flex;
        justify-content: center;
    }
`;

// Add styles to document
function injectAdStyles() {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = adStyles;
    document.head.appendChild(styleSheet);
}

// Get device type based on window width
function getDeviceType() {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

// Monitor ad status changes
function monitorAdStatus(container, adElement) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-ad-status') {
                const status = adElement.getAttribute('data-ad-status');
                container.setAttribute('data-ad-status', status || 'unfilled');
                
                if (status === 'unfilled') {
                    console.log('Ad unfilled:', container.className);
                }
            }
        });
    });
    
    observer.observe(adElement, {
        attributes: true,
        attributeFilter: ['data-ad-status']
    });
    
    // Fallback check in case the ad doesn't load
    setTimeout(() => {
        const status = adElement.getAttribute('data-ad-status');
        if (!status || status === 'unfilled') {
            container.setAttribute('data-ad-status', 'unfilled');
        }
    }, 3000);
}

// Initialize AdSense
window.addEventListener('load', function() {
    window.adsbygoogle = window.adsbygoogle || [];
    injectAdStyles();
    
    // Initialize all visible ad units
    document.querySelectorAll('.ad-unit-container:not([style*="display: none"])').forEach(container => {
        const adElement = container.querySelector('.adsbygoogle');
        if (adElement && !loadedAds.has(adElement)) {
            lazyLoadAd(adElement);
        }
    });
});

// Track loaded ad slots
const loadedAds = new WeakSet();

// Ensure container has proper dimensions before loading ad
function ensureContainerDimensions(container, type) {
    // Only set width constraints for bottom ad
    if (type === 'dealDetailBottom') {
        const deviceType = getDeviceType();
        const sizes = ADSENSE_CONFIG.sizes[type][deviceType];
        container.style.minWidth = sizes.width + 'px';
    }
    
    // Force layout recalculation
    container.offsetHeight;
    
    return container.offsetWidth > 0;
}

// Lazy loading utility for ads with error handling and retries
function lazyLoadAd(element, maxRetries = 3) {
    if (!element || !element.parentElement || loadedAds.has(element)) {
        return;
    }
    
    let retryCount = 0;
    
    function tryLoadAd() {
        if (!element || !element.parentElement || loadedAds.has(element)) {
            return;
        }
        
        const container = element.closest('.ad-unit-container');
        const type = Object.keys(ADSENSE_CONFIG.slots).find(key => 
            container.classList.contains(`${key}-ad`));
            
        if (!type) return;
        
        monitorAdStatus(container, element);
        
        if (!ensureContainerDimensions(container, type)) {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryLoadAd, 1000);
                return;
            }
            console.error('Failed to establish proper container dimensions');
            container.setAttribute('data-ad-status', 'unfilled');
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
            container.setAttribute('data-ad-status', 'unfilled');
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
        tryLoadAd();
    }
}

// Create responsive ad unit with proper sizing
function createAdUnit(type, container) {
    const adContainer = container || document.createElement('div');
    adContainer.className = `ad-unit-container ${type}-ad`;
    adContainer.setAttribute('data-ad-status', 'unfilled');
    
    // Skip if container already has a loaded ad
    const existingAd = adContainer.querySelector('.adsbygoogle[data-ad-loaded="true"]');
    if (existingAd && loadedAds.has(existingAd)) {
        return adContainer;
    }
    
    // Only set fixed dimensions for bottom ad
    if (type === 'dealDetailBottom') {
        const deviceType = getDeviceType();
        const sizes = ADSENSE_CONFIG.sizes[type][deviceType];
        adContainer.style.minWidth = sizes.width + 'px';
    }
    
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.setAttribute('data-ad-client', ADSENSE_CONFIG.clientId);
    ins.setAttribute('data-ad-slot', ADSENSE_CONFIG.slots[type]);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    
    // Create fallback content
    const fallback = document.createElement('div');
    fallback.className = 'ad-fallback';
    const fallbackMessage = document.createElement('div');
    fallbackMessage.className = 'ad-fallback-message';
    fallbackMessage.textContent = 'Advertisement';
    fallback.appendChild(fallbackMessage);
    
    // Clear existing content and add new elements
    adContainer.innerHTML = '';
    adContainer.appendChild(ins);
    adContainer.appendChild(fallback);
    
    // Force layout recalculation
    adContainer.offsetHeight;
    
    return adContainer;
}

// Handle window resize events with state tracking
let isResizing = false;
window.addEventListener('resize', debounce(() => {
    if (isResizing) return;
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