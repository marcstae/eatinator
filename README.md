# 🍽️ Eatinator

A full-featured Progressive Web App (PWA) for the Eurest restaurant at Kaserne Bern. Beyond just displaying daily menus, Eatinator includes community features like dish voting and photo sharing, all wrapped in a sleek iOS-style interface.

## ✨ Features

### 📱 Core App Features
- **PWA Experience**: Installable on mobile and desktop with offline access
- **iOS-Style Interface**: Clean, dark-mode design optimized for all devices
- **Week Navigation**: Browse menus for any week with intuitive controls
- **Meal Categories**: Automatic categorization (breakfast, lunch, dinner)
- **Menu Types**: Support for "Menu", "Vegi", and "Hit" classifications

### 🍽️ Menu System
- **Multi-Source Data**: Attempts official APIs before falling back to HTML scraping
- **Robust Fallback**: Multiple parsing strategies ensure menus always load
- **Real-time Updates**: Automatic refresh and caching for optimal performance
- **Detailed Information**: Dish names, descriptions, prices, and categories

### 🗳️ Community Features
- **Dish Voting**: Rate dishes with good/neutral/bad votes
- **Real-time Feedback**: See community ratings for each dish
- **Smart Timing**: Voting only active during current meal periods
- **Persistent Storage**: Server-side vote storage with local fallback

### 📸 Photo Sharing
- **Image Upload**: Share photos of actual dishes
- **24-Hour Retention**: Automatic cleanup of old images
- **Secure Upload**: Multiple validation layers for file security
- **Gallery View**: Browse community photos for each dish

### 🛠️ Technical Features
- **Modular Architecture**: Clean separation of concerns across 8 JavaScript modules
- **Zero Build Process**: Runs directly in any modern browser
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Progressive Enhancement**: Core functionality works without server features

## 🚀 Quick Start (Static Hosting)

For basic menu display without voting/images:

```bash
# Clone the repository
git clone https://github.com/marcstae/eatinator.git
cd eatinator

# Serve with any web server
python3 -m http.server 8000
# OR
npx serve .
# OR  
php -S localhost:8000

# Open http://localhost:8000
```

## 🐳 Production Setup (Ubuntu Server 24.04 + Docker + nginx)

This guide provides complete setup for all features including voting and image upload.

### Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 1: Setup Directory Structure

```bash
# Create project directory
mkdir -p ~/nginx/lunchinator
cd ~/nginx/lunchinator

# Create required subdirectories
mkdir -p nginx/site-confs php www/api
```

### Step 2: Deploy Application Files

```bash
# Clone and copy application files
git clone https://github.com/marcstae/eatinator.git temp-repo
cp -r temp-repo/* www/
rm -rf temp-repo

# Verify structure
ls -la www/
# Should show: index.html, demo.html, js/, styles/, icons/, manifest.json, api/
```

### Step 3: Create Docker Network

```bash
docker network create lunchinet || true
```

### Step 4: Start PHP-FPM Container

```bash
docker run -d \
  --name lunchinator-php \
  --network lunchinet \
  -v ~/nginx/lunchinator/www:/var/www/html \
  -v ~/nginx/lunchinator/php:/usr/local/etc/php/conf.d \
  php:8.2-fpm
```

### Step 5: Configure nginx

Create nginx configuration:

```bash
cat > ~/nginx/lunchinator/nginx/site-confs/default.conf << 'EOF'
# Eatinator nginx configuration
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Site root
    root /config/www;
    index index.html index.htm index.php;

    # SPA routing - serve index.html for all non-file requests
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API directory - no SPA rewrite
    location /api/ {
        try_files $uri =404;
    }

    # PHP processing for API endpoints only
    location ~ ^/api/.*\.php$ {
        include /etc/nginx/fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/html$fastcgi_script_name;
        fastcgi_pass lunchinator-php:9000;
        fastcgi_index index.php;
        client_max_body_size 6m;  # For image uploads
    }

    # Static asset caching
    location ~* \.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
    }

    # Security - block hidden files
    location ~ /\.ht {
        deny all;
    }
}
EOF
```

### Step 6: Start nginx Container

