if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    'ios-blue': '#007AFF',
                    'ios-gray': '#8E8E93',
                    'ios-gray-2': '#AEAEB2',
                    'ios-gray-3': '#C7C7CC',
                    'ios-gray-4': '#D1D1D6',
                    'ios-gray-5': '#E5E5EA',
                    'ios-gray-6': '#F2F2F7',
                    'ios-dark-1': '#000000',
                    'ios-dark-2': '#1C1C1E',
                    'ios-dark-3': '#2C2C2E',
                    'ios-dark-4': '#3A3A3C',
                    'ios-dark-5': '#48484A',
                    'ios-dark-6': '#636366'
                }
            }
        }
    };
}


// Application configuration constants
const VOTE_TYPES = {
    GOOD: 'good',
    NEUTRAL: 'neutral',
    BAD: 'bad'
};

const VOTE_EMOJIS = {
    [VOTE_TYPES.GOOD]: '🤩',
    [VOTE_TYPES.NEUTRAL]: '😐',
    [VOTE_TYPES.BAD]: '🤮'
};

// Server-side voting configuration
const VOTING_CONFIG = {
    // REST-compliant API endpoints
    apiUrl: '/api/votes', // REST endpoint for votes
    enabled: true, // Can be disabled to fall back to localStorage only
    timeout: 5000 // 5 second timeout for API calls
};

// Image upload configuration
const IMAGE_CONFIG = {
    apiUrl: '/api/images', // REST endpoint for images
    enabled: true, // Can be disabled to hide image features
    maxSize: 15 * 1024 * 1024, // 15MB max file size
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    timeout: 10000 // 10 second timeout for uploads
};

// Cloudflare Turnstile configuration
const TURNSTILE_CONFIG = {
    siteKey: '', // Set via environment or configuration
    enabled: false, // Will be set to true when siteKey is provided
    theme: 'light', // 'light', 'dark', or 'auto'
    size: 'normal', // 'normal', 'compact'
    timeout: 30000 // 30 second timeout for token
};