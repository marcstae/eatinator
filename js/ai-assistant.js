// AI Assistant functionality for menu questions and dish explanations

// AI Assistant configuration
const AI_CONFIG = {
    enabled: true,
    // Multiple API endpoints to try (fallback approach)
    apiEndpoints: [
        {
            url: 'https://mlvoca.com/api/generate',
            model: 'deepseek-r1:1.5b',
            headers: { 'Content-Type': 'application/json' },
            isOllama: true
        },
        {
            url: 'https://api.pawan.krd/cosmosrp/v1/chat/completions',
            model: 'gpt-3.5-turbo',
            headers: { 'Authorization': 'Bearer pk-' }
        },
        {
            url: 'https://api.together.xyz/v1/chat/completions', 
            model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            headers: { 'Authorization': 'Bearer free' }
        },
        {
            url: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo',
            headers: { 'Authorization': 'Bearer demo' }
        }
    ],
    maxTokens: 300,
    temperature: 0.7,
    timeout: 10000,
    // Fallback to localStorage for settings
    storageKey: 'eatinator_ai_settings'
};

// AI Assistant state
let aiChatVisible = false;
let aiMessages = [];
let userLanguage = 'en'; // Default to English, will be detected

// Initialize AI Assistant
function initAiAssistant() {
    // Load user settings from localStorage
    loadAiSettings();
    
    // Detect user language
    detectUserLanguage();
    
    // Create AI chat interface
    createAiChatInterface();
    
    // Add FAB button
    createAiFab();
}

// Load AI settings from localStorage
function loadAiSettings() {
    try {
        const settings = localStorage.getItem(AI_CONFIG.storageKey);
        if (settings) {
            const parsed = JSON.parse(settings);
            aiChatVisible = parsed.chatVisible || false;
            userLanguage = parsed.language || 'en';
        }
    } catch (error) {
        console.log('No AI settings found, using defaults');
    }
}

// Save AI settings to localStorage
function saveAiSettings() {
    try {
        const settings = {
            chatVisible: aiChatVisible,
            language: userLanguage,
            enabled: AI_CONFIG.enabled
        };
        localStorage.setItem(AI_CONFIG.storageKey, JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save AI settings:', error);
    }
}

// Detect user language based on browser settings or previous interactions
function detectUserLanguage() {
    // Check if user has a saved preference
    const saved = localStorage.getItem(AI_CONFIG.storageKey);
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.language) {
                userLanguage = settings.language;
                return;
            }
        } catch (e) {}
    }
    
    // Detect from browser language
    userLanguage = detectBrowserLanguage();
}

// Create floating action button (FAB) for AI chat
function createAiFab() {
    // Check if AI should be visible (user preference)
    const aiSettings = JSON.parse(localStorage.getItem(AI_CONFIG.storageKey) || '{}');
    const aiFeatureEnabled = aiSettings.featureEnabled !== false; // Default to enabled
    
    if (!aiFeatureEnabled) {
        return; // Don't show FAB if user disabled the feature
    }
    
    const fab = document.createElement('button');
    fab.id = 'aiFab';
    fab.className = 'fixed bottom-6 right-4 w-12 h-12 bg-gradient-to-tr from-ios-blue to-blue-500 text-white rounded-full shadow-xl z-40 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95';
    fab.style.background = 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)';
    fab.style.boxShadow = '0 8px 25px rgba(0, 122, 255, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)';
    fab.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"/>
        </svg>
    `;
    fab.onclick = toggleAiChat;
    fab.title = getLocalizedText('ai_assistant');
    
    // Add pulsing animation to attract attention initially
    fab.style.animation = 'pulse 2s infinite';
    setTimeout(() => {
        fab.style.animation = 'none';
    }, 6000);
    
    document.body.appendChild(fab);
    
    // Add settings button in the header
    addAiSettingsButton();
}

// Add AI settings button to header
function addAiSettingsButton() {
    const header = document.querySelector('div.sticky.top-0 div.px-4.py-4');
    if (header) {
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'absolute top-4 right-4 text-ios-gray hover:text-white transition-colors duration-200';
        settingsBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
        `;
        settingsBtn.onclick = showAiSettings;
        settingsBtn.title = 'Settings';
        
        header.appendChild(settingsBtn);
    }
}

