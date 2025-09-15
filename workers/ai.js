// AI assistant proxy implementation for Cloudflare Workers
// Proxies requests to external AI service with caching and rate limiting

import { 
  jsonResponse, 
  errorResponse, 
  verifyTurnstileToken, 
  getClientIP,
  parseJsonBody,
  checkRateLimit,
  logInfo,
  logError 
} from './utils.js';

// AI Configuration
const AI_CONFIG = {
  url: 'https://mlvoca.com/api/generate',
  model: 'deepseek-r1:1.5b',
  maxTokens: 300,
  temperature: 0.7,
  timeout: 60000 // 60 seconds
};

/**
 * Generate system prompt with menu context
 */
function getSystemPrompt(context = {}) {
  const language = context.language || 'en';
  const items = context.items || [];
  const category = context.category || 'lunch';
  const restaurant = context.restaurant || 'Restaurant';
  const date = context.date || '';
  
  const hasItems = items.length > 0;
  
  if (language === 'de') {
    const menuContext = hasItems 
      ? `Heutige Gerichte (${category}): ${items.map(item => item.name).join(', ')}`
      : `Keine Menüdaten verfügbar für ${category} am ${date}`;
    
    return `Du bist ein persönlicher Menü-Berater für "${restaurant}".

${menuContext}

🎯 FOKUS: Gib persönliche EMPFEHLUNGEN und ALLERGIE-BERATUNG. Nutzer kennen bereits das Menü.

Hauptaufgaben:
1. 🍽️ EMPFEHLUNGEN: "Was soll ich heute essen?" - Vorschläge basierend auf Geschmack, Gesundheit, Stimmung
2. 🚫 ALLERGIE-SICHERHEIT: Gluten, Laktose, Nüsse, etc. - bei Unsicherheit: "Frag das Personal vor Ort"
3. 🥗 ERNÄHRUNGSBERATUNG: Vegetarisch, vegan, kalorienarm, proteinreich
4. 👨‍🍳 GESCHMACKS-TIPPS: "Wie schmeckt das?" - beschreibe Aromen, Texturen, Zubereitungsart

Antworte kurz (1-3 Sätze), freundlich und praktisch. Keine Menülisten - nur Beratung!`;
  } else if (language === 'fr') {
    const menuContext = hasItems 
      ? `Plats du jour (${category}): ${items.map(item => item.name).join(', ')}`
      : `Aucune donnée de menu disponible pour ${category} le ${date}`;
    
    return `Vous êtes un conseiller personnel de menu pour "${restaurant}".

${menuContext}

🎯 FOCUS: Donnez des RECOMMANDATIONS personnelles et des CONSEILS ALLERGIES. Les utilisateurs connaissent déjà le menu.

Tâches principales:
1. 🍽️ RECOMMANDATIONS: "Que dois-je manger aujourd'hui?" - suggestions basées sur le goût, la santé, l'humeur
2. 🚫 SÉCURITÉ ALLERGIES: Gluten, lactose, noix, etc. - en cas d'incertitude: "Demandez au personnel sur place"
3. 🥗 CONSEILS ALIMENTAIRES: Végétarien, végétalien, faible en calories, riche en protéines
4. 👨‍🍳 CONSEILS GUSTATIFS: "Quel goût cela a-t-il?" - décrivez les arômes, textures, méthodes de cuisson

Répondez brièvement (1-3 phrases), amicalement et pratiquement. Pas de listes de menu - juste des conseils!`;
  } else {
    const menuContext = hasItems 
      ? `Today's dishes (${category}): ${items.map(item => item.name).join(', ')}`
      : `No menu data available for ${category} on ${date}`;
    
    return `You are a personal menu advisor for "${restaurant}".

${menuContext}

🎯 FOCUS: Give personal RECOMMENDATIONS and ALLERGY GUIDANCE. Users already know the menu.

Main tasks:
1. 🍽️ RECOMMENDATIONS: "What should I eat today?" - suggestions based on taste, health, mood
2. 🚫 ALLERGY SAFETY: Gluten, lactose, nuts, etc. - when uncertain: "Ask the staff on-site"
3. 🥗 DIETARY ADVICE: Vegetarian, vegan, low-calorie, high-protein options
4. 👨‍🍳 TASTE GUIDANCE: "How does it taste?" - describe flavors, textures, cooking methods

Respond briefly (1-3 sentences), friendly and practical. No menu lists - just advice!`;
  }
}

/**
 * Get fallback response when AI service is unavailable
 */
function getFallbackResponse(message, context = {}) {
  const language = context.language || 'en';
  
  if (language === 'de') {
    return 'Entschuldigung, der KI-Assistent ist momentan nicht verfügbar. Gerne helfe ich bei Menü-Empfehlungen, Allergie-Fragen oder Ernährungsberatung! Was interessiert Sie am meisten?';
  } else if (language === 'fr') {
    return 'Désolé, l\'assistant IA n\'est pas disponible pour le moment. Je serais heureux de vous aider avec des recommandations de menu, des questions d\'allergie ou des conseils diététiques! Qu\'est-ce qui vous intéresse le plus?';
  } else {
    return 'Sorry, the AI assistant is currently unavailable. I\'m happy to help with menu recommendations, allergy questions, or dietary advice! What interests you most?';
  }
}

