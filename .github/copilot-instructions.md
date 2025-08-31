# Eatinator - PWA Menu Application

Eatinator is a Progressive Web App (PWA) that displays daily lunch menus from the Eurest restaurant at Kaserne Bern. It scrapes menu data from unofficial APIs and falls back to HTML parsing when APIs are unavailable.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Run the Application
- Start local development server:
  - `cd /home/runner/work/eatinator/eatinator`
  - `python3 -m http.server 8000` -- starts in ~3 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- Access application at `http://localhost:8000/`
- Access demo (image upload) at `http://localhost:8000/demo.html`

### Application Architecture
- **No Build System Required**: Static HTML/JS/CSS files served directly
- **Tailwind CSS**: Uses CDN with local fallback (`styles/tailwind-fallback.css`) for testing
- **Main Application**: `index.html` (115 lines) - clean HTML structure with modular JS
- **Demo Application**: `demo.html` (30 lines) - image upload feature demonstration
- **Modular JavaScript**: Organized into focused modules in `/js/` directory
- **PWA Configuration**: `manifest.json` and comprehensive icon set in `/icons/`
- **Optional APIs**: PHP scripts in `/api/` for voting and image upload features

### File Structure Overview
```
.
├── index.html          # Main Eatinator application (115 lines)
├── demo.html           # Image upload demo (30 lines)
├── manifest.json       # PWA configuration
├── README.md           # Main project documentation
├── DOCS.md             # Detailed technical documentation
├── styles/
│   ├── main.css        # Custom application styles
│   └── tailwind-fallback.css  # Local Tailwind fallback for testing
├── js/                 # Modular JavaScript architecture
│   ├── app.js          # Application initialization
│   ├── config.js       # Configuration and Tailwind setup
│   ├── state.js        # Application state management
│   ├── menu.js         # Menu data fetching and display
│   ├── navigation.js   # Week/day navigation
│   ├── voting.js       # Voting system functionality
│   ├── images.js       # Image upload and display
│   └── demo.js         # Demo-specific functionality
├── icons/              # PWA icons (21 different sizes)
│   ├── favicon.ico
│   ├── favicon-*.png   # Multiple sizes for different devices
│   └── browserconfig.xml
└── api/                # Optional server-side features
    ├── README.md       # Server setup instructions
    ├── IMAGE_SETUP.md  # Image feature setup
    ├── votes.php       # Voting API
    ├── images.php      # Image upload API
    └── .gitignore      # Excludes runtime data files
```

## Validation

### CRITICAL: Always Test These Scenarios After Making Changes
1. **Basic Application Loading**:
   - Start server: `python3 -m http.server 8000`
   - Open `http://localhost:8000/` in browser
   - Verify: "Eurest Menu" title displays, week navigation works, day buttons are clickable
   - Expected: Application shows current week with Mon-Fri buttons

2. **Demo Functionality**:
   - Open `http://localhost:8000/demo.html`
   - Verify: Three food items display with "Add Photo" and "View Photos" buttons
   - Expected: Dark-themed interface with sample menu items

3. **PWA Configuration**:
   - Check `manifest.json` is valid JSON: `curl -s http://localhost:8000/manifest.json | jq .`
   - Verify icons exist: `ls icons/favicon-*.png | wc -l` should return >10
   - **Note**: HTML references `/icons/manifest.json` but file is at `/manifest.json` (404 in console is expected)

4. **External Dependencies**:
   - **Note**: Tailwind CSS loads from CDN - may fail in sandboxed environments
   - **Note**: External menu API (clients.eurest.ch) typically blocked in development
   - **Expected**: Application shows "No menu available" when API is blocked (this is normal)
   - **Expected**: Console shows 404 for `/icons/manifest.json` (manifest is actually at root)

### Manual Testing Requirements
- **ALWAYS** test both main application (`index.html`) and demo (`demo.html`) after changes
- **ALWAYS** verify the PWA installation prompts work (if browser supports)
- **ALWAYS** test responsive design by resizing browser window
- Check browser console for JavaScript errors (some CDN blocking is expected)

## Common Tasks

### Frequently Referenced Files
- **Primary Application Logic**: Modularized in `/js/` directory
- **Main Entry Point**: `index.html` (115 lines, clean HTML structure)
- **Demo Page**: `demo.html` (30 lines, image upload demonstration)
- **Styling**: Tailwind CSS classes + custom CSS in `styles/main.css`
- **Local Testing**: `styles/tailwind-fallback.css` for blocked CDN scenarios
- **Configuration**: `manifest.json` for PWA settings, `js/config.js` for app settings
- **Documentation**: `README.md` (user-facing), `DOCS.md` (technical details)

