# Eatinator - Detailed Documentation

This document provides comprehensive setup, development, and deployment instructions for the Eatinator PWA.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Backend API](#backend-api)
- [Frontend Architecture](#frontend-architecture)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Prerequisites

### System Requirements

- **Docker & Docker Compose** - For containerized deployment (recommended)
- **Python 3.11+** - For local backend development
- **Modern Web Browser** - Chrome, Firefox, Safari, or Edge with PWA support

### Development Tools (Optional)

- **Git** - Version control
- **VS Code** - Recommended editor with Docker and Python extensions
- **Node.js** - If you want to add build tools in the future

## Installation

### Method 1: Docker Compose (Recommended)

This method provides a complete environment with minimal setup:

```bash
# 1. Clone the repository
git clone https://github.com/marcstae/eatinator.git
cd eatinator

# 2. Start the application stack
docker compose up -d

# 3. Verify services are running
docker compose ps

# 4. Access the application
# Frontend: http://localhost:8000
# Backend API: http://localhost:5694
# Health Check: http://localhost:5694/health
```

**What this sets up:**
- **eatinator-api**: FastAPI backend on port 5694
- **eatinator-frontend**: Nginx serving static files on port 8000
- **Automatic networking**: Containers can communicate internally
- **Data persistence**: SQLite database and uploads stored in `./api/data/`

### Method 2: Development Mode

For active development with hot-reload:

```bash
# 1. Clone the repository
git clone https://github.com/marcstae/eatinator.git
cd eatinator

# 2. Install Python dependencies (for backend)
cd api
pip install -r requirements.txt
cd ..

# 3. Start development environment
./start_dev.sh

# This starts:
# - FastAPI backend with auto-reload on port 5694
# - Python proxy server on port 8000 (routes API calls to backend)
```

### Method 3: Static Only

To run just the frontend without backend features:

```bash
# Simple static file server
python3 -m http.server 8000

# Access at http://localhost:8000
# Note: Voting and image features will be disabled
```

## Development

### Project Structure

```
eatinator/
├── index.html              # Main application entry point
├── demo.html               # Image upload demo page
├── manifest.json           # PWA manifest
├── docker-compose.yml      # Container orchestration
├── start_dev.sh           # Development startup script
├── proxy_server.py        # Development proxy server
├── js/                    # Frontend JavaScript modules
│   ├── app.js             # Application initialization
│   ├── config.js          # Configuration & Tailwind setup
│   ├── state.js           # Application state management
│   ├── menu.js            # Menu fetching & display logic
│   ├── voting.js          # Voting system functionality
│   ├── images.js          # Image upload & display
│   ├── navigation.js      # Week/day navigation
│   └── demo.js            # Demo page functionality
├── styles/                # CSS files
│   └── main.css           # Custom CSS styles
├── icons/                 # PWA icons (21 different sizes)
│   ├── favicon.ico
│   ├── favicon-*.png
│   └── browserconfig.xml
├── api/                   # Backend FastAPI application
│   ├── main.py            # FastAPI application
│   ├── Dockerfile         # Backend container
│   ├── requirements.txt   # Python dependencies
│   ├── .dockerignore      # Docker build exclusions
│   ├── data/              # Runtime data (auto-created)
│   │   ├── eatinator.db   # SQLite database
│   │   └── images/        # Uploaded images
│   └── README_FASTAPI.md  # Backend API documentation
└── .github/
    └── copilot-instructions.md  # AI assistant guidelines
```

### Development Workflow

1. **Frontend Changes**:
   - Edit HTML, CSS, or JavaScript files directly
   - Changes are visible immediately on page refresh
   - No build process required

2. **Backend Changes**:
   - Edit `api/main.py` or related files
   - If using `start_dev.sh`, FastAPI auto-reloads
   - If using Docker, rebuild: `docker compose up --build api`

3. **Testing**:
   - Open `http://localhost:8000` for main app
   - Open `http://localhost:8000/demo.html` for demo
   - Check `http://localhost:5694/health` for backend status

### Frontend Architecture

#### Module Organization

- **config.js**: Tailwind configuration and app constants
- **state.js**: Global application state management
- **navigation.js**: Week/day navigation and date handling
- **menu.js**: Menu data fetching and display logic
- **voting.js**: Voting system with localStorage fallback
- **images.js**: Image upload and gallery functionality
- **app.js**: Application initialization and coordination
- **demo.js**: Demo page specific functionality

#### Styling System

- **Tailwind CSS**: Loaded from CDN with local fallback
- **Custom CSS**: Additional styles in `styles/main.css`
- **iOS-like Design**: Dark theme with native mobile feel
- **Responsive**: Mobile-first design with desktop adaptation

#### Progressive Enhancement

The app is designed to work gracefully without server features:

- **Menu Display**: Falls back to "No menu available" message
- **Voting**: Uses localStorage when server is unavailable
- **Images**: Hidden when server features are disabled
- **Navigation**: Always works for client-side functionality

## Backend API

### FastAPI Application

The backend is built with FastAPI and provides:

- **RESTful API**: Standard HTTP methods and status codes
- **Interactive Docs**: Automatic OpenAPI documentation at `/docs`
- **Data Validation**: Pydantic models for request/response validation
- **Error Handling**: Comprehensive error responses
- **CORS Support**: Cross-origin requests for web integration

### Database Schema

**SQLite Tables:**

```sql
-- votes table
CREATE TABLE votes (
    key TEXT PRIMARY KEY,
    good INTEGER DEFAULT 0,
    neutral INTEGER DEFAULT 0,
    bad INTEGER DEFAULT 0
);

-- user_votes table
CREATE TABLE user_votes (
    user_id TEXT,
    vote_key TEXT,
    vote_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, vote_key)
);

-- images table
CREATE TABLE images (
    key TEXT,
    filename TEXT,
    original_name TEXT,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (key, filename)
);
```

### API Endpoints

#### Voting System

```bash
# Get votes for an item
GET /api/votes.php?key=vote_key

# Cast a vote
POST /api/votes.php
Content-Type: application/json
{
  "action": "vote",
  "key": "vote_key",
  "voteType": "good|neutral|bad",
  "userId": "user_123"
}
```

#### Image Upload System

```bash
# Get images for a dish
GET /api/images.php?key=image_key

# Upload an image
POST /api/images.php
Content-Type: multipart/form-data
key=image_key
image=<file>

# View an image
GET /api/images.php?action=view&key=image_key&file=filename.jpg
```

#### Health Check

```bash
GET /health
# Returns: {"status": "healthy"}
```

## Deployment

### Production with Docker Compose

1. **Prepare the server**:
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

2. **Deploy the application**:
```bash
# Clone and start
git clone https://github.com/marcstae/eatinator.git
cd eatinator
docker compose up -d
```

3. **Configure reverse proxy** (optional):
```nginx
# nginx configuration for domain setup
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Manual Deployment

For custom setups or shared hosting:

1. **Deploy backend**:
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5694
```

2. **Deploy frontend**:
```bash
# Copy files to web server
# Ensure API endpoints point to your backend URL
# Update js/config.js if needed
```

### Environment Variables

- `PYTHONUNBUFFERED=1`: Enable real-time logging
- Database and uploads stored in mounted `/app/data` volume

## Troubleshooting

### Common Issues

#### Docker Build Failures

```bash
# Check Docker status
docker --version
docker compose version

# Clean rebuild
docker compose down
docker compose up --build

# Check logs
docker compose logs api
docker compose logs frontend
```

#### API Connection Issues

```bash
# Test backend health
curl http://localhost:5694/health

# Check backend logs
docker compose logs api

# Verify network connectivity
docker compose exec frontend curl http://api:5694/health
```

#### PWA Installation Problems

- Ensure serving over HTTPS in production
- Check all required icons exist in `/icons/`
- Verify `manifest.json` is accessible
- Test in different browsers (PWA support varies)

#### Performance Issues

- **Large database**: Consider archiving old votes/images
- **Memory usage**: Monitor container resource usage
- **Image storage**: Clean up old images (automatic 24h retention)

### Debug Mode

Enable debug logging in the backend:

```python
# In api/main.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Advanced Configuration

### Custom Domains

Update the following files for custom domain deployment:

1. **CORS configuration** in `api/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],
    # ...
)
```

2. **API endpoints** in `js/config.js`:
```javascript
const VOTING_CONFIG = {
    apiUrl: 'https://your-domain.com/api/votes.php',
    // ...
};
```

### SSL/HTTPS Setup

For production with HTTPS:

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl
      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf
```

### Database Backup

```bash
# Backup SQLite database
docker compose exec api cp /app/data/eatinator.db /app/data/backup-$(date +%Y%m%d).db

# Or from host
cp ./api/data/eatinator.db ./backups/eatinator-$(date +%Y%m%d).db
```

### Monitoring

Basic monitoring with Docker health checks:

```bash
# Check container health
docker compose ps

# Monitor logs
docker compose logs -f api

# Resource usage
docker stats eatinator-api eatinator-frontend
```

---

For additional support, please check the [GitHub Issues](https://github.com/marcstae/eatinator/issues) or create a new issue.