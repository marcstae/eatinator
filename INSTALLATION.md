# Eatinator Installation Guide for Ubuntu 24.04

This guide provides step-by-step instructions for installing Eatinator on Ubuntu 24.04 with Docker nginx.

## Prerequisites

Before running the installation script, ensure you have:

### System Requirements
- **Ubuntu 24.04 LTS** (other versions may work but are not tested)
- **Docker and Docker Compose** installed and running
- **Git** for cloning the repository
- **User with sudo privileges** for file permissions setup
- **At least 1GB free disk space** for application and container images

### Install Docker (if not already installed)
```bash
# Update package index
sudo apt update

# Install Docker
sudo apt install -y docker.io docker-compose

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (requires logout/login)
sudo usermod -aG docker $USER
```

### Verify Docker Installation
```bash
docker --version
docker compose version
```

## Quick Installation

### 1. Clone the Repository
```bash
git clone https://github.com/marcstae/eatinator.git
cd eatinator
```

### 2. Run the Installation Script
```bash
# Standard installation
./install-eatinator.sh

# Preview changes first (recommended)
./install-eatinator.sh --dry-run

# Custom installation path
./install-eatinator.sh --install-path /opt/eatinator

# Skip Docker setup (if containers already running)
./install-eatinator.sh --skip-docker
```

### 3. Access the Application
After successful installation:
- **HTTP**: `http://your-server-ip/`
- **HTTPS**: `https://your-server-ip/` (if SSL configured)

## Installation Options

### Command Line Options
```bash
./install-eatinator.sh [OPTIONS]

OPTIONS:
  --install-path PATH    Custom installation path (default: ~/nginx/lunchinator)
  --skip-docker         Skip Docker setup (assumes containers already running)
  --dry-run            Show what would be done without making changes
  --help               Show help message
```

### Examples
```bash
# Preview installation
./install-eatinator.sh --dry-run

# Install to custom location
./install-eatinator.sh --install-path /var/www/eatinator

# Install without Docker setup
./install-eatinator.sh --skip-docker
```

## What the Script Does

### File Structure Created
```
~/nginx/lunchinator/                    # Default installation path
├── nginx/
│   └── site-confs/
│       └── default.conf               # Nginx configuration
├── php/
│   └── php-local.ini                  # PHP configuration
├── www/                               # Web root
│   ├── index.html                     # Main application
│   ├── manifest.json                  # PWA manifest
│   ├── js/                           # JavaScript modules
│   ├── styles/                       # CSS files
│   ├── icons/                        # PWA icons
│   └── api/                          # Server-side APIs
│       ├── votes.php                 # Voting API
│       ├── images.php                # Image upload API
│       ├── votes_data/               # Vote storage
│       └── images_data/              # Image storage
└── cleanup.sh                        # Automated cleanup script
```

### Docker Containers Created
- **lunchinator-php**: PHP-FPM 8.3 container for API processing
- **lunchinator-cleanup**: Alpine container for automated image cleanup
- **lunchinet**: Docker network for container communication

### Security Setup
- **File permissions**: Proper ownership and permissions for data directories
- **Security headers**: Nginx configured with security headers
- **.htaccess files**: Prevent script execution in upload directories
- **Input validation**: PHP APIs include comprehensive input validation

## Post-Installation

### Verify Installation
```bash
# Check container status
docker ps

# Test voting API
curl "http://localhost/api/votes.php?action=get&key=test_vote"

# Test image upload API
curl "http://localhost/api/images.php?key=test_image"

# Check file permissions
ls -la ~/nginx/lunchinator/www/api/
```

### Configure Your Nginx Container
If using an existing nginx container, ensure it:
1. **Is connected to the lunchinet network**:
   ```bash
   docker network connect lunchinet Your-Nginx-Container-Name
   ```

2. **Uses the configuration file**:
   The script creates `~/nginx/lunchinator/nginx/site-confs/default.conf`

3. **Is reloaded**:
   ```bash
   docker exec Your-Nginx-Container-Name nginx -t
   docker exec Your-Nginx-Container-Name nginx -s reload
   ```

### Test the Application
1. **Open in browser**: Navigate to your server's IP address
2. **Check PWA features**: Try installing as an app on mobile/desktop
3. **Test voting**: Rate some menu items (if APIs are working)
4. **Test image upload**: Try uploading photos (if APIs are working)

## Troubleshooting

### Common Issues

#### "Docker not found" Error
```bash
# Install Docker
sudo apt update && sudo apt install docker.io

# Start Docker service
sudo systemctl start docker
```

#### "Permission denied" Error
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or use newgrp
newgrp docker
```

#### "Port already in use" Error
- Check if another nginx is running: `sudo netstat -tlnp | grep :80`
- Stop conflicting services or use different ports

#### API Tests Fail
This is often normal if:
- Using different ports (not 80/443)
- Nginx container uses different port mapping
- Test with your actual ports: `curl "http://localhost:YOUR_PORT/api/votes.php?action=get&key=test"`

#### File Permission Issues
```bash
# Fix data directory permissions
cd ~/nginx/lunchinator/www/api
sudo chown -R 33:33 votes_data images_data
sudo chmod -R 775 votes_data images_data
```

### Logs and Debugging
```bash
# Check container logs
docker logs lunchinator-php
docker logs lunchinator-cleanup

# Check nginx logs (if using linuxserver/nginx)
docker logs Your-Nginx-Container-Name

# Check nginx configuration
docker exec Your-Nginx-Container-Name nginx -t
```

## Uninstallation

### Quick Uninstall
```bash
# Remove everything including data
./uninstall-eatinator.sh

# Keep user data
./uninstall-eatinator.sh --keep-data

# Preview what would be removed
./uninstall-eatinator.sh --dry-run
```

### Manual Cleanup
If the uninstall script fails:
```bash
# Stop and remove containers
docker stop lunchinator-php lunchinator-cleanup
docker rm lunchinator-php lunchinator-cleanup

# Remove network (if no other containers use it)
docker network rm lunchinet

# Remove files
rm -rf ~/nginx/lunchinator
```

## Advanced Configuration

### Custom PHP Settings
Edit `~/nginx/lunchinator/php/php-local.ini`:
```ini
# Increase upload limits
upload_max_filesize = 10M
post_max_size = 12M

# Adjust memory limits
memory_limit = 512M
```

### Custom Nginx Settings
Edit `~/nginx/lunchinator/nginx/site-confs/default.conf`:
```nginx
# Increase upload size
client_max_body_size 10m;

# Add custom headers
add_header X-Custom-Header "MyValue" always;
```

### Environment Variables
The installation uses these defaults:
- **PHP Container**: `lunchinator-php`
- **Cleanup Container**: `lunchinator-cleanup`
- **Docker Network**: `lunchinet`
- **Web User UID:GID**: `33:33` (www-data)

## Support

### Getting Help
1. **Check the logs**: Container logs often show the exact issue
2. **Verify prerequisites**: Ensure Docker and permissions are correct
3. **Test step by step**: Use `--dry-run` to understand what happens
4. **Check documentation**: See README.md and api/README.md for details

### Reporting Issues
When reporting problems, include:
- Ubuntu version: `lsb_release -a`
- Docker version: `docker --version`
- Container status: `docker ps -a`
- Error messages from logs
- Steps to reproduce the issue

---

**Note**: This installation script is designed for Ubuntu 24.04 but may work on other Debian-based distributions. Always test in a non-production environment first.
