# Server-side API Setup (Dockerized nginx + PHP-FPM)
This directory contains the server-side APIs for the Eatinator app, including voting and image upload features.

## Features

- **Voting System**: Rate menu items with persistent vote storage
- **Image Upload**: Share photos of dishes with 24-hour retention
- **Security**: Multiple validation layers and automatic cleanup
- **Docker Support**: Containerized nginx +## Troubleshooting

### Common Issues

*   **400 "plain HTTP request was sent to HTTPS port"**
    *   Use `https://…` for your TLS listener (e.g., `curl -k https://127.0.0.1:7743/...`) or hit the HTTP port.

*   **Blank response from API endpoints**
    *   `nginx` might be serving `.php` as static. Ensure the `location ~ ^/api/.*\.php$` block exists and `fastcgi_pass` points to `lunchinator-php:9000`.

*   **Voting: `{"success":false,"error":"Failed to save votes"}`**
    *   Permissions issue with votes_data. Run `chown -R 33:33 www/api/votes_data && chmod -R 775 …` on the host.

*   **Image Upload: "Failed to save image" or 413 errors**
    *   Check `client_max_body_size` in nginx config (should be >5MB)
    *   Verify `upload_max_filesize` and `post_max_size` in PHP config
    *   Ensure images_data directory has write permissions: `chown -R 33:33 www/api/images_data`

*   **Images not being cleaned up**
    *   Verify cron job is running and calling the cleanup endpoint
    *   Check server logs for cleanup errors
    *   Manually test: `curl "http://localhost:7780/api/images.php"`

*   **502 Bad Gateway**
    *   `nginx` cannot reach `php-fpm`. Check that:
      - Both containers are running
      - Both are on the `lunchinet` network
      - `fastcgi_pass` is set to `lunchinator-php:9000`

### File Permissions Quick Fix
```bash
cd ~/nginx/lunchinator/www/api
sudo chown -R 33:33 votes_data images_data
sudo chmod -R 775 votes_data images_data
```p

## Data Storage

- **Votes**: Stored in `www/api/votes_data/` as JSON files
- **Images**: Stored in `www/api/images_data/` with automatic 24-hour cleanup
- **File-based**: No database required, simple JSON storage

You have two ways to run the APIs:

*   **Option A (recommended & implemented below):** `nginx` container + external `php-fpm` container
*   **Option B:** standalone PHP (shared hosting) or Node.js microservice (optional)

---

### Directory layout (host)
```
~/nginx/lunchinator/
├── nginx/                 # nginx config (from linuxserver/nginx image)
│   ├── site-confs/
│   │   └── default.conf   # <-- server config (see below)
│   └── ssl.conf           # tls/http3 config included by the image
├── php/
│   └── php-local.ini
└── www/                   # site root served by nginx
    ├── index.html
    ├── manifest.json
    ├── icons/...
    └── api/
        ├── votes.php      # Voting API
        ├── images.php     # Image upload API
        ├── votes_data/    # Vote storage (auto-created)
        ├── images_data/   # Image storage (auto-created)
        └── votes.js       # Node.js API (alternative)
```

### Frontend configuration
In your JavaScript config files:

```javascript
// Voting configuration
const VOTING_CONFIG = {
  apiUrl: '/api/votes.php',
  enabled: true,
  timeout: 5000
};

// Image upload configuration
const IMAGE_CONFIG = {
  apiUrl: '/api/images.php',
  enabled: true,
  maxSize: 5 * 1024 * 1024,        // 5MB max file size
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  timeout: 10000
};
```

---

## Option A — nginx (container) + php-fpm (container)

#### 1) Create a shared Docker network
```bash
cd ~/nginx/lunchinator
docker network create lunchinet || true
```

#### 2) Start php-fpm container
Mount the site to `/var/www/html` inside php:

```bash
docker run -d \
  --name lunchinator-php \
  --network lunchinet \
  -v "$PWD/www":/var/www/html \
  -v "$PWD/php/php-local.ini":/usr/local/etc/php/conf.d/php-local.ini:ro \
  -e PHP_MEMORY_LIMIT=256M \
  php:8.3-fpm
```
Confirm it’s ready:
```bash
docker logs -f lunchinator-php  # should show “ready to handle connections”
```

#### 3) Attach nginx container to the same network
Your nginx container is named `Nginx-LUNCHINATOR`:
```bash
docker network connect lunchinet Nginx-LUNCHINATOR
```
The `linuxserver/nginx` image maps host `~/nginx/lunchinator` to `/config` inside the container.

The server block (below) serves from `/app/www/public` if present, otherwise `/config/www` — which matches your host `~/nginx/lunchinator/www`.

#### 4) Install the nginx config
Save the following as:
**`~/nginx/lunchinator/nginx/site-confs/default.conf`**

