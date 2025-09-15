// Main Cloudflare Worker entry point for Eatinator API
// Routes requests to appropriate handlers

import { handleOptions, jsonResponse, errorResponse, logInfo, logError } from './utils.js';
import { getVotes, castVote, handleLegacyVoting, getVotingStats } from './voting.js';
import { uploadImage, getImages, getImageFile, handleLegacyImages, getImageStats } from './images.js';
import { aiChat, aiHealth } from './ai.js';

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // Handle CORS preflight requests
      if (method === 'OPTIONS') {
        return handleOptions();
      }

      // Health check endpoint
      if (pathname === '/health' || pathname === '/api/health') {
        return jsonResponse({ 
          status: 'healthy', 
          service: 'eatinator-api-workers',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'production'
        });
      }

      // API routes
      if (pathname.startsWith('/api/')) {
        return handleApiRequest(request, env, pathname, method);
      }

      // Default response for non-API routes
      return jsonResponse({
        message: 'Eatinator API - Serverless Backend',
        version: '2.0.0',
        endpoints: [
          'GET /health - Health check',
          'GET /api/votes/{key} - Get votes for item',
          'POST /api/votes - Cast vote',
          'GET /api/votes.php?key={key} - Legacy voting endpoint',
          'POST /api/votes.php - Legacy voting endpoint',
          'GET /api/images/{key} - Get images for dish',
          'POST /api/images - Upload image',
          'GET /api/images/{key}/{filename} - Get specific image',
          'GET /api/images.php - Legacy images endpoint',
          'POST /api/images.php - Legacy images endpoint',
          'POST /api/ai - AI assistant chat',
          'GET /api/ai/health - AI service health',
          'GET /api/stats/votes - Voting statistics',
          'GET /api/stats/images - Image statistics'
        ]
      });

    } catch (error) {
      logError('Unhandled error in main handler', error, {
        url: request.url,
        method: request.method
      });
      return errorResponse('Internal server error', 500);
    }
  }
};

/**
 * Handle API requests
 */
async function handleApiRequest(request, env, pathname, method) {
  try {
    // Voting endpoints (REST-style)
    if (pathname.startsWith('/api/votes/') && pathname !== '/api/votes.php') {
      const voteKey = pathname.split('/')[3];
      if (method === 'GET') {
        return getVotes(request, env, voteKey);
      }
      return errorResponse('Method not allowed for this endpoint', 405);
    }

    if (pathname === '/api/votes') {
      if (method === 'POST') {
        return castVote(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    // Legacy voting endpoint
    if (pathname === '/api/votes.php') {
      return handleLegacyVoting(request, env);
    }

    // Image endpoints (REST-style)
    if (pathname.startsWith('/api/images/')) {
      const pathParts = pathname.split('/');
      
      if (pathParts.length === 4 && method === 'GET') {
        // GET /api/images/{key} - get images for dish
        const dishKey = pathParts[3];
        return getImages(request, env, dishKey);
      }
      
      if (pathParts.length === 5 && method === 'GET') {
        // GET /api/images/{key}/{filename} - get specific image file
        const dishKey = pathParts[3];
        const filename = pathParts[4];
        return getImageFile(request, env, dishKey, filename);
      }
      
      return errorResponse('Invalid image endpoint', 404);
    }

    if (pathname === '/api/images') {
      if (method === 'POST') {
        return uploadImage(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    // Legacy images endpoint
    if (pathname === '/api/images.php') {
      return handleLegacyImages(request, env);
    }

    // AI assistant endpoints
    if (pathname === '/api/ai') {
      if (method === 'POST') {
        return aiChat(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    if (pathname === '/api/ai/health') {
      if (method === 'GET') {
        return aiHealth(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    // Statistics endpoints
    if (pathname === '/api/stats/votes') {
      if (method === 'GET') {
        return getVotingStats(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    if (pathname === '/api/stats/images') {
      if (method === 'GET') {
        return getImageStats(request, env);
      }
      return errorResponse('Method not allowed', 405);
    }

    // Admin endpoints (for future use)
    if (pathname.startsWith('/api/admin/')) {
      return handleAdminRequest(request, env, pathname, method);
    }

    // Unknown API endpoint
    return errorResponse('API endpoint not found', 404);

  } catch (error) {
    logError('Error handling API request', error, {
      pathname,
      method
    });
    return errorResponse('Failed to process API request', 500);
  }
}

/**
 * Handle admin requests (protected endpoints)
 */
async function handleAdminRequest(request, env, pathname, method) {
  // TODO: Add authentication for admin endpoints
  // For now, just return the basic endpoints we have
  
  if (pathname === '/api/admin/cleanup' && method === 'POST') {
    try {
      // Manual cleanup trigger
      const { cleanupOldImages } = await import('./images.js');
      await cleanupOldImages(env);
      
      return jsonResponse({
        success: true,
        message: 'Cleanup completed'
      });
    } catch (error) {
      logError('Admin cleanup error', error);
      return errorResponse('Cleanup failed');
    }
  }

  if (pathname === '/api/admin/info' && method === 'GET') {
    // Return basic system information
    return jsonResponse({
      service: 'eatinator-api-workers',
      environment: env.ENVIRONMENT || 'production',
      timestamp: new Date().toISOString(),
      features: {
        voting: true,
        images: true,
        ai: true,
        turnstile: !!env.TURNSTILE_SECRET_KEY
      },
      storage: {
        kv: 'VOTING_KV',
        database: 'VOTING_DB',
        bucket: 'IMAGES_BUCKET'
      }
    });
  }

  return errorResponse('Admin endpoint not found', 404);
}

/**
 * Background tasks and cleanup
 */
export async function scheduled(event, env, ctx) {
  try {
    logInfo('Running scheduled cleanup tasks');
    
    // Import cleanup function and run it
    const { cleanupOldImages } = await import('./images.js');
    await cleanupOldImages(env);
    
    logInfo('Scheduled cleanup completed');
  } catch (error) {
    logError('Scheduled cleanup failed', error);
  }
}