// Show AI settings modal
function showAiSettings() {
    const aiSettings = JSON.parse(localStorage.getItem(AI_CONFIG.storageKey) || '{}');
    const featureEnabled = aiSettings.featureEnabled !== false;
    
    const modal = document.createElement('div');
    modal.id = 'aiSettingsModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.onclick = (e) => {
        if (e.target === modal) hideAiSettings();
    };
    
    modal.innerHTML = `
        <div class="bg-ios-dark-2 rounded-lg p-6 m-4 max-w-sm w-full">
            <h3 class="text-lg font-semibold text-white mb-4">${getLocalizedText('settings')}</h3>
            
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <label class="text-ios-gray-2">${getLocalizedText('ai_assistant')}</label>
                    <input type="checkbox" id="aiFeatureToggle" ${featureEnabled ? 'checked' : ''} 
                           class="w-5 h-5 text-ios-blue bg-ios-dark-3 border-ios-dark-4 rounded focus:ring-ios-blue">
                </div>
                
                <div class="flex items-center justify-between">
                    <label class="text-ios-gray-2">${getLocalizedText('language')}</label>
                    <select id="aiLanguageSelect" class="bg-ios-dark-3 text-white rounded px-3 py-1 border border-ios-dark-4">
                        <option value="auto">${getLocalizedText('auto_detect')}</option>
                        <option value="en" ${userLanguage === 'en' ? 'selected' : ''}>English</option>
                        <option value="de" ${userLanguage === 'de' ? 'selected' : ''}>Deutsch</option>
                        <option value="fr" ${userLanguage === 'fr' ? 'selected' : ''}>Français</option>
                    </select>
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button onclick="hideAiSettings()" class="flex-1 bg-ios-dark-4 text-white py-2 rounded-lg">
                    ${getLocalizedText('cancel')}
                </button>
                <button onclick="saveAiSettingsModal()" class="flex-1 bg-ios-blue text-white py-2 rounded-lg">
                    ${getLocalizedText('save')}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Hide AI settings modal
function hideAiSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (modal) {
        modal.remove();
    }
}

// Save AI settings from modal
function saveAiSettingsModal() {
    const featureToggle = document.getElementById('aiFeatureToggle');
    const languageSelect = document.getElementById('aiLanguageSelect');
    
    const aiSettings = {
        featureEnabled: featureToggle.checked,
        language: languageSelect.value === 'auto' ? detectBrowserLanguage() : languageSelect.value,
        chatVisible: aiChatVisible
    };
    
    localStorage.setItem(AI_CONFIG.storageKey, JSON.stringify(aiSettings));
    
    // Update current language
    if (languageSelect.value !== 'auto') {
        userLanguage = languageSelect.value;
    }
    
    // If user disabled feature, hide the FAB and chat
    if (!featureToggle.checked) {
        const fab = document.getElementById('aiFab');
        const chat = document.getElementById('aiChatContainer');
        if (fab) fab.remove();
        if (chat) chat.remove();
        aiChatVisible = false;
    } else {
        // If user enabled feature and FAB doesn't exist, recreate it
        if (!document.getElementById('aiFab')) {
            createAiFab();
            createAiChatInterface();
        }
    }
    
    hideAiSettings();
}

// Detect browser language
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('de') || browserLang.startsWith('gsw')) {
        return 'de';
    } else if (browserLang.startsWith('fr')) {
        return 'fr';
    } else {
        return 'en';
    }
}

// Create AI chat interface
function createAiChatInterface() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'aiChatContainer';
    chatContainer.className = `fixed inset-x-0 bottom-0 bg-ios-dark-2 border-t border-ios-dark-4 transform transition-transform duration-300 z-30 ${aiChatVisible ? 'translate-y-0' : 'translate-y-full'}`;
    chatContainer.style.height = '40vh'; // Reduced from 60vh to 40vh for less screen usage
    chatContainer.style.borderRadius = '16px 16px 0 0';
    chatContainer.style.boxShadow = '0 -4px 20px rgba(0, 0, 0, 0.3)';
    
    chatContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <!-- Chat Header with minimize button -->
            <div class="flex justify-between items-center p-3 border-b border-ios-dark-4 bg-ios-dark-1 rounded-t-2xl">
                <h3 class="text-lg font-semibold text-white">${getLocalizedText('ai_assistant')}</h3>
                <div class="flex items-center space-x-2">
                    <button onclick="minimizeAiChat()" class="text-ios-gray hover:text-white transition-colors p-1">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                        </svg>
                    </button>
                    <button onclick="toggleAiChat()" class="text-ios-gray hover:text-white transition-colors p-1">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Chat Messages -->
            <div id="aiChatMessages" class="flex-1 overflow-y-auto p-3 space-y-2">
                <!-- Messages will be added here -->
            </div>
            
            <!-- Chat Input -->
            <div class="p-3 border-t border-ios-dark-4 bg-ios-dark-1">
                <div class="flex space-x-2">
                    <input 
                        type="text" 
                        id="aiChatInput" 
                        placeholder="${getLocalizedText('ask_about_menu')}"
                        class="flex-1 bg-ios-dark-3 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue placeholder-ios-gray-2"
                        onkeypress="handleChatInputKeyPress(event)"
                    >
                    <button 
                        onclick="sendAiMessage()" 
                        class="bg-gradient-to-r from-ios-blue to-blue-500 text-white px-3 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(chatContainer);
    
    // Add welcome message
    if (aiMessages.length === 0) {
        addAiMessage('assistant', getLocalizedText('ai_welcome_message'));
    }
}

// Minimize AI chat to a smaller compact view
function minimizeAiChat() {
    const chatContainer = document.getElementById('aiChatContainer');
    if (chatContainer) {
        chatContainer.style.height = '120px';
        chatContainer.innerHTML = `
            <div class="flex items-center justify-between p-4 bg-ios-dark-1 rounded-t-2xl h-full">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gradient-to-tr from-ios-blue to-blue-500 rounded-full flex items-center justify-center">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01"/>
                        </svg>
                    </div>
                    <div>
                        <div class="text-white text-sm font-medium">${getLocalizedText('ai_assistant')}</div>
                        <div class="text-ios-gray-2 text-xs">${getLocalizedText('tap_to_expand')}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="expandAiChat()" class="text-ios-gray hover:text-white transition-colors p-1">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7l4-4m0 0l4 4m-4-4v18"/>
                        </svg>
                    </button>
                    <button onclick="toggleAiChat()" class="text-ios-gray hover:text-white transition-colors p-1">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
}

