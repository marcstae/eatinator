// Image upload and storage implementation using Cloudflare R2
// Handles image uploads, retrieval, and automatic cleanup

import { 
  jsonResponse, 
  errorResponse, 
  sanitizeKey, 
  validateImageFile, 
  generateImageFilename, 
  verifyTurnstileToken, 
  getClientIP,
  checkRateLimit,
  logInfo,
  logError 
} from './utils.js';

/**
 * Upload an image to R2 bucket and store metadata in D1
 */
export async function uploadImage(request, env) {
  try {
    const formData = await request.formData();
    const key = formData.get('key');
    const imageFile = formData.get('image');
    const turnstileToken = formData.get('turnstileToken');

    // Validate input
    if (!key) {
      return errorResponse('Missing required parameter: key');
    }

    if (!imageFile || !(imageFile instanceof File)) {
      return errorResponse('No image file provided');
    }

    const sanitizedKey = sanitizeKey(key);
    if (!sanitizedKey) {
      return errorResponse('Invalid image key');
    }

    // Validate image file
    try {
      validateImageFile(imageFile);
    } catch (validationError) {
      return errorResponse(validationError.message);
    }

    // Verify Turnstile token if configured
    const turnstileSecret = env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      const clientIP = getClientIP(request);
      const isValidToken = await verifyTurnstileToken(turnstileToken, turnstileSecret, clientIP);
      if (!isValidToken) {
        return errorResponse('Turnstile verification failed', 403);
      }
    }

    // Rate limiting: max 10 uploads per IP per hour
    const clientIP = getClientIP(request);
    const rateLimitKey = `rate_limit:upload:${clientIP}`;
    const isAllowed = await checkRateLimit(env.VOTING_KV, rateLimitKey, 10, 3600);
    if (!isAllowed) {
      return errorResponse('Upload rate limit exceeded. Please try again later.', 429);
    }

    // Generate unique filename and R2 key
    const filename = generateImageFilename(imageFile.name, sanitizedKey);
    const r2Key = `images/${sanitizedKey}/${filename}`;
    const uploadTime = Math.floor(Date.now() / 1000);

    try {
      // Upload to R2 bucket
      await env.IMAGES_BUCKET.put(r2Key, imageFile.stream(), {
        httpMetadata: {
          contentType: imageFile.type,
        },
        customMetadata: {
          originalName: imageFile.name,
          dishKey: sanitizedKey,
          uploadTime: uploadTime.toString(),
        },
      });

      // Store metadata in D1 database
      const insertStmt = env.VOTING_DB.prepare(`
        INSERT INTO images (dish_key, filename, original_name, r2_key, file_size, content_type, upload_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      await insertStmt.bind(
        sanitizedKey,
        filename,
        imageFile.name,
        r2Key,
        imageFile.size,
        imageFile.type,
        uploadTime
      ).run();

      // Trigger cleanup of old images (async, don't wait)
      cleanupOldImages(env).catch(error => {
        logError('Cleanup error (non-blocking)', error);
      });

      logInfo('Image uploaded successfully', {
        dishKey: sanitizedKey,
        filename,
        r2Key,
        size: imageFile.size,
        contentType: imageFile.type
      });

      return jsonResponse({
        success: true,
        message: 'Image uploaded successfully',
        filename
      });

    } catch (storageError) {
      logError('Error storing image', storageError, { 
        dishKey: sanitizedKey, 
        filename, 
        r2Key 
      });
      return errorResponse('Failed to store image');
    }

  } catch (error) {
    logError('Error uploading image', error);
    return errorResponse('Failed to process image upload');
  }
}

/**
 * Get images for a specific dish
 */
export async function getImages(request, env, dishKey) {
  try {
    const sanitizedKey = sanitizeKey(dishKey);
    if (!sanitizedKey) {
      return errorResponse('Invalid dish key');
    }

    // Clean up old images before returning current ones
    await cleanupOldImages(env);

    // Get images from D1 database
    const stmt = env.VOTING_DB.prepare(`
      SELECT filename, original_name, file_size, content_type, upload_time, r2_key
      FROM images 
      WHERE dish_key = ?
      ORDER BY upload_time DESC
    `);
    
    const results = await stmt.bind(sanitizedKey).all();
    const images = [];

    for (const row of results.results) {
      // Verify image still exists in R2
      const r2Object = await env.IMAGES_BUCKET.head(row.r2_key);
      if (r2Object) {
        images.push({
          filename: row.filename,
          originalName: row.original_name,
          fileSize: row.file_size,
          contentType: row.content_type,
          uploadTime: row.upload_time,
          timestamp: new Date(row.upload_time * 1000).toISOString(),
          url: `/api/images/${sanitizedKey}/${row.filename}`
        });
      } else {
        // Remove orphaned database record
        const cleanupStmt = env.VOTING_DB.prepare('DELETE FROM images WHERE r2_key = ?');
        await cleanupStmt.bind(row.r2_key).run();
      }
    }

    logInfo('Images retrieved', { dishKey: sanitizedKey, count: images.length });
    return jsonResponse({ success: true, images });

  } catch (error) {
    logError('Error getting images', error, { dishKey });
    return errorResponse('Failed to get images');
  }
}

/**
 * Serve a specific image file from R2
 */
export async function getImageFile(request, env, dishKey, filename) {
  try {
    const sanitizedKey = sanitizeKey(dishKey);
    const sanitizedFilename = sanitizeKey(filename);
    
    if (!sanitizedKey || !sanitizedFilename) {
      return errorResponse('Invalid dish key or filename', 404);
    }

    // Get image metadata from database
    const stmt = env.VOTING_DB.prepare(`
      SELECT r2_key, content_type, original_name 
      FROM images 
      WHERE dish_key = ? AND filename = ?
    `);
    
    const imageRecord = await stmt.bind(sanitizedKey, sanitizedFilename).first();
    if (!imageRecord) {
      return errorResponse('Image not found', 404);
    }

    // Get image from R2
    const r2Object = await env.IMAGES_BUCKET.get(imageRecord.r2_key);
    if (!r2Object) {
      // Clean up orphaned database record
      const cleanupStmt = env.VOTING_DB.prepare(
        'DELETE FROM images WHERE dish_key = ? AND filename = ?'
      );
      await cleanupStmt.bind(sanitizedKey, sanitizedFilename).run();
      
      return errorResponse('Image file not found', 404);
    }

    // Return image with appropriate headers
    const headers = {
      'Content-Type': imageRecord.content_type || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Content-Disposition': `inline; filename="${imageRecord.original_name || sanitizedFilename}"`,
    };

    return new Response(r2Object.body, { headers });

  } catch (error) {
    logError('Error serving image file', error, { dishKey, filename });
    return errorResponse('Failed to serve image', 500);
  }
}

/**
 * Clean up images older than 24 hours
 */
export async function cleanupOldImages(env) {
  try {
    const cutoffTime = Math.floor(Date.now() / 1000) - (24 * 3600); // 24 hours ago
    
    // Find old images in database
    const stmt = env.VOTING_DB.prepare(`
      SELECT r2_key, filename, dish_key
      FROM images 
      WHERE upload_time < ?
    `);
    
    const oldImages = await stmt.bind(cutoffTime).all();
    
    if (oldImages.results.length === 0) {
      return;
    }

    logInfo('Starting image cleanup', { count: oldImages.results.length });

    // Delete from R2 and database
    let deletedCount = 0;
    for (const image of oldImages.results) {
      try {
        // Delete from R2
        await env.IMAGES_BUCKET.delete(image.r2_key);
        
        // Delete from database
        const deleteStmt = env.VOTING_DB.prepare('DELETE FROM images WHERE r2_key = ?');
        await deleteStmt.bind(image.r2_key).run();
        
        deletedCount++;
      } catch (deleteError) {
        logError('Error deleting individual image', deleteError, { 
          r2Key: image.r2_key,
          filename: image.filename 
        });
      }
    }

    logInfo('Image cleanup completed', { 
      total: oldImages.results.length, 
      deleted: deletedCount 
    });

  } catch (error) {
    logError('Error during image cleanup', error);
  }
}

/**
 * Handle legacy PHP-style image endpoints
 */
export async function handleLegacyImages(request, env) {
  const url = new URL(request.url);
  
  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    const action = url.searchParams.get('action');
    const file = url.searchParams.get('file');
    
    // Handle specific image file requests
    if (action === 'view' && key && file) {
      return getImageFile(request, env, key, file);
    }
    
    // Handle image list requests
    if (key) {
      return getImages(request, env, key);
    }
    
    return errorResponse('Missing required parameters');
    
  } else if (request.method === 'POST') {
    // Handle image uploads
    return uploadImage(request, env);
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * Get image storage statistics (admin endpoint)
 */
export async function getImageStats(request, env) {
  try {
    // Get total image count and storage used
    const statsStmt = env.VOTING_DB.prepare(`
      SELECT 
        COUNT(*) as total_images,
        SUM(file_size) as total_size,
        COUNT(DISTINCT dish_key) as unique_dishes
      FROM images
    `);
    const stats = await statsStmt.first();

    // Get recent uploads (last 7 days)
    const recentStmt = env.VOTING_DB.prepare(`
      SELECT COUNT(*) as recent_uploads
      FROM images
      WHERE created_at >= datetime('now', '-7 days')
    `);
    const recent = await recentStmt.first();

    // Get top dishes by image count
    const topDishesStmt = env.VOTING_DB.prepare(`
      SELECT 
        dish_key,
        COUNT(*) as image_count
      FROM images
      GROUP BY dish_key
      ORDER BY image_count DESC
      LIMIT 10
    `);
    const topDishes = await topDishesStmt.all();

    const imageStats = {
      totalImages: stats.total_images || 0,
      totalSize: stats.total_size || 0,
      uniqueDishes: stats.unique_dishes || 0,
      recentUploads: recent.recent_uploads || 0,
      topDishes: topDishes.results || []
    };

    return jsonResponse({ success: true, stats: imageStats });

  } catch (error) {
    logError('Error getting image stats', error);
    return errorResponse('Failed to get image statistics');
  }
}