```nginx
## lunchinator nginx + external php-fpm (SPA + /api/votes.php)
## Assumes:
##   - nginx container has site files at /app/www/public (preferred) or /config/www
##   - php-fpm container name: lunchinator-php, listens on port 9000
##   - php-fpm sees the same site files at /var/www/html
## Host ports (example): 7780->80 (HTTP), 7743->443 (HTTPS)

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

    # --- SPA ---
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

        # Small requests for votes, larger for image uploads
        client_max_body_size 6m;

        # No cache for dynamic responses
        add_header Cache-Control "no-store" always;
    }

    # --- Static assets caching ---
    location ~* \.(?:css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json)$ {
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
    }

    # --- Security: block hidden files ---
    location ~ /\.ht {
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

    # --- SPA ---
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

        client_max_body_size 6m;
        add_header Cache-Control "no-store" always;
    }

    # --- Static assets caching ---
    location ~* \.(?:css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json)$ {
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
    }

    # --- Security: block hidden files ---
    location ~ /\.ht {
        deny all;
    }
}
```
Reload nginx:
```bash
docker exec Nginx-LUNCHINATOR nginx -t
docker exec Nginx-LUNCHINATOR nginx -s reload
```

#### 5) Ensure write permissions for data storage
Inside the host:
```bash
cd ~/nginx/lunchinator/www/api
mkdir -p votes_data images_data

# php-fpm (Debian/Alpine) runs as www-data, uid:gid often 33:33
docker exec lunchinator-php sh -c 'id -u www-data; id -g www-data'

# Use those numbers (usually 33:33):
sudo chown -R 33:33 votes_data images_data
sudo chmod -R 775 votes_data images_data

# Create .htaccess for image directory security
cat > images_data/.htaccess << 'EOF'
# Prevent execution of any scripts in this directory
<Files "*">
    SetHandler default-handler
</Files>
Options -ExecCGI
RemoveHandler .cgi .php .pl .py .sh
EOF
```

#### 6) Set up image cleanup (24-hour retention)
The image upload feature automatically deletes images older than 24 hours. Set up a cron job to trigger cleanup:

**Option A: Server Cron Job**
```bash
# Add to crontab (crontab -e)
0 * * * * curl -s "http://localhost:7780/api/images.php" > /dev/null 2>&1
```

**Option B: Docker Cleanup Container**
```bash
# Create cleanup script
cat > cleanup.sh << 'EOF'
#!/bin/bash
while true; do
    sleep 3600  # Wait 1 hour
    curl -s "http://lunchinator-nginx/api/images.php" > /dev/null 2>&1
done
EOF

chmod +x cleanup.sh

# Run cleanup container
docker run -d \
  --name lunchinator-cleanup \
  --network lunchinet \
  -v "$PWD/cleanup.sh:/cleanup.sh" \
  alpine/curl:latest \
  sh /cleanup.sh
```

#### 7) Test APIs (HTTP & HTTPS)
If your host maps `Nginx-LUNCHINATOR` ports as `7780->80` and `7743->443`:

**Test Voting API:**
```bash
# GET vote counts
curl "http://127.0.0.1:7780/api/votes.php?action=get&key=vote_2025-08-28_lunch_pasta_menu"

# POST a vote
curl -X POST -H "Content-Type: application/json" \
  -d '{"action":"vote","key":"vote_2025-08-28_lunch_pasta_menu","voteType":"good","userId":"user_123"}' \
  "http://127.0.0.1:7780/api/votes.php"
```

**Test Image Upload API:**
```bash
# Upload an image (replace with actual image file)
curl -X POST \
  -F "key=img_2025-08-28_pasta_menu" \
  -F "image=@test-image.jpg" \
  "http://127.0.0.1:7780/api/images.php"

# Get uploaded images
curl "http://127.0.0.1:7780/api/images.php?key=img_2025-08-28_pasta_menu"

# Trigger cleanup
curl "http://127.0.0.1:7780/api/images.php"
```

**HTTPS Testing:**
```bash
# Use -k if you have a self-signed cert
curl -k "https://127.0.0.1:7743/api/votes.php?action=get&key=vote_2025-08-28_lunch_pasta_menu"
curl -k "https://127.0.0.1:7743/api/images.php?key=img_2025-08-28_pasta_menu"
```

**Expected Results:**
- Vote files appear under `www/api/votes_data/`:
  ```
  vote_2025-08-28_lunch_...json
  user_user_123.json
  ```
- Image files appear under `www/api/images_data/`:
  ```
  img_2025-08-28_pasta_menu/
  ├── metadata.json
  └── timestamp_hash.jpg
  ```

---

## Option B — Standalone PHP (shared hosting)
Copy `www/*` to your web root and ensure PHP is enabled.

The API will be reachable at `/api/votes.php`. Grant write access to `/api/votes_data/`.

Minimal `nginx+php-fpm` (single machine) example:
```nginx
location /api/ {
  try_files $uri $uri/ =404;
  location ~ \.php$ {
    include fastcgi_params;
    fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
  }
}
```

