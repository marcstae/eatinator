# Cloudflare Pages Deployment Guide

This document provides detailed instructions for deploying the Eatinator frontend to Cloudflare Pages, creating a fully serverless application with global edge distribution.

## 🌟 Overview

Cloudflare Pages provides:
- **Global CDN**: 200+ edge locations worldwide
- **Free tier**: Unlimited bandwidth, 500 builds/month
- **Custom domains**: Free SSL certificates
- **Preview deployments**: Every pull request gets a preview URL
- **GitHub integration**: Automatic deployments on push

## 🚀 Quick Setup

### 1. Automated Deployment

Use the provided setup script for one-command deployment:

```bash
# Make script executable
chmod +x scripts/setup-pages.sh

# Run automated setup
./scripts/setup-pages.sh
```

This script will:
- ✅ Create Cloudflare Pages project
- ✅ Update configuration with Worker URLs
- ✅ Deploy the frontend
- ✅ Provide deployment URLs

### 2. Manual Setup

If you prefer manual setup:

```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Create Pages project
npm run setup:pages

# Deploy frontend
npm run deploy:pages
```

## 🔧 Configuration Files

### `_redirects`
Handles API routing and SPA fallback:
```
# Proxy API calls to Cloudflare Worker
/api/* https://your-worker.workers.dev/api/:splat 200

# SPA fallback
/* /index.html 200
```

### `wrangler.pages.toml`
Cloudflare Pages build configuration:
- Security headers for all responses
- PWA-specific headers for manifest and service worker
- Cache control for static assets

### GitHub Action (`.github/workflows/deploy-pages.yml`)
Automated deployment on every push:
- Deploys frontend to Pages
- Deploys Worker if changes detected
- Creates preview URLs for pull requests

## 🌍 GitHub Integration

### Setup Repository Integration

1. **Add Cloudflare secrets** to your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Add these secrets:
     ```
     CLOUDFLARE_API_TOKEN: [Your Cloudflare API token]
     CLOUDFLARE_ACCOUNT_ID: [Your Cloudflare account ID]
     ```

2. **Get API Token**:
   - Visit [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Create token with permissions:
     - Zone:Zone:Read
     - Zone:Page Rules:Edit
     - Account:Cloudflare Pages:Edit

3. **Get Account ID**:
   - Visit [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Account ID is shown in the right sidebar

### Automatic Deployments

Once configured, deployments happen automatically:
- **Main branch**: Production deployment
- **Other branches**: Preview deployments
- **Pull requests**: Preview URLs posted as comments

## 🎯 Advanced Configuration

### Custom Domain Setup

1. **Add domain to Cloudflare**:
   ```bash
   # Add your domain to Cloudflare account first
   # Then configure Pages custom domain
   wrangler pages domain add eatinator yourdomain.com
   ```

2. **Update DNS records**:
   - Add CNAME record: `www → eatinator.pages.dev`
   - Pages will handle SSL certificate automatically

### Environment-specific Configuration

**Production environment**:
```bash
# Deploy to production
npm run deploy:pages:prod
```

**Development testing**:
```bash
# Local Pages development server
npm run pages:dev
```

### Worker Integration

The frontend automatically detects and uses your Cloudflare Worker:
- API calls are proxied through `_redirects`
- Configuration in `js/config.js` handles Worker URLs
- Fallback to localhost during development

## 📊 Monitoring and Analytics

### Deployment Status

```bash
# List recent deployments
wrangler pages deployment list --project-name eatinator

# View deployment logs
npm run logs:pages

# Check deployment status
wrangler pages project list
```

### Performance Monitoring

Access detailed analytics in the Cloudflare Dashboard:
- **Analytics tab**: Page views, unique visitors, bandwidth
- **Speed tab**: Core Web Vitals, performance metrics
- **Security tab**: Security events, bot traffic

### Real User Monitoring (RUM)

Cloudflare automatically provides:
- Core Web Vitals tracking
- Geographic performance data
- Device and browser analytics
- Error tracking and reporting

## 🔒 Security Features

### Automatic Security Headers

All pages served with security headers:
```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### DDoS Protection

Cloudflare Pages includes:
- Automatic DDoS mitigation
- Bot protection and filtering
- Rate limiting capabilities
- Web Application Firewall (WAF)

### SSL/TLS

- Automatic SSL certificate provisioning
- TLS 1.3 support
- Perfect Forward Secrecy
- HTTP/2 and HTTP/3 support

## 🛠️ Troubleshooting

### Common Issues

**Deployment fails**:
```bash
# Check Wrangler authentication
wrangler whoami

# Verify project exists
wrangler pages project list

# Check build logs
wrangler pages deployment list --project-name eatinator
```

**API calls not working**:
- Verify `_redirects` file is present
- Check Worker URL in `js/config.js`
- Ensure Worker is deployed and accessible

**PWA installation issues**:
- Verify all icons are present in `/icons/`
- Check `manifest.json` is accessible
- Ensure HTTPS is being used

### Debug Commands

```bash
# Test local Pages development
npm run pages:dev

# Validate configuration
npx wrangler pages validate

# Check deployment status
wrangler pages deployment list --project-name eatinator --limit 5
```

## 💰 Cost Optimization

### Free Tier Limits

Cloudflare Pages free tier includes:
- **Bandwidth**: Unlimited
- **Builds**: 500/month
- **Build time**: 20 minutes/build
- **Sites**: 100 projects
- **Custom domains**: Unlimited

### Usage Monitoring

Monitor usage to stay within free tier:
- **Dashboard**: Analytics → Usage
- **Build time**: Optimize build commands
- **Storage**: Clean up old deployments if needed

### Optimization Tips

1. **Minimize build time**: Use static files (no build required)
2. **Cache static assets**: Proper cache headers set automatically
3. **Optimize images**: Compress icons and assets
4. **Use Cloudflare CDN**: Automatic global distribution

## 🔄 Integration with Backend

### Worker API Integration

The frontend seamlessly integrates with Cloudflare Workers:

1. **Development**: APIs proxied to localhost
2. **Production**: APIs routed to deployed Worker
3. **Automatic detection**: Configuration adapts to environment

### Configuration Management

API endpoints automatically configured:
```javascript
// js/config.js
const API_URL = window.location.hostname === 'localhost' 
  ? '/api/votes' 
  : 'https://your-worker.workers.dev/api/votes';
```

### Fallback Behavior

Graceful degradation when services unavailable:
- Backend offline → localStorage voting
- External APIs blocked → Fallback content
- CSS CDN blocked → Basic styling

## 📱 PWA Features

### Installation

Cloudflare Pages optimally serves PWA files:
- `manifest.json` with proper MIME type
- Service worker caching strategies
- Icon files with appropriate headers

### Offline Support

While primarily online-first, the app includes:
- Fallback pages for network errors
- Local storage for critical data
- Graceful error handling

### Performance

Cloudflare's global network ensures:
- Sub-100ms response times globally
- Automatic image optimization
- Brotli compression for smaller transfers

---

This deployment guide provides everything needed to deploy Eatinator's frontend to Cloudflare Pages, creating a modern, performant, and globally distributed web application.