```bash
docker run -d \
  --name Nginx-LUNCHINATOR \
  --network lunchinet \
  -p 80:80 \
  -p 443:443 \
  -v ~/nginx/lunchinator:/config \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Europe/Zurich \
  linuxserver/nginx:latest

# Connect to network (if container exists)
docker network connect lunchinet Nginx-LUNCHINATOR || true
```

### Step 7: Setup Permissions

```bash
cd ~/nginx/lunchinator/www/api

# Create data directories
mkdir -p votes_data images_data

# Set permissions for PHP to write data
sudo chown -R 33:33 votes_data images_data
sudo chmod -R 775 votes_data images_data
```

### Step 8: Test Installation

```bash
# Test basic site
curl -I http://localhost/
# Should return: HTTP/1.1 200 OK

# Test voting API
curl "http://localhost/api/votes.php?action=get&key=test_vote"
# Should return: {"good":0,"neutral":0,"bad":0}

# Test image API
curl http://localhost/api/images.php
# Should return: {"success":true,"message":"Cleanup completed","deleted":0}
```

### Step 9: Optional - Setup Image Cleanup

For automatic image cleanup every hour:

```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 * * * * curl -s http://localhost/api/images.php > /dev/null 2>&1") | crontab -
```

## 🔧 How It Works

### Menu Data Pipeline
1. **Primary APIs**: Attempts multiple unofficial endpoints on `clients.eurest.ch`
2. **HTML Fallback**: If APIs fail, scrapes restaurant website directly
3. **Smart Parsing**: Uses progressive CSS selectors for resilient data extraction
4. **Data Cleaning**: Normalizes prices, categories, and descriptions
5. **Caching**: Intelligent caching reduces server load

### Voting System
- **Active Periods**: Voting only enabled during current meal times
- **Dual Storage**: Server-side persistence with localStorage fallback
- **User Tracking**: Anonymous user IDs prevent duplicate voting
- **Real-time Updates**: Live vote counts update across all users

### Image Management
- **Security**: Multiple validation layers (MIME type, content verification, size limits)
- **Storage**: Organized by date/dish with automatic cleanup
- **Performance**: Optimized serving with proper cache headers
- **Privacy**: 24-hour retention policy for automatic cleanup

## 📁 Project Structure

```
eatinator/
├── index.html              # Main application (115 lines)
├── demo.html               # Image upload demo (30 lines)
├── manifest.json           # PWA configuration
├── icons/                  # 21 PWA icons for all devices
├── js/                     # Modular JavaScript (1000+ lines total)
│   ├── config.js          # App configuration & Tailwind setup
│   ├── state.js           # Application state management
│   ├── voting.js          # Voting system functionality
│   ├── images.js          # Image upload & display
│   ├── navigation.js      # Week/day navigation
│   ├── menu.js            # Menu loading & display
│   ├── app.js             # Main app initialization
│   └── demo.js            # Demo page functionality
├── styles/
│   └── main.css           # Custom CSS styles (167 lines)
└── api/                   # Server-side features (optional)
    ├── votes.php          # Voting API
    ├── images.php         # Image upload API
    ├── README.md          # Detailed server setup
    └── IMAGE_SETUP.md     # Image feature documentation
```

## 🛠️ Development

```bash
# Start development server
python3 -m http.server 8000

# Access main app
open http://localhost:8000/

# Access demo page
open http://localhost:8000/demo.html
```

## 📖 Advanced Configuration

- **Server Setup**: See `api/README.md` for detailed Docker configuration
- **Image Features**: See `api/IMAGE_SETUP.md` for image upload setup
- **HTTPS Setup**: nginx container includes SSL/TLS configuration
- **Customization**: Edit `js/config.js` for API endpoints and feature toggles

## 🔍 Troubleshooting

**Menu not loading**: External APIs may be blocked - this is normal, app will show fallback message

**Voting not working**: Check PHP container logs: `docker logs lunchinator-php`

**Images not uploading**: Verify permissions: `ls -la www/api/images_data/`

**502 errors**: Ensure containers are on same network: `docker network ls`

## 📜 License

This project is open source. The application scrapes publicly available menu information for educational and convenience purposes.