#### Optional — Node.js API
Run the Node API (`api/votes.js`) instead of PHP:
```bash
docker run -d \
  --name lunchinator-node \
  --network lunchinet \
  -v "$PWD/www/api":/app \
  -w /app \
  -e PORT=3001 \
  node:20 \
  sh -c 'node votes.js'
```
`nginx` proxy:```nginx
location /api/ {
    proxy_pass http://lunchinator-node:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```
Set `VOTING_CONFIG.apiUrl` accordingly (e.g., `/api`).

---

## Data Storage

### Voting System
Votes are stored as JSON in `www/api/votes_data/`:
*   `vote_YYYY-MM-DD_<category>_<dish>_<menutype>.json` — vote counters
*   `user_<userid>.json` — which items a user has voted on

### Image Upload System
Images are stored in `www/api/images_data/` with the following structure:
```
images_data/
├── img_YYYY-MM-DD_<dish>_<menutype>/
│   ├── metadata.json           # Upload timestamps and file info
│   ├── timestamp_hash.jpg      # Actual image files
│   └── ...
└── .htaccess                   # Security protection
```

**Retention Policy**: Images are automatically deleted after 24 hours to save storage space.

## Security Features

### Voting Security
*   Server-side duplicate vote prevention
*   Per-user vote cap (`$maxVotesPerUser = 10`)
*   Input sanitization and validation
*   CORS headers enabled for cross-origin requests

### Image Upload Security
*   **File Validation**: MIME type and content validation using `getimagesize()`
*   **Extension Whitelisting**: Only .jpg, .jpeg, .png, .webp allowed
*   **Size Limits**: Maximum 5MB per image
*   **Secure Naming**: Random filenames prevent directory traversal
*   **Script Prevention**: .htaccess prevents execution of uploaded files
*   **Content-Type Headers**: Proper image headers when serving files
*   **24-Hour Cleanup**: Automatic deletion prevents storage abuse

### General Security
*   SPA falls back to `localStorage` if APIs are unreachable
*   Input sanitization across all endpoints
*   Error messages don't expose system details

---

## Troubleshooting

*   **400 “plain HTTP request was sent to HTTPS port”**
    *   Use `https://…` for your TLS listener (e.g., `curl -k https://127.0.0.1:7743/...`) or hit the HTTP port.

*   **Blank response from `/api/votes.php`**
    *   `nginx` might be serving `.php` as static. Ensure the `location ~ ^/api/.*\.php$` block exists and `fastcgi_pass` points to `lunchinator-php:9000`.

*   **`{"success":false,"error":"Failed to save votes"}`**
    *   It’s a permissions issue. Run `chown -R 33:33 www/api/votes_data && chmod -R 775 …` on the host.

*   **502 Bad Gateway**
    *   `nginx` cannot reach `php-fpm`. Check that the container is running, both are on the `lunchinet` network, and `fastcgi_pass` is set to `lunchinator-php:9000`.

---

## API Documentation

### Voting API (`/api/votes.php`)

#### `GET /api/votes.php?action=get&key=<voteKey>`
Returns current vote counts for a menu item.

**Response:**
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

#### `POST /api/votes.php`
Submit a vote for a menu item.

**Request Body:**
```json
{
  "action": "vote",
  "key": "vote_2025-08-28_lunch_pasta_menu",
  "voteType": "good|neutral|bad",
  "userId": "user_12345"
}
```

**Response:**
```json
{
  "success": true,
  "votes": {
    "good": 6,
    "neutral": 2,
    "bad": 1
  }
}
```

### Image Upload API (`/api/images.php`)

#### `POST /api/images.php` - Upload Image
Upload an image for a menu item.

**Request (multipart/form-data):**
```bash
curl -X POST \
  -F "key=img_2025-08-28_pasta_menu" \
  -F "image=@photo.jpg" \
  "/api/images.php"
```

**Response:**
```json
{
  "success": true,
  "filename": "20250828_143022_a1b2c3.jpg",
  "message": "Image uploaded successfully"
}
```

#### `GET /api/images.php?key=<imageKey>` - List Images
Get all images for a menu item.

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "filename": "20250828_143022_a1b2c3.jpg",
      "timestamp": "2025-08-28 14:30:22",
      "url": "/api/images.php?action=view&key=img_2025-08-28_pasta_menu&file=20250828_143022_a1b2c3.jpg"
    }
  ]
}
```

#### `GET /api/images.php?action=view&key=<imageKey>&file=<filename>` - View Image
Display an uploaded image.

**Response:** Raw image data with proper Content-Type headers.

#### `GET /api/images.php` - Cleanup Trigger
Triggers cleanup of images older than 24 hours (used by cron jobs).

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed",
  "deleted": ["img_2025-08-27_pasta_menu"]
}
```

### Error Responses
All endpoints return error responses in this format:
```json
{
  "success": false,
  "error": "Error description"
}
```

### Key Formats
- **Vote keys**: `vote_YYYY-MM-DD_<category>_<dish>_<menutype>`
- **Image keys**: `img_YYYY-MM-DD_<dish>_<menutype>`
- **User IDs**: `user_<unique_identifier>`