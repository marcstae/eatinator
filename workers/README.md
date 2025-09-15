# Eatinator Serverless Migration

This directory contains the Cloudflare Workers implementation of the Eatinator backend API.

## Architecture

The serverless architecture uses:
- **Cloudflare Workers**: API endpoints and business logic
- **Cloudflare KV**: Fast key-value storage for voting data
- **Cloudflare D1**: SQLite-compatible database for relational data
- **Cloudflare R2**: Object storage for image uploads
- **Cloudflare AI**: Built-in AI models for intelligent responses

## File Structure

```
workers/
├── index.js          # Main Worker entry point and router
├── voting.js         # Voting system implementation
├── images.js         # Image upload/storage system
├── ai.js             # AI assistant using Cloudflare AI models
├── utils.js          # Shared utilities and helpers
└── schema.sql        # D1 database schema
```

## Setup

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler auth login
   ```

3. **Create required services**:
   ```bash
   # Create KV namespace
   wrangler kv:namespace create "VOTING_KV"
   wrangler kv:namespace create "VOTING_KV" --preview
   
   # Create D1 database
   wrangler d1 create eatinator-voting
   
   # Create R2 bucket
   wrangler r2 bucket create eatinator-images
   ```

4. **Update wrangler.toml** with the created service IDs

5. **Deploy the worker**:
   ```bash
   wrangler deploy
   ```

## Cost Optimization

This serverless architecture is designed to minimize costs:

- **Workers**: 100,000 requests/day free
- **KV**: 10GB storage + 100,000 reads/day free
- **D1**: 100,000 rows + 5GB storage free
- **R2**: 10GB storage + 10M Class B operations free
- **AI**: 10,000 Neurons/day free (sufficient for typical usage)

Expected monthly cost: **$0** for typical usage patterns.

## Security

- **Turnstile Integration**: Bot protection for write operations
- **CORS Configuration**: Secure cross-origin access
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Built-in protection against abuse