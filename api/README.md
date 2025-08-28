# Server-side Voting Setup (Dockerized nginx + PHP-FPM)
This directory contains the server-side voting API for the Eatinator app.

Votes are stored on disk in `www/api/votes_data/` as JSON files.
You have two ways to run the API:

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
        ├── votes.php      # PHP API (used in production)
        ├── votes.js       # Node.js API (alternative)
        └── votes_data/    # JSON storage (auto-created)
```

### Frontend configuration
In `www/index.html`:

```javascript
const VOTING_CONFIG = {
  apiUrl: '/api/votes.php',
  enabled: true,
  timeout: 5000
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

        # Small requests (votes API is tiny)
        client_max_body_size 1m;

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

        client_max_body_size 1m;
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

#### 5) Ensure write permissions for vote storage
Inside the host:
```bash
cd ~/nginx/lunchinator/www/api
mkdir -p votes_data

# php-fpm (Debian/Alpine) runs as www-data, uid:gid often 33:33
docker exec lunchinator-php sh -c 'id -u www-data; id -g www-data'

# Use those numbers (usually 33:33):
sudo chown -R 33:33 votes_data
sudo chmod -R 775 votes_data
```

#### 6) Test (HTTP & HTTPS)
If your host maps `Nginx-LUNCHINATOR` ports as `7780->80` and `7743->443`:
```bash
# GET counts
curl "http://127.0.0.1:7780/api/votes.php?action=get&key=vote_2025-08-28_lunch_pasta_menu"

# POST a vote
curl -X POST -H "Content-Type: application/json" \
  -d '{"action":"vote","key":"vote_2025-08-28_lunch_pasta_menu","voteType":"good","userId":"user_123"}' \
  "http://127.0.0.1:7780/api/votes.php"

# HTTPS (use -k if you have a self-signed cert)
curl -k "https://127.0.0.1:7743/api/votes.php?action=get&key=vote_2025-08-28_lunch_pasta_menu"
```
You should see files appear under `www/api/votes_data/`, e.g.:
```
vote_2025-08-28_lunch_...json
user_user_123.json
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
Votes are stored as JSON in `www/api/votes_data/`:

*   `vote_YYYY-MM-DD_<category>_<dish>_<menutype>.json` — vote counters
*   `user_<userid>.json` — which items a user has voted on

## Security Features
*   Server-side duplicate vote prevention
*   Per-user vote cap (`$maxVotesPerUser = 10`)
*   Input sanitization
*   CORS headers enabled in `votes.php`
*   SPA falls back to `localStorage` if the API is unreachable

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

## API (PHP)

#### `GET /api/votes.php?action=get&key=<voteKey>`
Returns:
```json
{
  "success": true,
  "votes": {
    "good": 0,
    "neutral": 0,
    "bad": 0
  }
}
```

#### `POST /api/votes.php`
Body:
```json
{
  "action": "vote",
  "key": "...",
  "voteType": "good|neutral|bad",
  "userId": "user_..."
}
```