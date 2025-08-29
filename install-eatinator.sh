#!/bin/bash

###################################################################################
# Eatinator Installation Script for Ubuntu 24.04 with Docker nginx
# 
# This script installs the Eatinator PWA application with full server-side features
# including voting and image upload capabilities.
#
# Prerequisites:
# - Ubuntu 24.04 LTS
# - Docker and Docker Compose installed
# - User with sudo privileges
# - Git installed
#
# Usage: ./install-eatinator.sh [options]
# Options:
#   --install-path PATH    Custom installation path (default: ~/nginx/lunchinator)
#   --skip-docker         Skip Docker setup (assumes containers already running)
#   --dry-run            Show what would be done without making changes
#   --help               Show this help message
###################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
INSTALL_PATH="$HOME/nginx/lunchinator"
SKIP_DOCKER=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker configuration
DOCKER_NETWORK="lunchinet"
NGINX_CONTAINER="Nginx-LUNCHINATOR"
PHP_CONTAINER="lunchinator-php"
CLEANUP_CONTAINER="lunchinator-cleanup"

# PHP-FPM user/group (typically www-data with uid:gid 33:33)
WWW_DATA_UID=33
WWW_DATA_GID=33

###################################################################################
# Helper Functions
###################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Eatinator Installation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --install-path PATH    Custom installation path (default: ~/nginx/lunchinator)
    --skip-docker         Skip Docker setup (assumes containers already running)
    --dry-run            Show what would be done without making changes
    --help               Show this help message

EXAMPLES:
    $0                                    # Standard installation
    $0 --install-path /opt/eatinator      # Custom path
    $0 --skip-docker                      # Skip Docker setup
    $0 --dry-run                         # Preview changes

DESCRIPTION:
    This script sets up the complete Eatinator PWA application including:
    - Frontend files (HTML, CSS, JavaScript, PWA assets)
    - Backend APIs (voting and image upload)
    - Docker containers (nginx + PHP-FPM)
    - Proper file permissions and security
    - Automated cleanup for image uploads

PREREQUISITES:
    - Ubuntu 24.04 LTS
    - Docker and Docker Compose
    - sudo privileges
    - Git (for cloning repository)

EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Ubuntu version
    if ! grep -q "24.04" /etc/os-release; then
        log_warning "This script is designed for Ubuntu 24.04, current version may not be supported"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker --version &> /dev/null; then
        log_error "Docker is not running or accessible. Please check Docker installation."
        exit 1
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log_error "This script requires sudo privileges for file permissions setup."
        exit 1
    fi
    
    # Check if we're in the eatinator directory
    if [[ ! -f "$SCRIPT_DIR/index.html" ]] || [[ ! -f "$SCRIPT_DIR/manifest.json" ]]; then
        log_error "This script must be run from the eatinator repository root directory."
        log_error "Expected files: index.html, manifest.json"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_directory_structure() {
    log_info "Creating directory structure at $INSTALL_PATH..."
    
    local dirs=(
        "$INSTALL_PATH"
        "$INSTALL_PATH/nginx"
        "$INSTALL_PATH/nginx/site-confs"
        "$INSTALL_PATH/php"
        "$INSTALL_PATH/www"
        "$INSTALL_PATH/www/api"
        "$INSTALL_PATH/www/api/votes_data"
        "$INSTALL_PATH/www/api/images_data"
        "$INSTALL_PATH/www/icons"
        "$INSTALL_PATH/www/js"
        "$INSTALL_PATH/www/styles"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would create directory: $dir"
        else
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
}

copy_application_files() {
    log_info "Copying application files..."
    
    # Frontend files
    local frontend_files=(
        "index.html:www/"
        "manifest.json:www/"
        "README.md:www/"
    )
    
    for file_mapping in "${frontend_files[@]}"; do
        local src="${file_mapping%:*}"
        local dest_dir="${file_mapping#*:}"
        local dest="$INSTALL_PATH/$dest_dir$(basename "$src")"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would copy: $SCRIPT_DIR/$src -> $dest"
        else
            cp "$SCRIPT_DIR/$src" "$dest"
            log_info "Copied: $src -> $dest_dir"
        fi
    done
    
    # Copy directories
    local directories=(
        "icons:www/"
        "js:www/"
        "styles:www/"
        "api:www/"
    )
    
    for dir_mapping in "${directories[@]}"; do
        local src="${dir_mapping%:*}"
        local dest_dir="${dir_mapping#*:}"
        local dest="$INSTALL_PATH/$dest_dir"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would copy directory: $SCRIPT_DIR/$src -> $dest"
        else
            cp -r "$SCRIPT_DIR/$src"/* "$dest$(basename "$src")/"
            log_info "Copied directory: $src -> $dest_dir"
        fi
    done
}

create_security_files() {
    log_info "Creating security configuration files..."
    
    # Create .htaccess for images directory
    local htaccess_content='# Prevent execution of any scripts in this directory
<Files "*">
    SetHandler default-handler
</Files>
Options -ExecCGI
RemoveHandler .cgi .php .pl .py .sh

# Set proper content types for images
<IfModule mod_mime.c>
    AddType image/jpeg .jpg .jpeg
    AddType image/png .png
    AddType image/webp .webp
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
</IfModule>'
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create .htaccess in images_data directory"
    else
        echo "$htaccess_content" > "$INSTALL_PATH/www/api/images_data/.htaccess"
        log_info "Created security .htaccess file"
    fi
    
    # Create gitignore for data directories
    local gitignore_content='# Ignore runtime data files
*.json
*.jpg
*.jpeg
*.png
*.webp
!.gitkeep'
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create .gitignore files in data directories"
    else
        echo "$gitignore_content" > "$INSTALL_PATH/www/api/votes_data/.gitignore"
        echo "$gitignore_content" > "$INSTALL_PATH/www/api/images_data/.gitignore"
        
        # Create .gitkeep files to preserve empty directories
        touch "$INSTALL_PATH/www/api/votes_data/.gitkeep"
        touch "$INSTALL_PATH/www/api/images_data/.gitkeep"
        
        log_info "Created .gitignore and .gitkeep files"
    fi
}

create_php_config() {
    log_info "Creating PHP configuration..."
    
    local php_config='; Eatinator PHP Configuration
; Optimized for image uploads and API responses

; File upload settings
upload_max_filesize = 6M
post_max_size = 8M
max_file_uploads = 10

; Memory and execution limits
memory_limit = 256M
max_execution_time = 30
max_input_time = 30

; Session settings
session.gc_maxlifetime = 3600
session.cookie_secure = Off
session.cookie_httponly = On

; Error reporting (disable in production)
display_errors = Off
log_errors = On
error_log = /var/log/php_errors.log

; Security settings
allow_url_fopen = Off
allow_url_include = Off
expose_php = Off'
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create PHP configuration file"
    else
        echo "$php_config" > "$INSTALL_PATH/php/php-local.ini"
        log_info "Created PHP configuration file"
    fi
}

create_nginx_config() {
    log_info "Creating nginx configuration..."
    
    local nginx_config='## Eatinator nginx + external php-fpm (PWA + APIs)
## Assumes:
##   - nginx container has site files at /app/www/public (preferred) or /config/www
##   - php-fpm container name: lunchinator-php, listens on port 9000
##   - php-fpm sees the same site files at /var/www/html

############################# HTTP (plain) ############################
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Dynamic docroot: prefer /app/www/public; fallback to /config/www
    set $site_root /app/www/public;
    if (!-d /app/www/public) { set $site_root /config/www; }
    root $site_root;

    index index.html index.htm index.php;

    # --- PWA/SPA ---
    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- API directory (no SPA rewrite) ---
    location /api/ {
        try_files $uri =404;
    }

    # --- PHP under /api only ---
    location ~ ^/api/.*\.php$ {
        include /etc/nginx/fastcgi_params;

        # IMPORTANT: path as seen inside the PHP container
        fastcgi_param SCRIPT_FILENAME /var/www/html$fastcgi_script_name;

        fastcgi_pass lunchinator-php:9000;
        fastcgi_index index.php;

        # Support for image uploads (6MB max)
        client_max_body_size 6m;

        # No cache for dynamic responses
        add_header Cache-Control "no-store" always;
        
        # Security headers
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # --- Static assets caching ---
    location ~* \.(?:css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json)$ {
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
        
        # Security headers for static files
        add_header X-Content-Type-Options nosniff always;
    }

    # --- PWA manifest and service worker ---
    location ~* \.(?:manifest\.json|sw\.js)$ {
        add_header Cache-Control "public, max-age=0";
        try_files $uri =404;
    }

    # --- Security: block hidden files ---
    location ~ /\.ht {
        deny all;
    }
    
    location ~ /\.git {
        deny all;
    }
}

############################# HTTPS (TLS / HTTP3) ############################
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    listen 443 quic reuseport default_server;
    listen [::]:443 quic reuseport default_server;
    server_name _;

    # TLS/HTTP3 settings (provided by linuxserver/nginx image)
    include /config/nginx/ssl.conf;

    # Dynamic docroot: prefer /app/www/public; fallback to /config/www
    set $site_root /app/www/public;
    if (!-d /app/www/public) { set $site_root /config/www; }
    root $site_root;

    index index.html index.htm index.php;

    # --- PWA/SPA ---
    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- API directory (no SPA rewrite) ---
    location /api/ {
        try_files $uri =404;
    }

    # --- PHP under /api only ---
    location ~ ^/api/.*\.php$ {
        include /etc/nginx/fastcgi_params;

        # IMPORTANT: path as seen inside the PHP container
        fastcgi_param SCRIPT_FILENAME /var/www/html$fastcgi_script_name;

        fastcgi_pass lunchinator-php:9000;
        fastcgi_index index.php;

        # Support for image uploads (6MB max)
        client_max_body_size 6m;

        # No cache for dynamic responses
        add_header Cache-Control "no-store" always;
        
        # Security headers
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # --- Static assets caching ---
    location ~* \.(?:css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json)$ {
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
        
        # Security headers for static files
        add_header X-Content-Type-Options nosniff always;
    }

    # --- PWA manifest and service worker ---
    location ~* \.(?:manifest\.json|sw\.js)$ {
        add_header Cache-Control "public, max-age=0";
        try_files $uri =404;
    }

    # --- Security: block hidden files ---
    location ~ /\.ht {
        deny all;
    }
    
    location ~ /\.git {
        deny all;
    }
}'
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create nginx configuration file"
    else
        echo "$nginx_config" > "$INSTALL_PATH/nginx/site-confs/default.conf"
        log_info "Created nginx configuration file"
    fi
}

setup_docker_containers() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        log_warning "Skipping Docker setup as requested"
        return 0
    fi
    
    log_info "Setting up Docker containers..."
    
    # Create Docker network
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create Docker network: $DOCKER_NETWORK"
    else
        if ! docker network ls | grep -q "$DOCKER_NETWORK"; then
            docker network create "$DOCKER_NETWORK" || true
            log_success "Created Docker network: $DOCKER_NETWORK"
        else
            log_info "Docker network $DOCKER_NETWORK already exists"
        fi
    fi
    
    # Check for existing containers
    if [[ "$DRY_RUN" == "false" ]]; then
        if docker ps -a | grep -q "$PHP_CONTAINER"; then
            log_warning "PHP container $PHP_CONTAINER already exists, removing..."
            docker stop "$PHP_CONTAINER" 2>/dev/null || true
            docker rm "$PHP_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    # Start PHP-FPM container
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would start PHP-FPM container: $PHP_CONTAINER"
    else
        docker run -d \
          --name "$PHP_CONTAINER" \
          --network "$DOCKER_NETWORK" \
          -v "$INSTALL_PATH/www":/var/www/html \
          -v "$INSTALL_PATH/php/php-local.ini":/usr/local/etc/php/conf.d/php-local.ini:ro \
          -e PHP_MEMORY_LIMIT=256M \
          php:8.3-fpm
        
        log_success "Started PHP-FPM container: $PHP_CONTAINER"
        
        # Wait for PHP-FPM to be ready
        log_info "Waiting for PHP-FPM to be ready..."
        sleep 5
        
        if docker logs "$PHP_CONTAINER" 2>&1 | grep -q "ready to handle connections"; then
            log_success "PHP-FPM is ready"
        else
            log_warning "PHP-FPM may not be fully ready yet"
        fi
    fi
    
    # Connect nginx container to network if it exists
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would connect nginx container to network"
    else
        if docker ps | grep -q "$NGINX_CONTAINER"; then
            if ! docker network inspect "$DOCKER_NETWORK" | grep -q "$NGINX_CONTAINER"; then
                docker network connect "$DOCKER_NETWORK" "$NGINX_CONTAINER"
                log_success "Connected nginx container to network"
            else
                log_info "Nginx container already connected to network"
            fi
        else
            log_warning "Nginx container $NGINX_CONTAINER not found, please start it manually"
        fi
    fi
}

set_file_permissions() {
    log_info "Setting up file permissions..."
    
    # Get actual www-data UID/GID from PHP container if it exists
    if [[ "$DRY_RUN" == "false" ]] && [[ "$SKIP_DOCKER" == "false" ]]; then
        if docker ps | grep -q "$PHP_CONTAINER"; then
            WWW_DATA_UID=$(docker exec "$PHP_CONTAINER" sh -c 'id -u www-data' 2>/dev/null || echo "33")
            WWW_DATA_GID=$(docker exec "$PHP_CONTAINER" sh -c 'id -g www-data' 2>/dev/null || echo "33")
            log_info "Detected www-data UID:GID as $WWW_DATA_UID:$WWW_DATA_GID"
        fi
    fi
    
    # Set ownership for data directories
    local data_dirs=(
        "$INSTALL_PATH/www/api/votes_data"
        "$INSTALL_PATH/www/api/images_data"
    )
    
    for dir in "${data_dirs[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would set ownership: $dir -> $WWW_DATA_UID:$WWW_DATA_GID"
            log_info "Would set permissions: $dir -> 775"
        else
            sudo chown -R "$WWW_DATA_UID:$WWW_DATA_GID" "$dir"
            sudo chmod -R 775 "$dir"
            log_info "Set permissions for: $dir"
        fi
    done
    
    # Set general ownership for www directory
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would set ownership for www directory"
    else
        sudo chown -R "$USER:$USER" "$INSTALL_PATH/www"
        sudo chown -R "$WWW_DATA_UID:$WWW_DATA_GID" "${data_dirs[@]}"
        log_success "File permissions configured"
    fi
}

create_cleanup_script() {
    log_info "Creating image cleanup automation..."
    
    local cleanup_script='#!/bin/bash
# Eatinator Image Cleanup Script
# Calls the cleanup endpoint every hour to remove images older than 24 hours

CLEANUP_URL="http://lunchinator-nginx/api/images.php"
LOG_FILE="/var/log/eatinator-cleanup.log"

echo "$(date): Starting cleanup..." >> "$LOG_FILE"

if curl -s "$CLEANUP_URL" > /dev/null 2>&1; then
    echo "$(date): Cleanup successful" >> "$LOG_FILE"
else
    echo "$(date): Cleanup failed" >> "$LOG_FILE"
fi'
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would create cleanup script and container"
    else
        echo "$cleanup_script" > "$INSTALL_PATH/cleanup.sh"
        chmod +x "$INSTALL_PATH/cleanup.sh"
        
        # Remove existing cleanup container if it exists
        if docker ps -a | grep -q "$CLEANUP_CONTAINER"; then
            docker stop "$CLEANUP_CONTAINER" 2>/dev/null || true
            docker rm "$CLEANUP_CONTAINER" 2>/dev/null || true
        fi
        
        # Start cleanup container
        docker run -d \
          --name "$CLEANUP_CONTAINER" \
          --network "$DOCKER_NETWORK" \
          -v "$INSTALL_PATH/cleanup.sh:/cleanup.sh" \
          --restart unless-stopped \
          alpine/curl:latest \
          sh -c 'while true; do sleep 3600; /cleanup.sh; done'
        
        log_success "Created cleanup automation"
    fi
}

reload_nginx() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        log_warning "Skipping nginx reload (Docker setup skipped)"
        return 0
    fi
    
    log_info "Reloading nginx configuration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would test and reload nginx configuration"
    else
        if docker ps | grep -q "$NGINX_CONTAINER"; then
            if docker exec "$NGINX_CONTAINER" nginx -t 2>/dev/null; then
                docker exec "$NGINX_CONTAINER" nginx -s reload
                log_success "Nginx configuration reloaded"
            else
                log_error "Nginx configuration test failed"
                return 1
            fi
        else
            log_warning "Nginx container not found, skipping reload"
        fi
    fi
}

run_tests() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        log_warning "Skipping tests (Docker setup skipped)"
        return 0
    fi
    
    log_info "Running installation tests..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would run API tests"
        return 0
    fi
    
    # Wait a moment for services to be ready
    sleep 3
    
    # Test voting API
    local vote_test_result
    vote_test_result=$(curl -s "http://localhost/api/votes.php?action=get&key=test_vote" 2>/dev/null || echo "FAILED")
    
    if echo "$vote_test_result" | grep -q '"success"'; then
        log_success "Voting API test passed"
    else
        log_warning "Voting API test failed (this may be normal if using different ports)"
    fi
    
    # Test image upload API
    local image_test_result
    image_test_result=$(curl -s "http://localhost/api/images.php?key=test_image" 2>/dev/null || echo "FAILED")
    
    if echo "$image_test_result" | grep -q '"success"'; then
        log_success "Image upload API test passed"
    else
        log_warning "Image upload API test failed (this may be normal if using different ports)"
    fi
    
    # Check file permissions
    if [[ -w "$INSTALL_PATH/www/api/votes_data" ]] && [[ -w "$INSTALL_PATH/www/api/images_data" ]]; then
        log_success "File permissions test passed"
    else
        log_warning "File permissions may need adjustment"
    fi
}

show_completion_info() {
    log_success "Eatinator installation completed!"
    
    cat << EOF

${GREEN}=== Installation Summary ===${NC}
Installation Path: $INSTALL_PATH
Docker Network: $DOCKER_NETWORK
PHP Container: $PHP_CONTAINER
Cleanup Container: $CLEANUP_CONTAINER

${YELLOW}=== Next Steps ===${NC}
1. Ensure your nginx container ($NGINX_CONTAINER) is running
2. Access the application at: http://your-server/
3. Test the APIs:
   ${BLUE}Voting:${NC} curl "http://your-server/api/votes.php?action=get&key=test_vote"
   ${BLUE}Images:${NC} curl "http://your-server/api/images.php?key=test_image"

${YELLOW}=== File Locations ===${NC}
Frontend: $INSTALL_PATH/www/
APIs: $INSTALL_PATH/www/api/
Data: $INSTALL_PATH/www/api/{votes,images}_data/
Config: $INSTALL_PATH/nginx/site-confs/default.conf

${YELLOW}=== Maintenance ===${NC}
- Images are automatically cleaned up every hour
- Check logs: docker logs $PHP_CONTAINER
- Cleanup logs: docker logs $CLEANUP_CONTAINER

${YELLOW}=== Troubleshooting ===${NC}
If you encounter issues:
1. Check container status: docker ps
2. Check logs: docker logs [container-name]
3. Verify permissions: ls -la $INSTALL_PATH/www/api/
4. Test nginx config: docker exec $NGINX_CONTAINER nginx -t

For more information, see: $INSTALL_PATH/www/README.md

EOF
}

###################################################################################
# Parse command line arguments
###################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --install-path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

###################################################################################
# Main installation process
###################################################################################

main() {
    log_info "Starting Eatinator installation..."
    log_info "Installation path: $INSTALL_PATH"
    log_info "Skip Docker: $SKIP_DOCKER"
    log_info "Dry run: $DRY_RUN"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    check_prerequisites
    create_directory_structure
    copy_application_files
    create_security_files
    create_php_config
    create_nginx_config
    setup_docker_containers
    set_file_permissions
    create_cleanup_script
    reload_nginx
    run_tests
    show_completion_info
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run completed. Run without --dry-run to perform actual installation."
    else
        log_success "Installation completed successfully!"
    fi
}

# Run main function
main "$@"
