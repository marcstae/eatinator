# Deployment with GitHub Container Registry (GHCR)

This document describes how to deploy Eatinator using pre-built Docker images from GitHub Container Registry (GHCR) instead of building locally.

## Prerequisites

- Docker installed on your deployment VM
- Access to GitHub Container Registry

## Login to GHCR

### 1. Create a Personal Access Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "GHCR Access for Eatinator"
4. Select the following scopes:
   - `read:packages` (to pull images)
   - `write:packages` (if you need to push images)
5. Copy the generated token

### 2. Login to GHCR

```bash
# Login to GitHub Container Registry
echo "YOUR_PERSONAL_ACCESS_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Replace:
- `YOUR_PERSONAL_ACCESS_TOKEN` with the token from step 1
- `YOUR_GITHUB_USERNAME` with your GitHub username

## Pull and Run Images

### Available Images

The CI/CD pipeline builds and pushes the following images:

- **Frontend**: `ghcr.io/marcstae/eatinator/frontend:latest`
- **API**: `ghcr.io/marcstae/eatinator/api:latest`

### Pull Images

```bash
# Pull the latest images
docker pull ghcr.io/marcstae/eatinator/frontend:latest
docker pull ghcr.io/marcstae/eatinator/api:latest
```

### Run with Docker Compose

Create a `docker-compose.prod.yml` file:

```yaml
version: '3.8'

services:
  eatinator-api:
    image: ghcr.io/marcstae/eatinator/api:latest
    container_name: eatinator-api
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  eatinator-frontend:
    image: ghcr.io/marcstae/eatinator/frontend:latest
    container_name: eatinator-frontend
    ports:
      - "8000:80"
    depends_on:
      - eatinator-api
    restart: unless-stopped

networks:
  default:
    name: eatinator-network
```

### Deploy

```bash
# Create data directory
mkdir -p ./data

# Start the application
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Updating to New Versions

When new versions are released, update your deployment:

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Recreate containers with new images
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images (optional)
docker image prune -f
```

## Version-Specific Deployment

To deploy a specific version instead of `latest`:

```bash
# Replace 'latest' with a specific version tag
docker pull ghcr.io/marcstae/eatinator/frontend:v1.0.0
docker pull ghcr.io/marcstae/eatinator/api:v1.0.0
```

Update the `docker-compose.prod.yml` to use the specific version tags.

## Troubleshooting

### Authentication Issues

If you get authentication errors:

```bash
# Check if you're logged in
docker system info | grep Username

# Re-login if needed
docker logout ghcr.io
echo "YOUR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### Image Pull Issues

If images fail to pull:

1. Verify the repository exists and is public, or you have access
2. Check that the image tags exist in the registry
3. Ensure your token has `read:packages` permission

### Service Issues

```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs eatinator-api
docker-compose -f docker-compose.prod.yml logs eatinator-frontend

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Check health status
curl http://localhost:8080/health
curl http://localhost:8000/
```

## Security Notes

- Store your Personal Access Token securely
- Use minimal required permissions (read:packages for deployment)
- Consider using environment variables or secrets management for tokens
- Regularly rotate your access tokens

## Automated Updates

Consider setting up automated updates using tools like:

- **Watchtower**: Automatically updates containers when new images are available
- **Renovate**: Creates PRs for dependency updates
- **GitHub Actions**: Custom automation workflows

Example Watchtower setup:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 30 \
  eatinator-api eatinator-frontend
```