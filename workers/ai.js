// AI assistant implementation using Cloudflare AI Workers
// Uses Cloudflare's built-in AI models for cost-effective operation

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

// Cloudflare AI Configuration
const AI_CONFIG = {
  model: '@cf/meta/llama-3.1-8b-instruct', // Cost-effective model with good performance
  maxTokens: 300,
  temperature: 0.7,
  timeout: 30000 // 30 seconds for Cloudflare AI
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
 * Call Cloudflare AI API using Workers AI
 */
async function callCloudflareAi(message, context = {}, env) {
  const systemPrompt = getSystemPrompt(context);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  try {
    const response = await env.AI.run(AI_CONFIG.model, {
      messages,
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
    });

    const aiResponse = response.response || '';
    
    if (!aiResponse.trim()) {
      throw new Error('Cloudflare AI returned empty response');
    }

    return aiResponse.trim();

  } catch (error) {
    logError('Cloudflare AI API error', error);
    throw error;
  }
}

/**
 * Generate streaming AI response using Cloudflare AI
 */
async function* streamCloudflareAi(message, context = {}, env) {
  const systemPrompt = getSystemPrompt(context);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  try {
    const response = await env.AI.run(AI_CONFIG.model, {
      messages,
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      stream: true
    });

    // Handle Cloudflare AI streaming response
    if (response.readable) {
      const reader = response.readable.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            yield `data: ${JSON.stringify({ done: true })}\n\n`;
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          if (chunk.trim()) {
            try {
              const data = JSON.parse(chunk);
              if (data.response) {
                yield `data: ${JSON.stringify({ chunk: data.response })}\n\n`;
              }
            } catch (parseError) {
              // Handle non-JSON chunks (raw text from Cloudflare AI)
              yield `data: ${JSON.stringify({ chunk })}\n\n`;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Fallback for non-streaming response
      const aiResponse = response.response || '';
      yield `data: ${JSON.stringify({ chunk: aiResponse })}\n\n`;
      yield `data: ${JSON.stringify({ done: true })}\n\n`;
    }

  } catch (error) {
    logError('Cloudflare AI streaming error', error);
    yield `data: ${JSON.stringify({ error: error.message })}\n\n`;
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
            for await (const chunk of streamCloudflareAi(message, context, env)) {
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

        const aiResponse = await callCloudflareAi(message, context, env);
        
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

    // Test Cloudflare AI with a simple prompt
    const testResponse = await env.AI.run(AI_CONFIG.model, {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    if (testResponse && testResponse.response) {
      return jsonResponse({ 
        status: 'healthy', 
        ai_service: 'available',
        provider: 'Cloudflare AI',
        model: AI_CONFIG.model,
        test_response: testResponse.response.substring(0, 50)
      });
    } else {
      return jsonResponse({ 
        status: 'degraded', 
        ai_service: 'unavailable', 
        fallback: 'active',
        error: 'No response from Cloudflare AI'
      });
    }

  } catch (error) {
    logError('AI health check failed', error);
    return jsonResponse({ 
      status: 'degraded', 
      ai_service: 'unavailable', 
      fallback: 'active',
      error: error.message,
      provider: 'Cloudflare AI'
    });
  }
}