#!/bin/bash

# Setup Cloudflare Pages deployment for Eatinator frontend
# This script automates the setup and deployment to Cloudflare Pages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Cloudflare Pages deployment for Eatinator${NC}"
echo "=================================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Please login to Cloudflare first:${NC}"
    echo "wrangler auth login"
    exit 1
fi

echo -e "${GREEN}✅ Wrangler CLI found and logged in${NC}"

# Get worker URL if it exists
WORKER_URL=""
if [ -f "wrangler.toml" ]; then
    WORKER_NAME=$(grep "^name" wrangler.toml | cut -d'"' -f2 | cut -d"'" -f2)
    if [ ! -z "$WORKER_NAME" ]; then
        echo -e "${BLUE}📡 Detected Worker: $WORKER_NAME${NC}"
        # Try to get the worker URL
        WORKER_URL=$(wrangler subdomain list 2>/dev/null | grep -o "[a-zA-Z0-9-]*\.workers\.dev" | head -1)
        if [ ! -z "$WORKER_URL" ]; then
            WORKER_URL="https://$WORKER_NAME.$WORKER_URL"
            echo -e "${GREEN}✅ Worker URL: $WORKER_URL${NC}"
        fi
    fi
fi

# Create Cloudflare Pages project if it doesn't exist
echo -e "${BLUE}📄 Setting up Cloudflare Pages project...${NC}"
if ! wrangler pages project list | grep -q "eatinator"; then
    echo -e "${YELLOW}⚠️  Creating new Pages project 'eatinator'...${NC}"
    wrangler pages project create eatinator --compatibility-date=2024-01-01
    echo -e "${GREEN}✅ Pages project 'eatinator' created${NC}"
else
    echo -e "${GREEN}✅ Pages project 'eatinator' already exists${NC}"
fi

# Update configuration with Worker URL if available
if [ ! -z "$WORKER_URL" ]; then
    echo -e "${BLUE}🔧 Updating frontend configuration with Worker URL...${NC}"
    
    # Update js/config.js with the actual Worker URL
    if [ -f "js/config.js" ]; then
        # Create a backup
        cp js/config.js js/config.js.backup
        
        # Replace the placeholder URL with the actual Worker URL
        sed -i.tmp "s|https://eatinator-api\.your-domain\.workers\.dev|$WORKER_URL|g" js/config.js
        rm -f js/config.js.tmp
        
        echo -e "${GREEN}✅ Frontend configuration updated${NC}"
    fi
    
    # Update _redirects with the actual Worker URL
    if [ -f "_redirects" ]; then
        # Create a backup
        cp _redirects _redirects.backup
        
        # Replace the placeholder URL with the actual Worker URL
        sed -i.tmp "s|https://eatinator-api\.your-domain\.workers\.dev|$WORKER_URL|g" _redirects
        rm -f _redirects.tmp
        
        echo -e "${GREEN}✅ Redirects configuration updated${NC}"
    fi
fi

# Deploy to Cloudflare Pages
echo -e "${BLUE}📤 Deploying to Cloudflare Pages...${NC}"
wrangler pages deploy . --project-name eatinator --compatibility-date=2024-01-01

# Get the deployment URL
PAGES_URL=$(wrangler pages deployment list --project-name eatinator --limit 1 | grep -o "https://[a-zA-Z0-9-]*\.eatinator\.pages\.dev" | head -1)
if [ -z "$PAGES_URL" ]; then
    # Fallback pattern
    PAGES_URL=$(wrangler pages deployment list --project-name eatinator --limit 1 | grep -o "https://[a-zA-Z0-9-]*\.pages\.dev" | head -1)
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Frontend URL:${NC} ${PAGES_URL:-'Check Cloudflare Dashboard'}"
if [ ! -z "$WORKER_URL" ]; then
    echo -e "${BLUE}🔧 Backend URL:${NC} $WORKER_URL"
fi
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Visit the frontend URL to test the application"
echo "2. Verify all API endpoints are working"
echo "3. Test PWA installation on mobile devices"
echo "4. Configure custom domain if needed"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo "- Deploy updates: npm run deploy:pages"
echo "- View logs: npm run logs:pages"
echo "- Local dev: npm run pages:dev"
echo ""

# Restore backups if they exist
if [ -f "js/config.js.backup" ]; then
    echo -e "${YELLOW}📝 Configuration backups created:${NC}"
    echo "  - js/config.js.backup"
    if [ -f "_redirects.backup" ]; then
        echo "  - _redirects.backup"
    fi
    echo "Use these to restore original configurations if needed."
fi