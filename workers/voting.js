// Voting system implementation for Cloudflare Workers
// Handles vote casting, retrieval, and user tracking

import { 
  jsonResponse, 
  errorResponse, 
  sanitizeKey, 
  isValidVoteType, 
  verifyTurnstileToken, 
  getClientIP, 
  parseJsonBody,
  checkRateLimit,
  logInfo,
  logError 
} from './utils.js';

/**
 * Get votes for a specific menu item
 */
export async function getVotes(request, env, voteKey) {
  try {
    const sanitizedKey = sanitizeKey(voteKey);
    if (!sanitizedKey) {
      return errorResponse('Invalid vote key');
    }

    // Try to get from KV first (fast cache)
    const kvKey = `votes:${sanitizedKey}`;
    const cachedVotes = await env.VOTING_KV.get(kvKey, 'json');
    
    if (cachedVotes) {
      logInfo('Votes retrieved from KV cache', { voteKey: sanitizedKey });
      return jsonResponse({ success: true, votes: cachedVotes });
    }

    // Fall back to D1 database
    const stmt = env.VOTING_DB.prepare(
      'SELECT good, neutral, bad FROM votes WHERE vote_key = ?'
    );
    const result = await stmt.bind(sanitizedKey).first();
    
    const votes = result ? {
      good: result.good,
      neutral: result.neutral,
      bad: result.bad
    } : {
      good: 0,
      neutral: 0,
      bad: 0
    };

    // Cache the result in KV for faster future access (TTL: 1 hour)
    await env.VOTING_KV.put(kvKey, JSON.stringify(votes), { expirationTtl: 3600 });
    
    logInfo('Votes retrieved from D1 and cached', { voteKey: sanitizedKey, votes });
    return jsonResponse({ success: true, votes });

  } catch (error) {
    logError('Error getting votes', error, { voteKey });
    return errorResponse('Failed to get votes');
  }
}

/**
 * Cast a vote for a menu item
 */
