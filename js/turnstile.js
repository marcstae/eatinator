/**
 * Cloudflare Turnstile Integration for Eatinator
 * Handles Turnstile widget loading, token generation and verification
 */

let turnstileLoaded = false;
let turnstileWidgetId = null;
let currentTurnstileToken = null;

/**
 * Load Cloudflare Turnstile script
 */
function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
        if (turnstileLoaded) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            turnstileLoaded = true;
            console.log('Turnstile script loaded');
            resolve();
        };
        
        script.onerror = () => {
            console.error('Failed to load Turnstile script');
            reject(new Error('Failed to load Turnstile script'));
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Initialize Turnstile configuration
 */
function initTurnstile() {
    // Check if Turnstile should be enabled
    const siteKey = window.TURNSTILE_SITE_KEY || TURNSTILE_CONFIG.siteKey;
    if (!siteKey) {
        console.log('Turnstile disabled: No site key provided');
        return;
    }
    
    TURNSTILE_CONFIG.siteKey = siteKey;
    TURNSTILE_CONFIG.enabled = true;
    
    console.log('Turnstile enabled with site key:', siteKey.substring(0, 8) + '...');
}

/**
 * Render Turnstile widget
 */
async function renderTurnstileWidget(containerId, callback) {
    if (!TURNSTILE_CONFIG.enabled) {
        console.log('Turnstile widget skipped: Turnstile is disabled');
        callback && callback(null);
        return null;
    }
    
    try {
        await loadTurnstileScript();
        
        // Wait for turnstile to be available
        let attempts = 0;
        while (!window.turnstile && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.turnstile) {
            throw new Error('Turnstile not available after loading');
        }
        
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        
        // Clear existing widget
        container.innerHTML = '';
        
        turnstileWidgetId = window.turnstile.render(container, {
            sitekey: TURNSTILE_CONFIG.siteKey,
            theme: TURNSTILE_CONFIG.theme,
            size: TURNSTILE_CONFIG.size,
            callback: function(token) {
                currentTurnstileToken = token;
                console.log('Turnstile token received');
                callback && callback(token);
            },
            'error-callback': function() {
                console.error('Turnstile verification failed');
                currentTurnstileToken = null;
                callback && callback(null);
            },
            'expired-callback': function() {
                console.log('Turnstile token expired');
                currentTurnstileToken = null;
                callback && callback(null);
            }
        });
        
        return turnstileWidgetId;
    } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
        callback && callback(null);
        return null;
    }
}

/**
 * Get current Turnstile token
 */
function getTurnstileToken() {
    return currentTurnstileToken;
}

/**
 * Reset Turnstile widget
 */
function resetTurnstileWidget() {
    if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
        currentTurnstileToken = null;
    }
}

/**
 * Remove Turnstile widget
 */
function removeTurnstileWidget() {
    if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId);
        turnstileWidgetId = null;
        currentTurnstileToken = null;
    }
}

/**
 * Create a modal with Turnstile widget
 */
function createTurnstileModal(title, message, onToken) {
    return new Promise((resolve) => {
        const modalId = 'turnstile-modal-' + Math.random().toString(36).substr(2, 9);
        const widgetId = 'turnstile-widget-' + Math.random().toString(36).substr(2, 9);
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-ios-dark-2 rounded-lg p-6 max-w-sm mx-4 w-full">
                <h3 class="text-lg font-semibold mb-4 dark:text-white">${title}</h3>
                <p class="text-ios-gray dark:text-ios-gray-2 mb-4">${message}</p>
                <div id="${widgetId}" class="mb-4 flex justify-center"></div>
                <div class="flex space-x-2">
                    <button id="cancel-btn" class="flex-1 px-4 py-2 bg-ios-gray-5 dark:bg-ios-dark-4 rounded-lg text-ios-gray dark:text-ios-gray-2">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle cancel
        modal.querySelector('#cancel-btn').onclick = () => {
            removeTurnstileWidget();
            document.body.removeChild(modal);
            resolve(null);
        };
        
        // Handle background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                removeTurnstileWidget();
                document.body.removeChild(modal);
                resolve(null);
            }
        };
        
        // Render Turnstile widget
        renderTurnstileWidget(widgetId, (token) => {
            if (token) {
                onToken && onToken(token);
                removeTurnstileWidget();
                document.body.removeChild(modal);
                resolve(token);
            }
        });
    });
}

/**
 * Get Turnstile token with user interaction if needed
 */
async function getTurnstileTokenWithUI(title = 'Verify you are human', message = 'Please complete the verification below:') {
    if (!TURNSTILE_CONFIG.enabled) {
        return null;
    }
    
    // If we have a current token, return it
    if (currentTurnstileToken) {
        return currentTurnstileToken;
    }
    
    // Show modal with Turnstile widget
    return await createTurnstileModal(title, message);
}

// Initialize Turnstile on script load
document.addEventListener('DOMContentLoaded', initTurnstile);

// Also try to initialize immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading
} else {
    // DOM has already loaded
    initTurnstile();
}