// Expand AI chat back to full view
function expandAiChat() {
    // Recreate the full chat interface
    const chatContainer = document.getElementById('aiChatContainer');
    if (chatContainer) {
        chatContainer.remove();
    }
    createAiChatInterface();
}

// Toggle AI chat visibility
function toggleAiChat() {
    aiChatVisible = !aiChatVisible;
    const chatContainer = document.getElementById('aiChatContainer');
    const fab = document.getElementById('aiFab');
    
    if (aiChatVisible) {
        chatContainer.classList.remove('translate-y-full');
        if (fab) {
            fab.style.opacity = '0.7';
            fab.style.transform = 'scale(0.9)';
        }
    } else {
        chatContainer.classList.add('translate-y-full');
        if (fab) {
            fab.style.opacity = '1';
            fab.style.transform = 'scale(1)';
        }
    }
    
    saveAiSettings();
}

// Handle chat input key press
function handleChatInputKeyPress(event) {
    if (event.key === 'Enter') {
        sendAiMessage();
    }
}

// Send message to AI
async function sendAiMessage() {
    const input = document.getElementById('aiChatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Add user message to chat
    addAiMessage('user', message);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get current menu context
        const menuContext = getCurrentMenuContext();
        
        // Generate AI response
        const response = await callAiApi(message, menuContext);
        
        // Remove typing indicator and add response
        hideTypingIndicator();
        addAiMessage('assistant', response);
        
    } catch (error) {
        console.error('AI API error:', error);
        hideTypingIndicator();
        addAiMessage('assistant', getLocalizedText('ai_error_message'));
    }
}

// Get current menu context for AI
function getCurrentMenuContext() {
    const currentTime = new Date().toLocaleTimeString();
    const currentDateStr = new Date(currentDate).toLocaleDateString();
    
    let menuItems = [];
    if (menuData && menuData.data) {
        // Filter items for current date and category
        const filteredItems = filterByDateAndCategory(menuData.data, currentDate, currentCategory);
        menuItems = filteredItems.map(item => ({
            name: item.MenuItems?.[0]?.MenuName1 || 'Unknown dish',
            type: item.Menuline?.MenulineLabel1 || currentCategory,
            price: item.MenuItems?.[0]?.MenuPrice1 || null,
            dietary: item.MenuItems?.[0]?.MenuDeclaration || null
        }));
    }
    
    return {
        date: currentDateStr,
        time: currentTime,
        category: currentCategory,
        restaurant: 'Eurest - Kaserne Timeout',
        items: menuItems,
        language: userLanguage
    };
}

