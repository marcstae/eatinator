#!/bin/bash
# Setup script for Cloudflare services required by Eatinator

set -e

echo "🚀 Setting up Eatinator Serverless Infrastructure"
echo "================================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "   wrangler auth login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"

# Create KV namespace for voting data
echo "📦 Creating KV namespace for voting data..."
KV_PROD_ID=$(wrangler kv:namespace create "VOTING_KV" --preview false | grep -o 'id = "[^"]*"' | cut -d'"' -f2 || echo "")
KV_PREVIEW_ID=$(wrangler kv:namespace create "VOTING_KV" --preview true | grep -o 'id = "[^"]*"' | cut -d'"' -f2 || echo "")

if [ -n "$KV_PROD_ID" ] && [ -n "$KV_PREVIEW_ID" ]; then
    echo "✅ KV namespace created"
    echo "   Production ID: $KV_PROD_ID"
    echo "   Preview ID: $KV_PREVIEW_ID"
else
    echo "⚠️  Could not create KV namespace automatically. Please create manually:"
    echo "   wrangler kv:namespace create \"VOTING_KV\""
    echo "   wrangler kv:namespace create \"VOTING_KV\" --preview"
fi

# Create D1 database
echo "🗄️  Creating D1 database for relational data..."
D1_OUTPUT=$(wrangler d1 create eatinator-voting 2>&1 || echo "")
D1_ID=$(echo "$D1_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2 || echo "")

if [ -n "$D1_ID" ]; then
    echo "✅ D1 database created"
    echo "   Database ID: $D1_ID"
    echo "   Name: eatinator-voting"
else
    echo "⚠️  Could not create D1 database automatically. Please create manually:"
    echo "   wrangler d1 create eatinator-voting"
fi

# Create R2 bucket
echo "🪣 Creating R2 bucket for image storage..."
R2_OUTPUT=$(wrangler r2 bucket create eatinator-images 2>&1 || echo "")

if echo "$R2_OUTPUT" | grep -q "success"; then
    echo "✅ R2 bucket created"
    echo "   Bucket name: eatinator-images"
else
    echo "⚠️  Could not create R2 bucket automatically. Please create manually:"
    echo "   wrangler r2 bucket create eatinator-images"
fi

# Update wrangler.toml with actual IDs
echo "📝 Updating wrangler.toml configuration..."

if [ -n "$KV_PROD_ID" ] && [ -n "$KV_PREVIEW_ID" ]; then
    sed -i.bak "s/preview_id = \"voting_preview\"/preview_id = \"$KV_PREVIEW_ID\"/g" wrangler.toml
    sed -i.bak "s/id = \"voting_production\"/id = \"$KV_PROD_ID\"/g" wrangler.toml
fi

if [ -n "$D1_ID" ]; then
    sed -i.bak "s/database_id = \"voting_database_id\"/database_id = \"$D1_ID\"/g" wrangler.toml
fi

# Initialize D1 database schema
if [ -n "$D1_ID" ]; then
    echo "🔧 Initializing D1 database schema..."
    if wrangler d1 execute eatinator-voting --file=workers/schema.sql; then
        echo "✅ Database schema initialized"
    else
        echo "⚠️  Could not initialize database schema. Run manually:"
        echo "   wrangler d1 execute eatinator-voting --file=workers/schema.sql"
    fi
fi

echo ""
echo "🎉 Cloudflare setup completed!"
echo ""
echo "Next steps:"
echo "1. Review and update wrangler.toml with any missing IDs"
echo "2. Set up secrets (optional):"
echo "   wrangler secret put TURNSTILE_SECRET_KEY"
echo "3. Deploy the Worker:"
echo "   npm run deploy"
echo ""
echo "📋 Configuration Summary:"
echo "   KV Namespace: $KV_PROD_ID (preview: $KV_PREVIEW_ID)"
echo "   D1 Database: $D1_ID"
echo "   R2 Bucket: eatinator-images"
echo ""
echo "🔗 Useful commands:"
echo "   npm run dev     - Start development server"
echo "   npm run deploy  - Deploy to production"
echo "   npm run logs    - View live logs"