/**
 * Call external AI API
 */
async function callAiApi(message, context = {}) {
  const systemPrompt = getSystemPrompt(context);
  
  const payload = {
    model: AI_CONFIG.model,
    prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
    stream: false,
    options: {
      temperature: AI_CONFIG.temperature,
      num_predict: AI_CONFIG.maxTokens
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

  try {
    const response = await fetch(AI_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.response || '';
    
    if (!aiResponse.trim()) {
      throw new Error('AI API returned empty response');
    }

    return aiResponse.trim();

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out - the service may be overloaded. Please try again.');
    }
    
    throw error;
  }
}

/**
 * Generate streaming AI response
 */
async function* streamAiApi(message, context = {}) {
  const systemPrompt = getSystemPrompt(context);
  
  const payload = {
    model: AI_CONFIG.model,
    prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
    stream: true,
    options: {
      temperature: AI_CONFIG.temperature,
      num_predict: AI_CONFIG.maxTokens
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

  try {
    const response = await fetch(AI_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI API responded with status ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read response stream');
    }

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield `data: ${JSON.stringify({ chunk: data.response })}\n\n`;
              } else if (data.done) {
                yield `data: ${JSON.stringify({ done: true })}\n\n`;
                return;
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      yield `data: ${JSON.stringify({ error: 'AI request timed out - the service may be overloaded. Please try again.' })}\n\n`;
    } else {
      yield `data: ${JSON.stringify({ error: error.message })}\n\n`;
    }
  }
}

/**
 * Handle AI chat request
 */
export async function aiChat(request, env) {
  try {
    const body = await parseJsonBody(request);
    const { message, context = {}, turnstileToken } = body;

    // Validate input
    if (!message || !message.trim()) {
      return errorResponse('Message cannot be empty');
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

    // Rate limiting: max 30 AI requests per IP per hour
    const clientIP = getClientIP(request);
    const rateLimitKey = `rate_limit:ai:${clientIP}`;
    const isAllowed = await checkRateLimit(env.VOTING_KV, rateLimitKey, 30, 3600);
    if (!isAllowed) {
      return errorResponse('AI rate limit exceeded. Please try again later.', 429);
    }

    // Check if client accepts streaming
    const acceptHeader = request.headers.get('accept') || '';
    
    if (acceptHeader.includes('text/event-stream')) {
      // Return streaming response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamAiApi(message, context)) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (error) {
            const errorChunk = `data: ${JSON.stringify({ error: error.message })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorChunk));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });

    } else {
      // Return traditional JSON response
      try {
        // Check cache first (simple message-based caching for 5 minutes)
        const cacheKey = `ai_cache:${btoa(message).substring(0, 50)}`;
        const cachedResponse = await env.VOTING_KV.get(cacheKey);
        
        if (cachedResponse) {
          logInfo('AI response served from cache', { message: message.substring(0, 50) });
          return jsonResponse({ success: true, response: cachedResponse });
        }

        const aiResponse = await callAiApi(message, context);
        
        // Cache the response for 5 minutes
        await env.VOTING_KV.put(cacheKey, aiResponse, { expirationTtl: 300 });
        
        logInfo('AI response generated', { 
          message: message.substring(0, 50),
          responseLength: aiResponse.length 
        });

        return jsonResponse({ success: true, response: aiResponse });

      } catch (error) {
        logError('AI chat error', error, { message: message.substring(0, 50) });
        
        // Return fallback response instead of error
        const fallbackResponse = getFallbackResponse(message, context);
        return jsonResponse({ 
          success: true, 
          response: fallbackResponse,
          fallback: true 
        });
      }
    }

  } catch (error) {
    logError('Unexpected AI chat error', error);
    return errorResponse('Failed to process AI request');
  }
}

/**
 * Check AI service health
 */
export async function aiHealth(request, env) {
  try {
    const testContext = {
      language: 'en',
      items: [],
      category: 'test',
      restaurant: 'Test Restaurant',
      date: 'today'
    };

    const testPayload = {
      model: AI_CONFIG.model,
      prompt: 'Test prompt',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 10
      }
    };

    const response = await fetch(AI_CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000) // 5 second timeout for health check
    });

    if (response.ok) {
      return jsonResponse({ 
        status: 'healthy', 
        ai_service: 'available',
        endpoint: AI_CONFIG.url,
        model: AI_CONFIG.model
      });
    } else {
      return jsonResponse({ 
        status: 'degraded', 
        ai_service: 'unavailable', 
        fallback: 'active',
        error: `HTTP ${response.status}`
      });
    }

  } catch (error) {
    logError('AI health check failed', error);
    return jsonResponse({ 
      status: 'degraded', 
      ai_service: 'unavailable', 
      fallback: 'active',
      error: error.message
    });
  }
}