// Call AI API with fallback endpoints
async function callAiApi(message, context) {
    // Detect language from user message first
    const detectedLang = detectMessageLanguage(message);
    context.language = detectedLang;
    
    const systemPrompt = getSystemPrompt(context);
    
    // Try each API endpoint until one works
    for (let i = 0; i < AI_CONFIG.apiEndpoints.length; i++) {
        const endpoint = AI_CONFIG.apiEndpoints[i];
        
        try {
            let payload, response;
            
            if (endpoint.isOllama) {
                // Ollama-style API (mlvoca.com)
                payload = {
                    model: endpoint.model,
                    prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
                    stream: false
                };
            } else {
                // OpenAI-style API
                payload = {
                    model: endpoint.model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_tokens: AI_CONFIG.maxTokens,
                    temperature: AI_CONFIG.temperature
                };
            }
            
            response = await fetch(endpoint.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...endpoint.headers
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(AI_CONFIG.timeout)
            });
            
            if (response.ok) {
                const data = await response.json();
                let aiResponse;
                
                if (endpoint.isOllama) {
                    aiResponse = data.response;
                } else {
                    aiResponse = data.choices?.[0]?.message?.content;
                }
                
                if (aiResponse) {
                    return aiResponse.trim();
                }
            }
        } catch (error) {
            console.log(`API endpoint ${i + 1} failed:`, error.message);
            // Continue to next endpoint
        }
    }
    
    // If all APIs fail, provide a fallback response
    return generateFallbackResponse(message, context);
}

// Generate system prompt with menu context
function getSystemPrompt(context) {
    const language = context.language;
    
    if (language === 'de') {
        return `Du bist ein hilfsbreiter Menü-Berater für das Restaurant "${context.restaurant}". 
        
Heutiges Datum: ${context.date}
Aktuelle Zeit: ${context.time}
Aktuelle Kategorie: ${context.category}

Verfügbare Menüs heute:
${context.items.map(item => `- ${item.name} (${item.type}${item.price ? `, ${item.price}` : ''})${item.dietary ? ` - Allergene: ${item.dietary}` : ''}`).join('\n')}

Deine Hauptaufgaben:
1. EMPFEHLUNGEN geben: Welches Gericht sollte jemand wählen basierend auf Vorlieben
2. ALLERGIE-INFORMATIONEN: Hilf bei Fragen zu Gluten, Laktose, Nüssen, etc.
3. ERNÄHRUNGSBERATUNG: Vegetarische/vegane Optionen vorschlagen
4. GESCHMACKS-TIPPS: Beschreibe wie Gerichte schmecken könnten

Sei kurz, freundlich und fokussiere dich auf praktische Empfehlungen. Antworte auf Deutsch.`;
    } else {
        return `You are a helpful menu advisor for the restaurant "${context.restaurant}".
        
Today's date: ${context.date}
Current time: ${context.time}
Current category: ${context.category}

Available menu items today:
${context.items.map(item => `- ${item.name} (${item.type}${item.price ? `, ${item.price}` : ''})${item.dietary ? ` - Allergens: ${item.dietary}` : ''}`).join('\n')}

Your main tasks:
1. RECOMMENDATIONS: Suggest which dish someone should choose based on preferences
2. ALLERGY INFORMATION: Help with questions about gluten, lactose, nuts, etc.
3. DIETARY ADVICE: Suggest vegetarian/vegan options  
4. TASTE GUIDANCE: Describe how dishes might taste

Be concise, friendly, and focus on practical recommendations rather than just listing what's available.`;
    }
}

// Add message to chat
function addAiMessage(role, content) {
    const messagesContainer = document.getElementById('aiChatMessages');
    const messageDiv = document.createElement('div');
    
    const isUser = role === 'user';
    messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} ai-message-fade-in`;
    
    messageDiv.innerHTML = `
        <div class="max-w-xs lg:max-w-sm px-3 py-2 rounded-2xl text-sm ${
            isUser 
                ? 'bg-gradient-to-r from-ios-blue to-blue-500 text-white shadow-md' 
                : 'bg-ios-dark-3 text-ios-gray-2 border border-ios-dark-4'
        }">
            <p class="whitespace-pre-wrap leading-relaxed">${content}</p>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store message
    aiMessages.push({ role, content, timestamp: new Date() });
}

