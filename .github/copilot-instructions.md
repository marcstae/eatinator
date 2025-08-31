# Eatinator - PWA Menu Application

Eatinator is a Progressive Web App (PWA) that displays daily lunch menus from the Eurest restaurant at Kaserne Bern. It features a modern FastAPI backend with SQLite database and a static frontend with modular JavaScript architecture.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Run the Application

**Option 1: Docker Compose (Recommended)**
- Start complete environment: `cd /home/runner/work/eatinator/eatinator && docker compose up -d`
- Access application at `http://localhost:8000/`
- Access backend API at `http://localhost:5694/`
- Health check: `http://localhost:5694/health`

**Option 2: Development Mode**
- Start dev environment: `cd /home/runner/work/eatinator/eatinator && ./start_dev.sh`
- Access application at `http://localhost:8000/`
- Backend on port 5694 with auto-reload

**Option 3: Static Only (for frontend testing)**
- Start simple server: `cd /home/runner/work/eatinator/eatinator && python3 -m http.server 8000`
- Access application at `http://localhost:8000/`
- Note: Backend features (voting, images) will be disabled

### Application Architecture

- **Modern Stack**: FastAPI backend + Static frontend with zero build dependencies
- **Database**: SQLite for persistence (replaces old JSON file storage)
- **Styling**: Tailwind CSS from CDN with comprehensive fallback system
- **Main Application**: `index.html` - core menu display functionality
- **Demo Application**: `demo.html` - image upload feature demonstration
- **PWA Configuration**: `manifest.json` and comprehensive icon set in `/icons/`
- **Backend APIs**: FastAPI application in `/api/` for voting and image upload

### File Structure Overview
```
.
├── index.html          # Main Eatinator application
├── demo.html           # Image upload demo
├── manifest.json       # PWA configuration  
├── README.md           # Main documentation
├── DOCS.md             # Detailed setup/development guide
├── docker-compose.yml  # Complete environment setup
├── start_dev.sh        # Development startup script
├── proxy_server.py     # Development proxy server
├── js/                 # JavaScript modules (modular architecture)
│   ├── app.js          # Application initialization
│   ├── config.js       # Configuration & Tailwind setup
│   ├── state.js        # Application state management
│   ├── menu.js         # Menu fetching & display
│   ├── voting.js       # Voting system functionality
│   ├── images.js       # Image upload & display
│   ├── navigation.js   # Week/day navigation
│   └── demo.js         # Demo page functionality
├── styles/
│   └── main.css        # Custom CSS styles
├── icons/              # PWA icons (21 different sizes)
│   ├── favicon.ico
│   ├── favicon-*.png   # Multiple sizes for different devices
│   └── browserconfig.xml
└── api/                # FastAPI backend
    ├── main.py         # FastAPI application
    ├── Dockerfile      # Backend container
    ├── requirements.txt # Python dependencies
    ├── README_FASTAPI.md # Backend API documentation
    └── data/           # Runtime data (auto-created)
        ├── eatinator.db # SQLite database
        └── images/     # Uploaded images
```

## Validation

### CRITICAL: Always Test These Scenarios After Making Changes

1. **Docker Compose Setup** (Primary):
   - Start: `docker compose up -d`
   - Check: `docker compose ps` (both services should be running)
   - Test: Open `http://localhost:8000/` and verify app loads
   - Test: Open `http://localhost:8000/demo.html` and verify demo works
   - API: `curl http://localhost:5694/health` should return `{"status":"healthy"}`

2. **Development Mode**:
   - Start: `./start_dev.sh`
   - Verify: Backend logs show FastAPI startup on port 5694
   - Verify: Frontend proxy starts on port 8000
   - Test: Application shows current week with Mon-Fri buttons

3. **Frontend Functionality**:
   - **Basic Loading**: "Eurest Menu" title displays, week navigation works
   - **Demo**: Three sample food items with "Add Photo" and "View Photos" buttons
   - **Responsive**: Works on mobile and desktop screen sizes
   - **PWA**: Installation prompts appear in supporting browsers

4. **Backend Features** (if enabled):
   - **Voting**: Vote buttons work and persist across page reloads
   - **Images**: Photo upload and gallery viewing functions
   - **Database**: SQLite database created in `api/data/eatinator.db`

5. **Fallback Behavior**:
   - **CSS Fallback**: App still usable if Tailwind CDN fails (basic styles applied)
   - **API Fallback**: Voting uses localStorage if backend unavailable
   - **Menu Fallback**: Shows "No menu available" when external API blocked

### Expected Development Environment Behavior

- **External Menu API**: Typically blocked in development (shows "No menu available" - this is normal)
- **Tailwind CSS**: May load from CDN or use fallback (both scenarios should work)
- **Console Warnings**: Some 404s for external resources are expected in development
- **Docker Networking**: Containers communicate via internal Docker network

## Common Tasks

### Frequently Referenced Files

- **Frontend Logic**: Distributed across `/js/` modules for maintainability
- **Styling**: Tailwind CSS classes + custom CSS in `styles/main.css`
- **Configuration**: `docker-compose.yml` for environment, `js/config.js` for app settings
- **Documentation**: `README.md` (overview), `DOCS.md` (detailed), `api/README_FASTAPI.md` (API)

