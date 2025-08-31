# Eatinator 🍽️

A Progressive Web App (PWA) that displays daily lunch menus from the Eurest restaurant at Kaserne Bern. Built as a modern web application with FastAPI backend and static frontend.

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/marcstae/eatinator.git
cd eatinator

# Start with Docker Compose
docker compose up -d

# Access the application
open http://localhost:8000
```

### Development Mode

```bash
# Start development server
./start_dev.sh

# Or manually:
cd api && python3 main.py &  # Backend on port 5694
python3 proxy_server.py     # Frontend proxy on port 8000
```

## ✨ Features

- **📱 PWA Support**: Install as mobile/desktop app with offline capabilities
- **📅 Weekly Menu Navigation**: Navigate through weeks with intuitive date picker
- **🗳️ Menu Voting**: Rate menu items (good/neutral/bad) with persistent storage
- **📸 Photo Upload**: Share photos of dishes with 24-hour retention
- **🌙 Modern UI**: Responsive design with iOS-style dark theme
- **⚡ Fast & Reliable**: Zero-dependency frontend with graceful degradation
- **🐳 Docker Ready**: Complete containerized setup with FastAPI backend

## 🏗️ Architecture

<details>
<summary><strong>Frontend (Static)</strong></summary>

- **Zero Dependencies**: No build system, direct HTML/CSS/JavaScript
- **Tailwind CSS**: CDN-loaded styling with local fallback
- **Modular Design**: Organized JavaScript modules for maintainability
- **Progressive Enhancement**: Works with or without backend APIs

**File Structure:**
```
├── index.html           # Main application
├── demo.html           # Image upload demo
├── js/                 # JavaScript modules
│   ├── app.js          # Application initialization
│   ├── config.js       # Configuration & Tailwind setup
│   ├── menu.js         # Menu fetching & display
│   ├── voting.js       # Voting functionality
│   ├── images.js       # Image upload & display
│   ├── navigation.js   # Date navigation
│   ├── state.js        # Application state
│   └── demo.js         # Demo functionality
├── styles/             # CSS files
│   └── main.css        # Custom styles
└── icons/              # PWA icons (21 sizes)
```
</details>

<details>
<summary><strong>Backend (FastAPI)</strong></summary>

- **FastAPI**: Modern Python web framework
- **SQLite**: Embedded database for persistence
- **Docker Support**: Containerized deployment
- **API Compatibility**: Same endpoints as legacy PHP version

**Features:**
- Voting system with user tracking
- Image upload with 24h retention
- Automatic cleanup processes
- CORS support for web integration
- Health check endpoint

**API Endpoints:**
- `GET/POST /api/votes.php` - Voting system
- `GET/POST /api/images.php` - Image upload/retrieval
- `GET /health` - Health check
</details>

## 🛠️ Development

<details>
<summary><strong>Local Development Setup</strong></summary>

**Prerequisites:**
- Python 3.11+ (for backend)
- Docker & Docker Compose (for containerized setup)

**Development Workflow:**
1. Use `./start_dev.sh` for quick local development
2. Use `docker compose up` for production-like testing
3. Frontend auto-reloads on file changes
4. Backend provides hot-reload in development mode

**Testing Checklist:**
- [ ] Main app loads at `http://localhost:8000`
- [ ] Demo works at `http://localhost:8000/demo.html`
- [ ] Week navigation functions
- [ ] Menu items display correctly
- [ ] Voting system works (if backend enabled)
- [ ] Image upload works (if backend enabled)
- [ ] PWA installation prompts appear
</details>

<details>
<summary><strong>File Organization</strong></summary>

**Core Application:**
- All frontend code in root directory and `/js/` for modularity
- Styling with Tailwind classes + custom CSS in `/styles/`
- PWA assets in `/icons/` and `manifest.json`

**Backend:**
- FastAPI application in `/api/`
- Database and uploads in `/api/data/` (auto-created)
- Docker configuration included

**Development Tools:**
- `start_dev.sh` - Development server startup
- `proxy_server.py` - Frontend proxy with API routing
- `docker-compose.yml` - Complete environment setup
</details>

<details>
<summary><strong>Known Limitations</strong></summary>

**Development Environment:**
- Tailwind CSS CDN may be blocked (fallback included)
- External menu API may be unavailable (shows fallback message)
- Some features require same-origin requests

**Production Considerations:**
- Image uploads have 24-hour retention
- SQLite database needs backup strategy
- CORS configuration may need adjustment for custom domains
</details>

## 🐛 Troubleshooting

<details>
<summary><strong>Common Issues</strong></summary>

**"No menu available" message**
- Normal when external Eurest API is blocked/unavailable
- Application shows user-friendly fallback message

**Docker build failures**
- Check Docker is running: `docker --version`
- Try rebuilding: `docker compose up --build`
- Check logs: `docker compose logs`

