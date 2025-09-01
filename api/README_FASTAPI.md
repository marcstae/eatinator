# FastAPI Backend Documentation

This document describes the new Python FastAPI backend that replaces the PHP implementation.

## Architecture

The new backend is built with:
- **FastAPI**: Modern Python web framework
- **SQLite**: Embedded database for data persistence
- **Pydantic**: Data validation and serialization
- **Pillow**: Image processing and validation

## Features

### Voting System
- Same API endpoints as PHP version (`/api/votes.php`)
- SQLite storage instead of JSON files
- User vote tracking and limits
- Duplicate vote prevention

### Image Upload System
- Same API endpoints as PHP version (`/api/images.php`)
- 24-hour automatic cleanup
- Image validation with Pillow
- Secure filename generation
- MIME type validation

### Security Features
- File type validation using actual image content (not just extensions)
- SQLite injection prevention with parameterized queries
- CORS support for cross-origin requests
- Automatic cleanup of old images
- **Cloudflare Turnstile Bot Protection**: Optional verification for write operations

### Cloudflare Turnstile Integration

All write endpoints (`POST /api/votes`, `POST /api/images`, `POST /api/ai`) support optional Turnstile verification:

- **Environment Variable**: Set `TURNSTILE_SECRET_KEY` to enable
- **Request Field**: Include `turnstileToken` in request body/form data
- **Graceful Fallback**: Disabled when secret key not provided
- **Error Response**: Returns `403 Forbidden` for invalid tokens

## API Endpoints

### Voting

**REST Endpoints (Recommended):**

#### GET /api/votes/{vote_key}
Get votes for a specific item.
```bash
curl "http://localhost:5694/api/votes/vote_key"
```

#### POST /api/votes
Cast a vote for an item.
```bash
curl -X POST "http://localhost:5694/api/votes" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "vote_key", 
    "voteType": "good",
    "userId": "user_123",
    "turnstileToken": "optional-turnstile-token"
  }'
```

**Legacy Endpoints (Backward Compatibility):**

#### GET /api/votes.php
Get votes for a specific item (legacy).
```bash
curl "http://localhost:5694/api/votes.php?key=vote_key"
```

#### POST /api/votes.php
Cast a vote for an item (legacy).
```bash
curl -X POST "http://localhost:5694/api/votes.php" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "vote",
    "key": "vote_key", 
    "voteType": "good",
    "userId": "user_123"
  }'
```

### Images

**REST Endpoints (Recommended):**

#### GET /api/images/{image_key}
Get images for a dish.
```bash
curl "http://localhost:5694/api/images/image_key"
```

#### GET /api/images/{image_key}/{filename}
Serve an image file.
```bash
curl "http://localhost:5694/api/images/image_key/filename.jpg"
```

#### POST /api/images
Upload an image.
```bash
curl -X POST "http://localhost:5694/api/images" \
  -F "key=image_key" \
  -F "image=@image.jpg" \
  -F "turnstileToken=optional-turnstile-token"
```

**Legacy Endpoints (Backward Compatibility):**

#### GET /api/images.php
Get images for a dish (legacy).
```bash
curl "http://localhost:5694/api/images.php?key=image_key"
```

#### GET /api/images.php?action=view
Serve an image file (legacy).
```bash
curl "http://localhost:5694/api/images.php?action=view&key=image_key&file=filename.jpg"
```

#### POST /api/images.php
Upload an image (legacy).
```bash
curl -X POST "http://localhost:5694/api/images.php" \
  -F "key=image_key" \
  -F "image=@image.jpg"
```

## Database Schema

### votes table
- `vote_key` (TEXT PRIMARY KEY): Unique identifier for the vote
- `good` (INTEGER): Number of good votes
- `neutral` (INTEGER): Number of neutral votes  
- `bad` (INTEGER): Number of bad votes
- `created_at` (TIMESTAMP): When vote record was created
- `updated_at` (TIMESTAMP): When vote was last updated

### user_votes table
- `user_id` (TEXT): User identifier
- `vote_key` (TEXT): Vote identifier
- `vote_type` (TEXT): Type of vote cast
- `created_at` (TIMESTAMP): When vote was cast
- PRIMARY KEY: (`user_id`, `vote_key`)

### images table
- `id` (INTEGER PRIMARY KEY): Auto-increment ID
- `dish_key` (TEXT): Identifier for the dish
- `filename` (TEXT): Generated filename
- `original_name` (TEXT): Original uploaded filename
- `file_path` (TEXT): Full path to stored file
- `upload_time` (INTEGER): Unix timestamp of upload
- `created_at` (TIMESTAMP): Database record creation time

## Deployment

### Local Development
```bash
cd api
pip install -r requirements.txt
python main.py
```

### Docker Deployment
```bash
docker-compose up -d
```

### Manual Docker Build
```bash
cd api
docker build -t eatinator-api .
docker run -d -p 5694:5694 -v $(pwd)/data:/app/data eatinator-api
```

## Configuration

Environment variables:
- `PYTHONUNBUFFERED=1`: Enable real-time logging
- Data directory is mounted as volume for persistence

## Migration from PHP

The FastAPI implementation maintains API compatibility with the PHP version:
- Same endpoint URLs
- Same request/response formats
- Same functionality (voting, image upload, 24h retention)

The main differences:
- SQLite database instead of JSON files
- Better error handling and logging
- Modern Python stack instead of PHP
- Improved security with Pydantic validation

## Health Check

```bash
curl http://localhost:5694/health
```

Returns:
```json
{
  "status": "healthy",
  "service": "eatinator-api"
}
```