### Making Code Changes
- **Frontend Changes**: Edit modular files in `/js/` directory or HTML files directly
- **Styling**: Modify `styles/main.css` or Tailwind classes in HTML
- **PWA Settings**: Modify `manifest.json`
- **Icons**: Add/modify files in `icons/` directory
- **Server Features**: Edit PHP files in `api/` directory (requires PHP server)
- **Configuration**: Update `js/config.js` for feature toggles and API endpoints

### Testing Changes
- Restart server after file changes: Stop current server, run `python3 -m http.server 8000`
- **No Build Process**: Changes are immediately visible on page refresh
- **No Linting**: No automated linting configured (static HTML/JS files)
- **No Tests**: No automated test suite exists

## Development Environment

### Requirements
- **Python 3**: For local HTTP server (`python3 -m http.server`)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with PWA support
- **Optional**: PHP 7.4+ for server-side features (voting, image upload)

### External Dependencies
- **Tailwind CSS**: Loaded from `https://cdn.tailwindcss.com`
- **Eurest API**: `https://clients.eurest.ch/api/Menu/*` (unofficial, may be blocked)
- **Fallback**: HTML scraping of restaurant website when API fails

### Known Limitations in Development
- **CDN Blocking**: Tailwind CSS may be blocked in sandboxed environments
- **API Blocking**: External menu API typically blocked in development
- **CORS Issues**: Some features require same-origin requests
- **PHP Features**: Voting and image upload require PHP server setup

## Troubleshooting

### Common Issues and Solutions
1. **"tailwind is not defined" Error**:
   - Caused by blocked CDN access
   - Expected in sandboxed environments
   - Application still functions with basic styling
   - For testing: Use local fallback by adding `<link rel="stylesheet" href="styles/tailwind-fallback.css">` in HTML

2. **"No menu available" Message**:
   - External API blocked or unavailable
   - This is normal behavior in development
   - Application correctly shows fallback message

3. **PWA Installation Not Working**:
   - Ensure serving over HTTP/HTTPS (not file://)
   - Check all required icons exist in `/icons/`
   - Verify `manifest.json` is valid
   - **Note**: HTML references `/icons/manifest.json` but file is at root `/manifest.json`

4. **404 Error for `/icons/manifest.json`**:
   - This is expected - manifest.json is in root directory, not icons/
   - Application will still function, PWA features may be limited
   - To fix: Move manifest.json to icons/ or update HTML reference

5. **Server Won't Start**:
   - Check port 8000 availability: `lsof -i :8000`
   - Try different port: `python3 -m http.server 8001`
   - Ensure running from correct directory

### Performance Expectations
- **Server Start**: ~3 seconds
- **Page Load**: <2 seconds (with CDN)
- **Page Load**: 5-10 seconds (with CDN blocked, shows basic layout)
- **No Build Time**: Static files, no compilation needed

### File Modification Impact
- **HTML Changes**: Immediate (refresh browser)
- **Icon Changes**: May require cache clear/hard refresh
- **Manifest Changes**: May require browser restart for PWA updates

## Server-Side Features (Optional)

### PHP API Setup
- **Requirements**: PHP 7.4+, nginx or Apache
- **Setup Instructions**: See `api/README.md` for Docker setup
- **Voting System**: Stores votes in JSON files (`api/votes_data/`)
- **Image Upload**: 24-hour retention, stored in `api/images_data/`
- **Security**: Multiple validation layers for file uploads

### Testing APIs (if PHP available)
```bash
# Test voting API
curl "http://localhost/api/votes.php?action=get&key=test_vote"

# Test image cleanup
curl "http://localhost/api/images.php"
```

## Architecture Notes

### Application Type
- **Static PWA**: No server-side rendering, no build process
- **Client-Side Only**: All logic runs in browser
- **Progressive Enhancement**: Core functionality works without server APIs

### Data Flow
1. **Menu Fetching**: Try API → Fallback to HTML scraping → Display results
2. **Voting**: Try server API → Fallback to localStorage
3. **Images**: Server-only feature (requires PHP)

### Browser Compatibility
- **Modern Browsers**: Full PWA functionality
- **Legacy Browsers**: Basic functionality, no PWA features
- **Mobile**: Optimized for mobile devices, installable as app

---

**Remember**: This is a zero-dependency static web application. Most development tasks involve editing HTML/JavaScript directly in the main files. Always test both the main application and demo after changes, and expect some features to be limited in sandboxed development environments.