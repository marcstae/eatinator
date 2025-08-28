# Server-side Voting Setup

This directory contains the server-side voting API for the Eatinator. Choose one of the following options based on your server setup.

## Option 1: PHP (Recommended for shared hosting)

The `votes.php` file provides a simple API that works with most web hosting providers.

### Setup:
1. Upload the entire `api` folder to your web server
2. Ensure PHP is enabled on your server
3. Make sure the web server can write to the `api` directory (for vote data storage)
4. The API will be available at: `https://yourdomain.com/api/votes.php`

### Requirements:
- PHP 7.0 or higher
- Write permissions in the `api` directory

## Option 2: Node.js

The `votes.js` file provides the same functionality using Node.js.

### Setup:
1. Install Node.js on your server
2. Upload the `votes.js` file to your server
3. Run: `node votes.js`
4. The API will be available at: `http://yourlocalhost:3001`

### Requirements:
- Node.js 12.0 or higher

## Option 3: Nginx + PHP-FPM

For optimal performance with nginx, configure PHP-FPM:

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

## Configuration

If you need to change the API endpoint, update the `VOTING_CONFIG.apiUrl` in `index.html`:

```javascript
const VOTING_CONFIG = {
    apiUrl: '/api/votes.php', // Change this to your API endpoint
    enabled: true,
    timeout: 5000
};
```

## Data Storage

Votes are stored in JSON files in the `api/votes_data/` directory:
- `vote_YYYY-MM-DD_category_dishname_menutype.json` - Contains vote counts
- `user_userid.json` - Tracks which items each user has voted on

## Security Features

- Rate limiting: Maximum 10 votes per user
- Input sanitization
- CORS headers for web security
- Duplicate vote prevention

## Fallback Behavior

If the server API is unavailable, the system automatically falls back to localStorage-only voting for offline functionality.

## Testing

To test the API:

```bash
# Get votes for an item
curl "http://localhost:3001?action=get&key=vote_2025-08-28_lunch_pasta_menu"

# Cast a vote
curl -X POST -H "Content-Type: application/json" \
     -d '{"action":"vote","key":"vote_2025-08-28_lunch_pasta_menu","voteType":"good","userId":"user_123"}' \
     http://localhost:3001
```