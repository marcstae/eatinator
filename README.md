# Eatinator 🍽️

A Progressive Web App (PWA) that displays daily lunch menus from the Eurest restaurant at Kaserne Bern. Built as a static web application with optional server-side features for voting and photo sharing.

## 🚀 Features

- **📱 PWA Support**: Install as a mobile/desktop app with offline capabilities
- **📅 Weekly Menu View**: Navigate through weeks with intuitive date picker
- **🗳️ Menu Voting**: Rate menu items (good/neutral/bad) with server-side storage
- **📸 Photo Upload**: Share photos of dishes with 24-hour retention
- **🌙 Dark Mode**: Responsive design with iOS-style dark theme
- **⚡ Fast Loading**: Zero-dependency static frontend with CDN resources
- **🔄 Fallback System**: Graceful degradation when external APIs are unavailable

## 🏗️ Architecture

### Frontend (Static)
- **No Build System**: Direct HTML/CSS/JavaScript files
- **Tailwind CSS**: Loaded from CDN for styling
- **Modular JavaScript**: Organized into separate modules (menu, voting, images, etc.)
- **Progressive Enhancement**: Core functionality works without server APIs

### Backend (Optional)
- **PHP APIs**: Voting and image upload endpoints
- **Docker Support**: nginx + PHP-FPM containerized setup
- **JSON Storage**: File-based data persistence
- **Automatic Cleanup**: 24-hour retention for uploaded images

## 📁 Project Structure

```
.
├── .github/
│   └── workflows/        # CI/CD automation
│       ├── build-and-push.yml    # Docker image builds
│       ├── release.yml           # Semantic releases
│       └── validate-commits.yml  # Commit validation
├── index.html           # Main application
├── manifest.json        # PWA configuration  
├── README.md           # This file
├── DEPLOYMENT.md       # Production deployment guide
├── Dockerfile.frontend # Frontend container
├── docker-compose.yml  # Local development stack
├── styles/
│   └── main.css        # Custom CSS styles
├── js/
│   ├── app.js          # Main application logic
│   ├── config.js       # Configuration settings
│   ├── menu.js         # Menu data fetching
│   ├── voting.js       # Voting functionality
│   ├── images.js       # Image upload feature
│   ├── navigation.js   # Date navigation
│   └── state.js        # Application state management
├── icons/              # PWA icons (multiple sizes)
│   ├── favicon.ico
│   ├── favicon-*.png   # Various sizes for different devices
│   └── browserconfig.xml
└── api/                # Server-side features (optional)
    ├── README.md       # Server setup instructions
    ├── IMAGE_SETUP.md  # Image feature setup guide
    ├── Dockerfile      # API container
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

### Deployment Options

Choose your preferred deployment method:

#### Option 1: Production Deployment with Pre-built Images
Use GitHub Container Registry for easy deployment without building:
- **[GHCR Deployment Guide](DEPLOYMENT.md)**: Deploy using pre-built Docker images

#### Option 2: Local Development with Server Features
For voting and image upload features, set up a local server:
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

We use conventional commits for consistent release management.

### Commit Message Format

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types
- **feat**: New features
- **fix**: Bug fixes  
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes
- **build**: Build system changes

#### Examples
```bash
feat: add menu caching for better performance
fix(api): handle empty menu response gracefully  
docs: update deployment instructions
chore: update dependencies to latest versions
```

### Contributing Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure commits follow conventional commit format
5. Test thoroughly (see testing checklist above) 
6. Submit a pull request

### Automated Releases

- Releases are automatically generated based on conventional commits
- **feat**: triggers minor version bump
- **fix**: triggers patch version bump
- **BREAKING CHANGE**: triggers major version bump

## 📞 Support

For issues and questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check `api/README.md` for server setup
- **Configuration**: Review `js/config.js` for customization options

---

**Note**: This is a zero-dependency static web application. Most development involves editing HTML/JavaScript directly. Server features are optional and require separate PHP setup.