### Making Code Changes

- **Frontend Changes**: Edit HTML/CSS/JS files directly, refresh browser
- **Backend Changes**: Edit `api/main.py`, restart container or use dev mode auto-reload
- **PWA Settings**: Modify `manifest.json`
- **Icons**: Add/modify files in `icons/` directory
- **Configuration**: Update `docker-compose.yml` or `js/config.js`

### Testing Changes

- **Docker**: `docker compose up --build` to rebuild after changes
- **Development**: Changes visible immediately (frontend) or auto-reload (backend)
- **No Build Process**: Direct file serving, changes are immediately available
- **No Automated Tests**: Manual testing required (see validation checklist above)

## Development Environment

### Requirements

- **Docker & Docker Compose**: Primary deployment method
- **Python 3.11+**: For local backend development
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with PWA support

### External Dependencies

- **Tailwind CSS**: Loaded from `https://cdn.tailwindcss.com` with local fallback
- **Eurest API**: `https://clients.eurest.ch/api/Menu/*` (unofficial, often blocked)
- **Fallback Behavior**: Application gracefully handles blocked external resources

### Technology Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework dependencies)
- **Backend**: FastAPI (Python) with SQLite database
- **Deployment**: Docker Compose with nginx + uvicorn
- **Development**: Local servers with proxy routing

## Troubleshooting

### Common Issues and Solutions

1. **Docker Compose Won't Start**:
   - Check Docker is running: `docker --version`
   - Clean rebuild: `docker compose down && docker compose up --build`
   - Check logs: `docker compose logs`

2. **"No menu available" Message**:
   - External API blocked or unavailable (normal in development)
   - Application correctly shows fallback message
   - Backend may still work for voting/images

3. **Styling Issues**:
   - Tailwind CDN blocked → Basic fallback styles automatically applied
   - Application remains functional with reduced visual polish
   - Check console for CSS loading errors

4. **Backend API Errors**:
   - Check health endpoint: `curl http://localhost:5694/health`
   - Verify container running: `docker compose ps`
   - Check logs: `docker compose logs api`

5. **PWA Installation Not Working**:
   - Ensure serving over HTTP/HTTPS (not file://)
   - Check all required icons exist in `/icons/`
   - Verify `manifest.json` is accessible at `/manifest.json`
   - Test in different browsers (PWA support varies)

### Performance Expectations

- **Docker Startup**: 30-60 seconds for initial build, 10-15 seconds for subsequent starts
- **Page Load**: 1-3 seconds (with CDN), 3-5 seconds (with fallback)
- **API Response**: <100ms for local SQLite queries
- **No Build Time**: Static files, no compilation needed

### File Modification Impact

- **Frontend Changes**: Immediate (refresh browser)
- **Backend Changes**: Requires container restart or dev mode auto-reload
- **Docker Config**: Requires `docker compose up --build`
- **Icon/Manifest Changes**: May require cache clear or browser restart

## Database and Storage

### SQLite Database

- **Location**: `api/data/eatinator.db` (auto-created)
- **Tables**: `votes`, `user_votes`, `images`
- **Backup**: Copy database file from `api/data/` directory
- **Reset**: Delete database file, restart backend (creates fresh DB)

### Image Storage

- **Location**: `api/data/images/` (auto-created)
- **Retention**: 24-hour automatic cleanup
- **Formats**: JPEG, PNG, WebP (validated with Pillow)
- **Size Limit**: 5MB per file

### Development Data

- **Persistence**: Data survives container restarts via Docker volumes
- **Reset**: `docker compose down -v` removes all data
- **Migration**: Database schema auto-created on startup

## API Endpoints (FastAPI Backend)

### Voting System
- `GET /api/votes.php?key=vote_key` - Get votes for item
- `POST /api/votes.php` - Cast vote with JSON payload

### Image Upload  
- `GET /api/images.php?key=image_key` - Get images for dish
- `POST /api/images.php` - Upload image (multipart/form-data)
- `GET /api/images.php?action=view&key=image_key&file=filename` - View image

### System
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)

## Architecture Notes

### Application Type
- **Progressive Web App**: Installable, offline-capable, responsive
- **Static Frontend**: No server-side rendering, client-side only
- **Modern Backend**: FastAPI with automatic validation and documentation

### Data Flow
1. **Menu Fetching**: External API → Fallback message if blocked
2. **Voting**: Frontend → FastAPI → SQLite → Response
3. **Images**: Upload → FastAPI validation → File storage → Database record

### Browser Compatibility
- **Modern Browsers**: Full PWA functionality with all features
- **Legacy Browsers**: Basic functionality, graceful feature degradation
- **Mobile Optimized**: iOS-style interface, touch-friendly interactions

### Development Workflow
- **Code Changes**: Direct file editing, no build step required
- **Testing**: Docker Compose for integration, simple HTTP server for frontend-only
- **Deployment**: Production-ready Docker Compose configuration included

---

**Remember**: This is a modern web application with FastAPI backend and modular frontend. Use Docker Compose as the primary development and deployment method. The application gracefully handles external dependencies being unavailable and provides comprehensive fallback behavior for reliable operation in various environments.