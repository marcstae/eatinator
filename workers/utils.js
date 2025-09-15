// Utility functions for Cloudflare Workers
// Shared helpers used across all worker modules

/**
 * CORS headers for cross-origin requests
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Standard JSON response with CORS headers
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...additionalHeaders,
    },
  });
}

/**
 * Error response with CORS headers
 */
export function errorResponse(error, status = 400) {
  return jsonResponse({ 
    success: false, 
    error: typeof error === 'string' ? error : error.message 
  }, status);
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Sanitize key to prevent path traversal and ensure valid characters
 */
export function sanitizeKey(key) {
  if (typeof key !== 'string') return '';
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 200);
}

/**
 * Validate vote type
 */
export function isValidVoteType(voteType) {
  return ['good', 'neutral', 'bad'].includes(voteType);
}

/**
 * Generate unique filename for uploaded images
 */
export function generateImageFilename(originalName, dishKey) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const extension = getFileExtension(originalName) || 'jpg';
  return `${sanitizeKey(dishKey)}_${timestamp}_${randomId}.${extension}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename) {
  if (!filename) return null;
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : null;
}

/**
 * Validate image file type and size
 */
export function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 15 * 1024 * 1024; // 15MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 15MB');
  }
  
  return true;
}

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstileToken(token, secretKey, remoteIP = null) {
  if (!secretKey) {
    return true; // Skip verification if Turnstile is not configured
  }
  
  if (!token) {
    return false;
  }
  
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIP) {
      formData.append('remoteip', remoteIP);
    }
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      console.warn('Turnstile verification request failed:', response.status);
      return false;
    }
    
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return false;
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') || 
         'unknown';
}

/**
 * Parse and validate JSON request body
 */
export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    if (!text) {
      throw new Error('Request body is empty');
    }
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Rate limiting using KV store
 */
export async function checkRateLimit(kv, key, maxRequests = 100, windowSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  // Get existing rate limit data
  const rateLimitData = await kv.get(key, 'json') || { requests: [], firstRequest: now };
  
  // Filter out old requests
  rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (rateLimitData.requests.length >= maxRequests) {
    return false;
  }
  
  // Add current request
  rateLimitData.requests.push(now);
  
  // Store updated data with TTL
  await kv.put(key, JSON.stringify(rateLimitData), { expirationTtl: windowSeconds });
  
  return true;
}

/**
 * Log structured data for debugging
 */
export function logInfo(message, data = {}) {
  console.log(JSON.stringify({
    level: 'info',
    message,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

/**
 * Log error with structured data
 */
export function logError(message, error = null, data = {}) {
  console.error(JSON.stringify({
    level: 'error',
    message,
    error: error ? error.message : null,
    stack: error ? error.stack : null,
    timestamp: new Date().toISOString(),
    ...data
  }));
}