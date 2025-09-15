#!/bin/bash
# Test script for Eatinator Cloudflare Workers API

set -e

# Configuration
WORKER_URL="${WORKER_URL:-http://127.0.0.1:8787}"  # Default for wrangler dev
TEST_USER_ID="test_user_$(date +%s)"
TEST_VOTE_KEY="test_item_$(date +%s)"

echo "🧪 Testing Eatinator Workers API"
echo "================================="
echo "URL: $WORKER_URL"
echo "User ID: $TEST_USER_ID"
echo "Vote Key: $TEST_VOTE_KEY"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
response=$(curl -s "$WORKER_URL/health")
echo "Response: $response"
if echo "$response" | grep -q '"status":"healthy"'; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi
echo ""

# Test 2: Get non-existent votes
echo "2. Testing vote retrieval (empty)..."
response=$(curl -s "$WORKER_URL/api/votes/$TEST_VOTE_KEY")
echo "Response: $response"
if echo "$response" | grep -q '"good":0'; then
    echo "✅ Vote retrieval passed"
else
    echo "❌ Vote retrieval failed"
    exit 1
fi
echo ""

# Test 3: Cast a vote
echo "3. Testing vote casting..."
response=$(curl -s -X POST "$WORKER_URL/api/votes" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$TEST_VOTE_KEY\",\"voteType\":\"good\",\"userId\":\"$TEST_USER_ID\"}")
echo "Response: $response"
if echo "$response" | grep -q '"success":true'; then
    echo "✅ Vote casting passed"
else
    echo "❌ Vote casting failed"
    echo "Response: $response"
    exit 1
fi
echo ""

# Test 4: Verify vote was recorded
echo "4. Testing vote verification..."
response=$(curl -s "$WORKER_URL/api/votes/$TEST_VOTE_KEY")
echo "Response: $response"
if echo "$response" | grep -q '"good":1'; then
    echo "✅ Vote verification passed"
else
    echo "❌ Vote verification failed"
    exit 1
fi
echo ""

# Test 5: Test duplicate vote protection
echo "5. Testing duplicate vote protection..."
response=$(curl -s -X POST "$WORKER_URL/api/votes" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$TEST_VOTE_KEY\",\"voteType\":\"good\",\"userId\":\"$TEST_USER_ID\"}")
echo "Response: $response"
if echo "$response" | grep -q '"success":false'; then
    echo "✅ Duplicate vote protection passed"
else
    echo "❌ Duplicate vote protection failed"
    exit 1
fi
echo ""

# Test 6: Legacy voting endpoint
echo "6. Testing legacy voting endpoint..."
response=$(curl -s "$WORKER_URL/api/votes.php?key=$TEST_VOTE_KEY")
echo "Response: $response"
if echo "$response" | grep -q '"good":1'; then
    echo "✅ Legacy endpoint passed"
else
    echo "❌ Legacy endpoint failed"
    exit 1
fi
echo ""

# Test 7: Image endpoint (should handle no images gracefully)
echo "7. Testing images endpoint..."
response=$(curl -s "$WORKER_URL/api/images/test_dish")
echo "Response: $response"
if echo "$response" | grep -q '"success":true'; then
    echo "✅ Images endpoint passed"
else
    echo "❌ Images endpoint failed"
    exit 1
fi
echo ""

# Test 8: AI health check
echo "8. Testing AI health endpoint..."
response=$(curl -s "$WORKER_URL/api/ai/health")
echo "Response: $response"
if echo "$response" | grep -q '"status"'; then
    echo "✅ AI health endpoint passed"
else
    echo "❌ AI health endpoint failed"
    exit 1
fi
echo ""

# Test 9: CORS preflight
echo "9. Testing CORS preflight..."
response_code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$WORKER_URL/api/votes" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST")
echo "Response code: $response_code"
if [ "$response_code" = "204" ]; then
    echo "✅ CORS preflight passed"
else
    echo "❌ CORS preflight failed"
    exit 1
fi
echo ""

echo "🎉 All tests passed!"
echo ""
echo "Next steps:"
echo "1. Deploy to production: npm run deploy"
echo "2. Update frontend config with your Worker URL"
echo "3. Test with the actual frontend application"