**PWA installation not working**
- Ensure serving over HTTP/HTTPS (not file://)
- Check all icons exist in `/icons/`
- Verify `manifest.json` is accessible

**Voting/Images not working**
- Verify backend is running on port 5694
- Check API health: `curl http://localhost:5694/health`
- Check browser console for API errors
</details>

## 📋 Deployment

<details>
<summary><strong>Production Deployment</strong></summary>

**Docker Compose (Recommended):**
```bash
# Production deployment
docker compose up -d

# With custom configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Manual Deployment:**
```bash
# Backend only
cd api
pip install -r requirements.txt
python main.py

# Frontend (any static file server)
python3 -m http.server 8000
# or use nginx, Apache, etc.
```

**Environment Variables:**
- `PYTHONUNBUFFERED=1` - Enable logging in containers
- Data persistence via mounted volumes in `/api/data`
</details>

## 📚 Documentation

- **[DOCS.md](DOCS.md)** - Detailed setup and development guide
- **[API Documentation](api/README_FASTAPI.md)** - Backend API reference
- **[Contributing Guidelines](.github/CONTRIBUTING.md)** - Development workflow

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for Kaserne Bern** | [Report Issues](https://github.com/marcstae/eatinator/issues) | [View Source](https://github.com/marcstae/eatinator)
    ├── README.md       # Server setup instructions
    ├── IMAGE_SETUP.md  # Image feature setup guide
    ├── votes.php       # Voting API
    └── images.php      # Image upload API
```

## 🛠️ Installation & Setup

### Quick Start (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/marcstae/eatinator.git
   cd eatinator
   ```

2. **Start local development server**:
   ```bash
   python3 -m http.server 8000
   ```

3. **Open in browser**:
   - Main app: `http://localhost:8000/`
   - Demo page: `http://localhost:8000/demo.html`

### Server Features Setup (Optional)

For voting and image upload features, you'll need a PHP server. See the detailed setup guides:

- **[API Setup](api/README.md)**: Complete Docker-based server setup
- **[Image Upload Setup](api/IMAGE_SETUP.md)**: Photo feature configuration

### Configuration

Edit `js/config.js` to customize the application:

```javascript
// API Configuration
const VOTING_CONFIG = {
    apiUrl: '/api/votes.php',
    enabled: true,                    // Set to false to disable voting
    timeout: 5000
};

const IMAGE_CONFIG = {
    apiUrl: '/api/images.php',
    enabled: true,                    // Set to false to disable image uploads
    maxSize: 5 * 1024 * 1024,        // 5MB max file size
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    timeout: 10000
};

// Menu API Configuration
const MENU_CONFIG = {
    apiUrl: 'https://clients.eurest.ch/api/Menu/',
    fallbackEnabled: true,            // HTML scraping when API fails
    timeout: 8000
};
```

## 🌐 PWA Installation

### Mobile (iOS/Android)
1. Open the app in Safari (iOS) or Chrome (Android)
2. Tap the share button
3. Select "Add to Home Screen"

### Desktop (Chrome/Edge)
1. Click the install icon in the address bar
2. Or go to Settings → Install Eatinator

## 📱 Usage

### Menu Navigation
- **Week Navigation**: Use arrow buttons or date picker to navigate
- **Day Selection**: Tap Monday-Friday buttons to view daily menus
- **Auto-refresh**: Pull down to refresh menu data

### Voting System
- **Rate Items**: Tap 👍 (good), 😐 (neutral), or 👎 (bad) on menu items
- **View Results**: See aggregated voting results in real-time
- **Duplicate Prevention**: One vote per user per item

### Photo Sharing
- **Upload Photos**: Tap "Add Photo" button on menu items
- **View Gallery**: Browse uploaded photos for each dish
- **Auto-cleanup**: Images are automatically deleted after 24 hours

## 🔧 Development

### File Organization
- **Frontend Code**: All in `/js/` directory with clear module separation
- **Styling**: Combination of Tailwind CSS classes and custom CSS in `/styles/`
- **PWA Assets**: Icons and manifest in root and `/icons/`

### Testing Checklist
1. **Basic Loading**: Verify app loads and displays current week
2. **Navigation**: Test week/day navigation and date picker
3. **Menu Display**: Check menu items render correctly
4. **Voting**: Test vote submission and result display (if enabled)
5. **Images**: Test photo upload and viewing (if enabled)
6. **PWA**: Verify installation prompts and offline behavior
7. **Responsive**: Test on mobile and desktop screen sizes

### Known Limitations
- **CDN Dependencies**: Tailwind CSS may be blocked in sandboxed environments
- **External APIs**: Menu API may be unavailable in development (shows fallback)
- **CORS Restrictions**: Some features require same-origin requests

## 🐛 Troubleshooting

### Common Issues

**"No menu available" message**
- This is normal when the external Eurest API is blocked or unavailable
- The app will show a user-friendly message and retry periodically

**PWA installation not working**
- Ensure you're serving over HTTP/HTTPS (not file://)
- Check that all required icons exist in `/icons/`
- Verify `manifest.json` is accessible

**Voting/Images not working**
- Check if server-side APIs are enabled and configured
- Verify PHP server is running (see `api/README.md`)
- Check browser console for API errors

**Styling issues**
- May occur if Tailwind CSS CDN is blocked
- Core functionality still works with basic styling

## 🔒 Security

### Frontend Security
- **Input Validation**: All user inputs are sanitized
- **HTTPS Ready**: Configured for secure deployment
- **CSP Headers**: Content Security Policy recommendations included

### Server Security (Optional Features)
- **File Upload Protection**: Multiple validation layers for images
- **Execution Prevention**: Scripts cannot be executed in upload directories
- **Rate Limiting**: Built-in protection against spam
- **Data Retention**: Automatic cleanup of temporary data

## 📄 License

This project is open source. See the repository for license details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see testing checklist above)
5. Submit a pull request

## 📞 Support

For issues and questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check `api/README.md` for server setup
- **Configuration**: Review `js/config.js` for customization options

---

**Note**: This is a zero-dependency static web application. Most development involves editing HTML/JavaScript directly. Server features are optional and require separate PHP setup.
