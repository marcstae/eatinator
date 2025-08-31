#!/bin/bash
# GHCR Login Script for Production Deployment
# Usage: ./ghcr-login.sh

set -e

echo "🔑 GitHub Container Registry Login Script"
echo "========================================"

# Check if required environment variables are set
if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "Please set:"
    echo "  export GITHUB_USERNAME=your-github-username"
    echo "  export GITHUB_TOKEN=your-personal-access-token"
    echo ""
    echo "To create a token:"
    echo "1. Go to GitHub Settings → Developer settings → Personal access tokens"
    echo "2. Create token with 'read:packages' scope"
    echo "3. Save token securely"
    exit 1
fi

echo "🔐 Logging in to GitHub Container Registry..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

if [ $? -eq 0 ]; then
    echo "✅ Successfully logged in to GHCR"
    echo "📦 You can now pull Eatinator images:"
    echo "   docker pull ghcr.io/marcstae/eatinator/api:latest"
    echo "   docker pull ghcr.io/marcstae/eatinator/frontend:latest"
    echo ""
    echo "🚀 Start deployment with:"
    echo "   docker compose -f docker-compose.prod.yml up -d"
else
    echo "❌ Login failed. Please check your credentials."
    exit 1
fi