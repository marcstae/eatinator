# Image Upload Setup and Maintenance

This document describes how to set up and maintain the image upload feature for the Eatinator app.

## Setup

The image upload feature requires the same server setup as the voting system. Images are stored in `api/images_data/` with a 24-hour retention policy.

## Security

The image upload feature includes multiple security layers to prevent malicious file uploads:

### File Validation
- **MIME Type Validation**: Checks uploaded file MIME type
- **Content Validation**: Uses `getimagesize()` to verify files are actual images
- **Extension Whitelisting**: Only allows .jpg, .jpeg, .png, .webp extensions
- **Secure Filename Generation**: Never uses user-provided file extensions

### Upload Protection
- **File Size Limits**: Maximum 5MB per image
- **Type Enforcement**: Files are validated as real images, not just by extension
- **Safe Storage**: Uploaded files get secure, randomly generated names

### Execution Prevention
- **.htaccess Protection**: Prevents execution of any scripts in the images directory
- **Extension Mapping**: File extensions are determined from actual image content
- **Content-Type Headers**: Proper image content-type headers are set when serving files

### Directory Structure

```
api/
├── images.php          # Image upload API
├── images_data/        # Image storage (auto-created)
│   ├── img_YYYY-MM-DD_dish_menu/
│   │   ├── metadata.json
│   │   ├── timestamp_hash.jpg
│   │   └── ...
│   └── ...
└── votes_data/         # Voting data
```

### Permissions

Ensure the web server can write to the images directory:

```bash
cd ~/nginx/lunchinator/www/api
mkdir -p images_data

# For nginx + php-fpm (usually www-data with uid:gid 33:33)
docker exec lunchinator-php sh -c 'id -u www-data; id -g www-data'
sudo chown -R 33:33 images_data
sudo chmod -R 775 images_data
```

## 24-Hour Cleanup (Cron Job)

To automatically clean up images older than 24 hours, set up a cron job that calls the cleanup endpoint.

### Option 1: Server Cron Job

Add this to your server's crontab to run cleanup every hour:

```bash
# Add to crontab (crontab -e)
0 * * * * curl -s "http://localhost/api/images.php" > /dev/null 2>&1
```

For HTTPS setup:
```bash
0 * * * * curl -s -k "https://localhost/api/images.php" > /dev/null 2>&1
```

### Option 2: External Monitoring Service

Use a service like UptimeRobot, Pingdom, or similar to ping the API endpoint every hour:
- URL: `https://your-domain.com/api/images.php`
- Interval: 60 minutes
- Method: GET

### Option 3: Docker Cron Container

Create a dedicated cleanup container:

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

## API Endpoints

### Upload Image
```bash
POST /api/images.php
Content-Type: multipart/form-data

key=img_2025-08-29_pasta_menu
image=<file>
```

### Get Images
```bash
GET /api/images.php?key=img_2025-08-29_pasta_menu
```

### View Image
```bash
GET /api/images.php?action=view&key=img_2025-08-29_pasta_menu&file=filename.jpg
```

## Configuration

In `index.html`, the image upload feature can be configured:

```javascript
const IMAGE_CONFIG = {
    apiUrl: '/api/images.php',
    enabled: true,                    // Set to false to disable image features
    maxSize: 5 * 1024 * 1024,        // 5MB max file size
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    timeout: 10000                    // 10 second timeout for uploads
};
```

## Troubleshooting

### Upload Fails
- Check file permissions on `images_data/` directory
- Verify `client_max_body_size` in nginx config (should be > 5MB)
- Check PHP upload limits: `upload_max_filesize` and `post_max_size`

### Images Not Cleaning Up
- Verify cron job is running
- Check server logs for cleanup errors
- Manually test cleanup by calling the API endpoint

### Storage Usage
- Each image is limited to 5MB
- Images are automatically deleted after 24 hours
- Typical usage: ~10-50 images per day, ~50-250MB daily storage