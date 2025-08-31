# Eatinator Technical Documentation

This document provides detailed technical information for developers and system administrators.

## Architecture Overview

### Frontend Architecture (Static PWA)
- **No Build System Required**: Direct HTML/CSS/JavaScript files served statically
- **Tailwind CSS**: Loaded from CDN with local fallback for testing
- **Modular JavaScript**: Organized into focused modules for maintainability
- **Progressive Enhancement**: Core functionality works without server APIs

### Backend Architecture (Optional)
- **PHP APIs**: Lightweight voting and image upload endpoints
- **Docker Containerization**: nginx + PHP-FPM setup
- **File-based Storage**: JSON files for votes, filesystem for images
- **24-hour Retention**: Automatic cleanup for uploaded images

## File Structure

```
.
├── index.html              # Main application entry point
├── demo.html               # Image upload feature demo
├── manifest.json           # PWA configuration
├── README.md              # User-facing documentation
├── styles/
│   ├── main.css           # Custom application styles
│   └── tailwind-fallback.css  # Local Tailwind fallback for testing
├── js/                    # Modular JavaScript architecture
│   ├── app.js             # Application initialization
│   ├── config.js          # Configuration and Tailwind setup
│   ├── state.js           # Application state management
│   ├── menu.js            # Menu data fetching and display
│   ├── navigation.js      # Week/day navigation
│   ├── voting.js          # Voting system functionality
│   ├── images.js          # Image upload and display
│   └── demo.js            # Demo-specific functionality
├── icons/                 # PWA icons (21 different sizes)
├── api/                   # Server-side features (optional)
│   ├── README.md          # API setup instructions
│   ├── IMAGE_SETUP.md     # Image feature configuration
│   ├── votes.php          # Voting API endpoint
│   └── images.php         # Image upload API endpoint
├── install-eatinator.sh   # Automated Docker installation
└── uninstall-eatinator.sh # Automated cleanup script
```

## Module Dependencies

### JavaScript Module Loading Order
1. `config.js` - Configuration constants and Tailwind setup
2. `state.js` - Application state variables
3. Feature modules (`voting.js`, `images.js`, `navigation.js`, `menu.js`)
4. `app.js` - Application initialization

### Key Modules

#### `config.js`
- Tailwind CSS configuration
- Application constants (VOTE_TYPES, VOTE_EMOJIS)
- API endpoint configuration
- Feature flags (voting/image upload enable/disable)

#### `state.js`
- Global state variables (currentDate, currentWeek, etc.)
- Default category detection based on time of day
- Shared state management utilities

#### `menu.js`
- External API integration (Eurest API)
- HTML scraping fallback when API unavailable
- Menu item filtering and categorization
- Menu display and rendering logic

#### `voting.js`
- Server-side and localStorage voting support
- User vote tracking and duplicate prevention
- Vote aggregation and display
- Voting UI generation

#### `images.js`
- Image upload with validation
- Image gallery display
- Modal image viewing
- File type and size validation

## API Endpoints

### Voting API (`/api/votes.php`)

#### Get Votes
```bash
GET /api/votes.php?action=get&key={vote_key}
```

Response:
```json
{
  "success": true,
  "votes": {
    "good": 5,
    "neutral": 2, 
    "bad": 1
  }
}
```

#### Cast Vote
```bash
POST /api/votes.php
Content-Type: application/json

{
  "action": "vote",
  "key": "vote_key",
  "voteType": "good|neutral|bad", 
  "userId": "user_identifier"
}
```

### Image API (`/api/images.php`)

#### Get Images
```bash
GET /api/images.php?key={dish_key}
```

#### Upload Image
```bash
POST /api/images.php
Content-Type: multipart/form-data

key: dish_key
image: [file]
```

#### View Image
```bash
GET /api/images.php?action=view&key={dish_key}&file={filename}
```

## Security Features

### Frontend Security
- Input validation and sanitization
- HTTPS ready configuration
- Content Security Policy compatible

### Backend Security (API)
- File upload validation (MIME type, size, content)
- Script execution prevention in upload directories
- Secure filename generation
- Automatic cleanup of temporary data
- Rate limiting through server configuration

## Development Workflow

### Local Development
```bash
# Start development server
python3 -m http.server 8000

# Access application
open http://localhost:8000
```

### Testing Checklist
1. **Basic Loading**: App loads with current week display
2. **Navigation**: Week/day navigation and date picker work
3. **Menu Display**: Menu items render with proper categories
4. **Voting**: Vote submission and aggregation (if API available)
5. **Images**: Photo upload and gallery viewing (if API available)
6. **PWA**: Installation prompts and offline behavior
7. **Responsive**: Mobile and desktop layouts

### Docker Production Deployment
```bash
# Automated installation (recommended)
./install-eatinator.sh

# Manual setup (see api/README.md)
docker network create lunchinet
docker run -d --name lunchinator-php ...
```

## Configuration Options

### Frontend Configuration (`js/config.js`)
```javascript
// Voting system
const VOTING_CONFIG = {
    apiUrl: '/api/votes.php',
    enabled: true,    // Set false to disable voting
    timeout: 5000
};

// Image upload
const IMAGE_CONFIG = {
    apiUrl: '/api/images.php', 
    enabled: true,    // Set false to hide image features
    maxSize: 5 * 1024 * 1024,  // 5MB limit
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    timeout: 10000
};
```

### Server Configuration
- **PHP Settings**: `api/php-local.ini` for upload limits
- **Nginx Settings**: Custom headers, HTTPS, caching rules
- **Docker**: Container networking and volume mounts

## Performance Considerations

### Frontend Optimization
- Static file serving (no build step required)
- CDN-based Tailwind CSS with local fallback
- Modular JavaScript for better caching
- Lazy loading of images in galleries
- Service worker for offline functionality

### Backend Optimization
- File-based storage (no database overhead)
- Automatic cleanup reduces storage usage
- nginx static file serving for images
- PHP-FPM for API processing efficiency

## Known Limitations

### Development Environment
- **CDN Dependencies**: Tailwind CSS may be blocked in sandboxes
- **External APIs**: Eurest menu API typically blocked in development
- **CORS Restrictions**: Some features require same-origin requests

### Production Considerations
- **File Storage**: Images stored in filesystem (consider cloud storage for scaling)
- **Vote Storage**: JSON files (consider database for high traffic)
- **SSL Certificate**: Manual setup required for HTTPS

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Full PWA support including installation
- **Firefox**: Full functionality, limited PWA features
- **Safari (iOS)**: Full PWA support with native installation
- **Safari (macOS)**: Basic functionality, limited PWA support

### Required Features
- ES6+ JavaScript support
- CSS Grid and Flexbox
- Service Worker support (for PWA features)
- File API (for image uploads)

## Monitoring and Maintenance

### Log Files
- **Container Logs**: `docker logs lunchinator-php`
- **Nginx Logs**: Access and error logs in container
- **PHP Logs**: Application errors and warnings

### Maintenance Tasks
- **Image Cleanup**: Automated via cron job (24-hour retention)
- **Vote Data**: Manual cleanup if storage grows large
- **Container Updates**: Regular security updates recommended

### Health Checks
```bash
# Basic functionality
curl http://localhost/

# API availability  
curl "http://localhost/api/votes.php?action=get&key=test"

# Container status
docker ps | grep lunchinator
```