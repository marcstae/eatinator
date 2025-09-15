# Eatinator Serverless Deployment Guide

This guide walks you through deploying Eatinator using Cloudflare Workers, KV, D1, and R2 for a completely serverless architecture.

## 🎯 Architecture Overview

The serverless setup uses:
- **Cloudflare Workers**: API endpoints and business logic
- **Cloudflare KV**: Fast key-value storage for voting data and caching
- **Cloudflare D1**: SQLite-compatible database for relational data
- **Cloudflare R2**: Object storage for image uploads
- **Static Site**: Frontend hosted on any CDN or static host

## 💰 Cost Estimation

With Cloudflare's generous free tiers, expected monthly cost is **$0** for typical usage:

- **Workers**: 100,000 requests/day free (3M/month)
- **KV**: 10GB storage + 100,000 reads/day free
- **D1**: 100,000 rows + 5GB storage free
- **R2**: 10GB storage + 1M Class A + 10M Class B operations free

## 🚀 Quick Deployment

### Prerequisites

1. **Cloudflare Account**: Free account at [cloudflare.com](https://cloudflare.com)
2. **Domain** (optional): For custom URLs
3. **Node.js**: v18+ for Wrangler CLI

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler auth login
```

### Step 3: Setup Infrastructure

```bash
# Clone the repository
git clone https://github.com/marcstae/eatinator.git
cd eatinator

# Run automated setup
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh
```

The setup script will:
- Create KV namespace for voting data
- Create D1 database for relational data
- Create R2 bucket for image storage
- Initialize database schema
- Update `wrangler.toml` with service IDs

### Step 4: Configure Environment

1. **Update wrangler.toml** with your preferred Worker name:
   ```toml
   name = "your-eatinator-api"  # Choose your worker name
   ```

2. **Set up Turnstile** (optional, for bot protection):
   ```bash
   wrangler secret put TURNSTILE_SECRET_KEY
   # Enter your Cloudflare Turnstile secret key
   ```

### Step 5: Deploy the Worker

```bash
# Deploy to production
npm run deploy

# Or deploy to staging environment
npm run deploy --env development
```

### Step 6: Update Frontend Configuration

1. **Get your Worker URL** from the deployment output
2. **Update `js/config.js`** with your Worker URL:
   ```javascript
   const VOTING_CONFIG = {
       apiUrl: 'https://your-eatinator-api.your-subdomain.workers.dev/api/votes',
       // ... other config
   };
   ```

### Step 7: Deploy Frontend

Deploy the frontend to any static hosting service:

**Cloudflare Pages** (recommended):
```bash
# Connect your GitHub repo to Cloudflare Pages
# or use Wrangler Pages
wrangler pages publish . --project-name eatinator
```

**Netlify**:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=.
```

**Vercel**:
```bash
npm install -g vercel
vercel --prod
```

## 🔧 Advanced Configuration

### Custom Domain

1. **Add domain to Cloudflare**
2. **Configure Worker route**:
   ```bash
   wrangler route put "api.yourdomain.com/*" your-eatinator-api
   ```
3. **Update frontend config** with custom domain

### Security Setup

1. **Turnstile Bot Protection**:
   ```bash
   # Set secret key
   wrangler secret put TURNSTILE_SECRET_KEY
   
   # Update frontend with site key
   window.TURNSTILE_SITE_KEY = "your-site-key";
   ```

2. **CORS Configuration**: Already configured for cross-origin requests

### Monitoring and Logs

```bash
# View live logs
npm run logs

# View analytics
wrangler analytics

# Check KV storage
wrangler kv:namespace list
```

## 🛠️ Development Workflow

### Local Development

```bash
# Start local development server
npm run dev

# Test scheduled functions
npm run test
```

### Database Management

```bash
# Execute SQL commands
wrangler d1 execute eatinator-voting --command="SELECT COUNT(*) FROM votes"

# Import data
wrangler d1 execute eatinator-voting --file=data.sql

# Backup database
wrangler d1 backup eatinator-voting
```

### Storage Management

```bash
# List R2 objects
wrangler r2 object list eatinator-images

# Upload objects
wrangler r2 object put eatinator-images/test.jpg --file=test.jpg

# List KV keys
wrangler kv:key list --namespace-id=your-kv-id
```

## 📊 Monitoring and Maintenance

### Health Checks

- **Worker Health**: `https://your-worker.workers.dev/health`
- **AI Health**: `https://your-worker.workers.dev/api/ai/health`
- **Statistics**: `https://your-worker.workers.dev/api/stats/votes`

### Automatic Cleanup

- **Images**: Automatically deleted after 24 hours
- **Scheduled Cleanup**: Runs daily via Cloudflare Cron Triggers
- **Manual Cleanup**: `POST /api/admin/cleanup`

### Cost Monitoring

Monitor usage in Cloudflare Dashboard:
- **Workers**: Analytics → Workers
- **KV**: Storage → KV
- **D1**: Storage → D1
- **R2**: Storage → R2

## 🔒 Security Best Practices

1. **Use Turnstile**: Prevent automated abuse
2. **Rate Limiting**: Built-in protection against spam
3. **Input Validation**: All inputs sanitized and validated
4. **Secure Headers**: CORS and security headers configured
5. **Secret Management**: Use Wrangler secrets for sensitive data

## 🐛 Troubleshooting

### Common Issues

**Worker deployment fails**:
```bash
# Check wrangler configuration
wrangler config

# Validate wrangler.toml
wrangler deploy --dry-run
```

**Database connection issues**:
```bash
# Test D1 connection
wrangler d1 execute eatinator-voting --command="SELECT 1"

# Re-initialize schema
wrangler d1 execute eatinator-voting --file=workers/schema.sql
```

**CORS errors**:
- Ensure Worker URL is correctly configured in frontend
- Check that CORS headers are present in responses

**Image upload failures**:
```bash
# Check R2 bucket permissions
wrangler r2 bucket list

# Test R2 access
wrangler r2 object put eatinator-images/test.txt --file=test.txt
```

### Support Resources

- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
- **Wrangler CLI**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler/)
- **GitHub Issues**: Report problems in the repository

## 🔄 Migration from Legacy Backend

If migrating from the FastAPI backend:

1. **Export existing data**:
   ```bash
   # Export votes from SQLite
   sqlite3 api/data/eatinator.db ".dump votes" > votes.sql
   ```

2. **Import to D1**:
   ```bash
   # Import votes to D1
   wrangler d1 execute eatinator-voting --file=votes.sql
   ```

3. **Migrate images**: Copy images from local storage to R2 bucket

4. **Update DNS**: Point API subdomain to Worker

5. **Test thoroughly**: Verify all functionality works

## 📈 Scaling Considerations

The serverless architecture automatically scales, but consider:

- **KV Limits**: 10GB free storage, then $0.50/GB
- **D1 Limits**: 100K rows free, then $5/million
- **R2 Limits**: 10GB free storage, then $0.015/GB
- **Worker Limits**: 100K requests/day free, then $0.50/million

For high-traffic scenarios, monitor usage and consider Cloudflare paid plans for increased limits and better performance.