// Show typing indicator
function showTypingIndicator() {
    const messagesContainer = document.getElementById('aiChatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'flex justify-start';
    
    typingDiv.innerHTML = `
        <div class="bg-ios-dark-3 text-ios-gray-2 px-4 py-2 rounded-lg">
            <div class="flex space-x-1">
                <div class="w-2 h-2 bg-ios-gray rounded-full animate-pulse"></div>
                <div class="w-2 h-2 bg-ios-gray rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-ios-gray rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Get localized text
function getLocalizedText(key) {
    const translations = {
        en: {
            ai_assistant: 'AI Assistant',
            ask_about_menu: 'Ask about today\'s menu...',
            ai_welcome_message: 'Hi! I can help you with questions about today\'s menu. What would you like to know?',
            ai_error_message: 'Sorry, I\'m having trouble responding right now. Please try again later.',
            ai_no_response: 'I couldn\'t generate a response. Please try rephrasing your question.',
            settings: 'Settings',
            language: 'Language',
            auto_detect: 'Auto-detect',
            cancel: 'Cancel',
            save: 'Save',
            tap_to_expand: 'Tap to expand'
        },
        de: {
            ai_assistant: 'KI-Assistent',
            ask_about_menu: 'Frag mich über das heutige Menü...',
            ai_welcome_message: 'Hallo! Ich kann dir bei Fragen zum heutigen Menü helfen. Was möchtest du wissen?',
            ai_error_message: 'Entschuldigung, ich habe gerade Probleme beim Antworten. Bitte versuche es später noch einmal.',
            ai_no_response: 'Ich konnte keine Antwort generieren. Bitte formuliere deine Frage anders.',
            settings: 'Einstellungen',
            language: 'Sprache',
            auto_detect: 'Automatisch erkennen',
            cancel: 'Abbrechen',
            save: 'Speichern',
            tap_to_expand: 'Zum Erweitern tippen'
        },
        fr: {
            ai_assistant: 'Assistant IA',
            ask_about_menu: 'Demandez-moi à propos du menu d\'aujourd\'hui...',
            ai_welcome_message: 'Salut! Je peux vous aider avec des questions sur le menu d\'aujourd\'hui. Que voulez-vous savoir?',
            ai_error_message: 'Désolé, j\'ai des problèmes à répondre en ce moment. Veuillez réessayer plus tard.',
            ai_no_response: 'Je n\'ai pas pu générer une réponse. Veuillez reformuler votre question.',
            settings: 'Paramètres',
            language: 'Langue',
            auto_detect: 'Détection automatique',
            cancel: 'Annuler',
            save: 'Sauvegarder',
            tap_to_expand: 'Toucher pour agrandir'
        }
    };
    
    return translations[userLanguage]?.[key] || translations.en[key] || key;
}

// Detect language from user message
function detectMessageLanguage(message) {
    const germanKeywords = ['hallo', 'was', 'gibt', 'heute', 'mittagessen', 'empfehlen', 'empfehlung', 'preis', 'kosten', 'vegetarisch', 'vegan', 'danke', 'bitte', 'guten', 'morgen', 'abend', 'speisekarte', 'menü', 'essen', 'trinken'];
    const lowerMessage = message.toLowerCase();
    
    const germanMatches = germanKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    
    // If we find German keywords, switch language
    if (germanMatches > 0) {
        userLanguage = 'de';
        saveAiSettings();
        return 'de';
    }
    
    return userLanguage;
}

// Generate fallback response when APIs are unavailable
function generateFallbackResponse(message, context) {
    const lowerMessage = message.toLowerCase();
    // Detect language dynamically from the user's message
    const lang = detectMessageLanguage(message);
    
    // Focus on recommendations and suggestions
    if (lowerMessage.includes('recommend') || lowerMessage.includes('empfehlen') || lowerMessage.includes('suggest') || lowerMessage.includes('was soll ich')) {
        if (context.items.length > 0) {
            const randomItem = context.items[Math.floor(Math.random() * context.items.length)];
            return lang === 'de'
                ? `Ich empfehle dir heute "${randomItem.name}" - das ist eine gute Wahl! ${randomItem.dietary ? `Bitte beachte: ${randomItem.dietary}` : 'Informiere dich über Allergene bei der Ausgabe.'}`
                : `I recommend "${randomItem.name}" today - it's a great choice! ${randomItem.dietary ? `Please note: ${randomItem.dietary}` : 'Check for allergens at the serving counter.'}`;
        } else {
            return lang === 'de'
                ? 'Heute ist leider kein Menü verfügbar. Ich empfehle, morgen wiederzukommen oder nach Alternativen im Restaurant zu fragen.'
                : 'Unfortunately, no menu is available today. I recommend coming back tomorrow or asking for alternatives at the restaurant.';
        }
    }
    
    // Handle allergy and dietary questions
    if (lowerMessage.includes('allerg') || lowerMessage.includes('gluten') || lowerMessage.includes('lactose') || lowerMessage.includes('laktose') || lowerMessage.includes('vegetarian') || lowerMessage.includes('vegan') || lowerMessage.includes('vegetarisch')) {
        const dietaryItems = context.items.filter(item => item.dietary);
        if (dietaryItems.length > 0) {
            const allergyInfo = dietaryItems.map(item => `• ${item.name}: ${item.dietary}`).join('\n');
            return lang === 'de'
                ? `Hier sind die Allergie-Informationen für heute:\n\n${allergyInfo}\n\nFrage gerne nach, wenn du spezifische Allergien hast!`
                : `Here's the allergy information for today:\n\n${allergyInfo}\n\nFeel free to ask if you have specific allergies!`;
        } else {
            return lang === 'de'
                ? 'Für detaillierte Allergie-Informationen wende dich bitte direkt an das Personal im Restaurant. Sie können dir bei spezifischen Fragen zu Gluten, Laktose, Nüssen und anderen Allergenen helfen.'
                : 'For detailed allergy information, please contact the restaurant staff directly. They can help you with specific questions about gluten, lactose, nuts, and other allergens.';
        }
    }
    
    // Handle general menu questions with focus on guidance
    if (lowerMessage.includes('menu') || lowerMessage.includes('today') || lowerMessage.includes('available') || lowerMessage.includes('essen') || lowerMessage.includes('mittagessen')) {
        if (context.items.length === 0) {
            return lang === 'de' 
                ? `Heute ist ${context.date} und es ist gerade ${context.category}zeit. Leider ist im Moment kein Menü verfügbar. Kann ich dir bei etwas anderem helfen?`
                : `Today is ${context.date} and it's ${context.category} time. Unfortunately, no menu is currently available. Can I help you with something else?`;
        } else {
            const recommendation = context.items[Math.floor(Math.random() * context.items.length)];
            return lang === 'de'
                ? `Heute gibt es ${context.items.length} Optionen für ${context.category}. Mein Tipp: "${recommendation.name}" - das klingt besonders gut! Möchtest du eine Empfehlung basierend auf deinen Vorlieben?`
                : `Today there are ${context.items.length} options for ${context.category}. My suggestion: "${recommendation.name}" - that sounds particularly good! Would you like a recommendation based on your preferences?`;
        }
    }
    
    // Handle price questions
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('preis') || lowerMessage.includes('kosten')) {
        const itemsWithPrices = context.items.filter(item => item.price);
        if (itemsWithPrices.length > 0) {
            const cheapest = itemsWithPrices.reduce((min, item) => {
                const price = parseFloat(item.price.replace(/[^\d.,]/g, '').replace(',', '.'));
                const minPrice = parseFloat(min.price.replace(/[^\d.,]/g, '').replace(',', '.'));
                return price < minPrice ? item : min;
            });
            return lang === 'de'
                ? `Der günstigste Option heute ist "${cheapest.name}" für ${cheapest.price}. Soll ich dir alle Preise zeigen oder eine Empfehlung in deinem Budget geben?`
                : `The most affordable option today is "${cheapest.name}" for ${cheapest.price}. Should I show you all prices or give you a recommendation within your budget?`;
        }
    }
    
    // Generic helpful response focused on assistance
    return lang === 'de'
        ? 'Ich helfe gerne bei Menü-Empfehlungen, Allergie-Fragen oder Ernährungsberatung! Was interessiert dich besonders?'
        : 'I\'m happy to help with menu recommendations, allergy questions, or dietary advice! What interests you most?';
}

// Check if AI assistant is enabled
function isAiEnabled() {
    return AI_CONFIG.enabled;
}