export async function castVote(request, env) {
  try {
    const body = await parseJsonBody(request);
    const { key, voteType, userId, turnstileToken } = body;

    // Validate input
    if (!key || !voteType || !userId) {
      return errorResponse('Missing required parameters: key, voteType, userId');
    }

    const sanitizedKey = sanitizeKey(key);
    const sanitizedUserId = sanitizeKey(userId);
    
    if (!sanitizedKey || !sanitizedUserId) {
      return errorResponse('Invalid key or user ID');
    }

    if (!isValidVoteType(voteType)) {
      return errorResponse('Invalid vote type. Must be: good, neutral, or bad');
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

    // Rate limiting: max 20 votes per IP per hour
    const clientIP = getClientIP(request);
    const rateLimitKey = `rate_limit:vote:${clientIP}`;
    const isAllowed = await checkRateLimit(env.VOTING_KV, rateLimitKey, 20, 3600);
    if (!isAllowed) {
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Check if user has already voted for this item
    const userVoteStmt = env.VOTING_DB.prepare(
      'SELECT 1 FROM user_votes WHERE user_id = ? AND vote_key = ?'
    );
    const existingVote = await userVoteStmt.bind(sanitizedUserId, sanitizedKey).first();
    
    if (existingVote) {
      return errorResponse('User has already voted for this item');
    }

    // Check user's total vote count (limit: 50 votes per user)
    const userVoteCountStmt = env.VOTING_DB.prepare(
      'SELECT COUNT(*) as count FROM user_votes WHERE user_id = ?'
    );
    const userVoteCount = await userVoteCountStmt.bind(sanitizedUserId).first();
    
    if (userVoteCount.count >= 50) {
      return errorResponse('Vote limit exceeded for this user');
    }

    // Start transaction-like operations
    try {
      // Insert or update vote counts
      const upsertVoteStmt = env.VOTING_DB.prepare(`
        INSERT INTO votes (vote_key, ${voteType}, created_at, updated_at) 
        VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(vote_key) DO UPDATE SET 
          ${voteType} = ${voteType} + 1,
          updated_at = CURRENT_TIMESTAMP
      `);
      await upsertVoteStmt.bind(sanitizedKey).run();

      // Record user vote to prevent duplicates
      const insertUserVoteStmt = env.VOTING_DB.prepare(
        'INSERT INTO user_votes (user_id, vote_key, vote_type) VALUES (?, ?, ?)'
      );
      await insertUserVoteStmt.bind(sanitizedUserId, sanitizedKey, voteType).run();

      // Get updated vote counts
      const getUpdatedVotesStmt = env.VOTING_DB.prepare(
        'SELECT good, neutral, bad FROM votes WHERE vote_key = ?'
      );
      const updatedVotes = await getUpdatedVotesStmt.bind(sanitizedKey).first();

      const votes = {
        good: updatedVotes.good,
        neutral: updatedVotes.neutral,
        bad: updatedVotes.bad
      };

      // Update KV cache with new vote counts
      const kvKey = `votes:${sanitizedKey}`;
      await env.VOTING_KV.put(kvKey, JSON.stringify(votes), { expirationTtl: 3600 });

      logInfo('Vote cast successfully', {
        voteKey: sanitizedKey,
        voteType,
        userId: sanitizedUserId,
        votes
      });

      return jsonResponse({ success: true, votes });

    } catch (dbError) {
      logError('Database error during vote casting', dbError, { 
        voteKey: sanitizedKey, 
        voteType, 
        userId: sanitizedUserId 
      });
      return errorResponse('Failed to save vote');
    }

  } catch (error) {
    logError('Error casting vote', error);
    return errorResponse('Failed to process vote request');
  }
}

/**
 * Handle legacy PHP-style voting endpoints
 */
export async function handleLegacyVoting(request, env) {
  const url = new URL(request.url);
  
  if (request.method === 'GET') {
    // Legacy GET /api/votes.php?key=vote_key
    const voteKey = url.searchParams.get('key');
    if (!voteKey) {
      return errorResponse('Missing vote key parameter');
    }
    return getVotes(request, env, voteKey);
    
  } else if (request.method === 'POST') {
    // Legacy POST /api/votes.php with action=vote
    const body = await parseJsonBody(request);
    if (body.action !== 'vote') {
      return errorResponse('Invalid action. Expected: vote');
    }
    
    // Convert to modern format and delegate
    return castVote(request, env);
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * Get voting statistics (admin endpoint)
 */
export async function getVotingStats(request, env) {
  try {
    // Get total vote counts
    const totalVotesStmt = env.VOTING_DB.prepare(`
      SELECT 
        SUM(good) as total_good,
        SUM(neutral) as total_neutral,
        SUM(bad) as total_bad,
        COUNT(*) as total_items
      FROM votes
    `);
    const totalVotes = await totalVotesStmt.first();

    // Get recent activity (last 7 days)
    const recentActivityStmt = env.VOTING_DB.prepare(`
      SELECT COUNT(*) as recent_votes
      FROM user_votes
      WHERE created_at >= datetime('now', '-7 days')
    `);
    const recentActivity = await recentActivityStmt.first();

    // Get top voted items
    const topItemsStmt = env.VOTING_DB.prepare(`
      SELECT 
        vote_key,
        good,
        neutral,
        bad,
        (good + neutral + bad) as total_votes
      FROM votes
      ORDER BY total_votes DESC
      LIMIT 10
    `);
    const topItems = await topItemsStmt.all();

    const stats = {
      totalVotes: {
        good: totalVotes.total_good || 0,
        neutral: totalVotes.total_neutral || 0,
        bad: totalVotes.total_bad || 0,
        items: totalVotes.total_items || 0
      },
      recentActivity: recentActivity.recent_votes || 0,
      topItems: topItems.results || []
    };

    return jsonResponse({ success: true, stats });

  } catch (error) {
    logError('Error getting voting stats', error);
    return errorResponse('Failed to get voting statistics');
  }
}