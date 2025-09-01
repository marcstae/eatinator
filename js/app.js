// Main application initialization

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (kioskMode) {
        initKioskMode();
    } else {
        initNormalMode();
    }
});

// Initialize normal mode
function initNormalMode() {
    generateWeekDays();
    updateWeekLabel();
    
    // Set the correct meal category button as active
    selectCategory(currentCategory);
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    selectDay(currentDate, dayNames[dayOfWeek]);
    loadMenu();
    
    // Initialize AI Assistant if enabled
    if (typeof initAiAssistant === 'function' && isAiEnabled()) {
        initAiAssistant();
    }
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('data:text/javascript,console.log("SW loaded")');
    }
}

// Initialize kiosk mode
function initKioskMode() {
    hideKioskElements();
    loadKioskMenu();
    
    // Add kiosk-scroll class to html for enhanced scrolling behavior
    document.documentElement.classList.add('kiosk-scroll');
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('data:text/javascript,console.log("SW loaded")');
    }
}

// Hide elements not needed in kiosk mode
function hideKioskElements() {
    // Hide week navigation
    const weekNav = document.querySelector('.px-4.py-3.border-b.border-ios-dark-4');
    if (weekNav) {
        weekNav.style.display = 'none';
    }
    
    // Hide day selection
    const daySelection = document.querySelector('.px-4.py-4');
    if (daySelection) {
        daySelection.style.display = 'none';
    }
    
    // Hide bottom navigation (meal categories)
    const bottomNav = document.querySelector('.fixed.bottom-0');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

// Load menu for kiosk mode (all categories for today)
async function loadKioskMenu() {
    const menuContainer = document.getElementById('menuContainer');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    
    // Show loading state
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    menuContainer.innerHTML = '';
    
    try {
        // Load menu data for today
        const response = await fetch(buildApiUrl(currentDate));
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayKioskMenu(data);
        
    } catch (error) {
        console.error('Error loading kiosk menu:', error);
        // In kiosk mode, show demo data instead of error
        displayKioskMenuWithDemoData();
    }
}

// Display menu in kiosk mode (all categories combined)
function displayKioskMenu(data) {
    const menuContainer = document.getElementById('menuContainer');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');

    loadingState.classList.add('hidden');

    if (!data || !data.data || (Array.isArray(data.data) && data.data.length === 0)) {
        errorState.classList.remove('hidden');
        return;
    }

    let menuItems = data.data || [];
    
    // Get all categories for today
    const categories = ['breakfast', 'lunch', 'dinner'];
    let allMenuHtml = '';
    
    categories.forEach(category => {
        const filteredItems = filterByDateAndCategory(menuItems, currentDate, category);
        
        if (filteredItems.length > 0) {
            // Add category header
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
            allMenuHtml += `
                <div class="kiosk-category-header mb-4 mt-8 first:mt-0">
                    <h2 class="text-2xl font-bold text-white text-center">${categoryTitle}</h2>
                    <div class="w-16 h-1 bg-ios-blue mx-auto mt-2 rounded-full"></div>
                </div>
            `;
            
            // Add menu items for this category
            const categoryMenuHtml = filteredItems.map(item => createKioskMenuItemHtml(item)).join('');
            allMenuHtml += `<div class="space-y-4 mb-8">${categoryMenuHtml}</div>`;
        }
    });
    
    if (allMenuHtml === '') {
        menuContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="text-ios-gray text-2xl mb-2">No menu available</div>
                <div class="text-ios-gray-2 text-lg">for ${new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
        `;
    } else {
        menuContainer.innerHTML = allMenuHtml;
        
        // Start auto-scroll if content is larger than screen
        setupAutoScroll();
    }
}

// Create HTML for a menu item in kiosk mode
function createKioskMenuItemHtml(item) {
    const menulineLabel = item.Menuline?.MenulineLabel1 ? 
        JSON.parse(item.Menuline.MenulineLabel1).DE || item.Menuline.MenulineKey1 : 'Menu Item';
    
    // Get the actual dish description (ingredients combined)
    const ingredients = [];
    for (let i = 1; i <= 4; i++) {
        const ingredient = item[`MenuIngredients${i}`];
        if (ingredient) {
            const parsed = JSON.parse(ingredient);
            if (parsed.DE && parsed.DE.trim()) ingredients.push(parsed.DE.trim());
        }
    }
    const dishName = ingredients.join(', ').replace(/,+/g, ',').replace(/,\s*,/g, ',') || 'No description available';
    
    const price = item.MenuPrice1 || 0;
    
    // Process dietary information with colors
    const declarations = item.MenuDeclaration || [];
    const dietaryInfo = declarations.map(decl => {
        if (decl.MenuDeclarationLabel1) {
            const parsed = JSON.parse(decl.MenuDeclarationLabel1);
            const label = parsed.DE || parsed.EN || 'Unknown';
            
            // Determine color class based on dietary type
            let colorClass = 'dietary-badge';
            const labelLower = label.toLowerCase();
            
            if (labelLower.includes('vegetarisch') || labelLower.includes('vegetarian')) {
                colorClass += ' vegetarian';
            } else if (labelLower.includes('schwein') || labelLower.includes('pork')) {
                colorClass += ' pork';
            } else if (labelLower.includes('rindfleisch') || labelLower.includes('beef')) {
                colorClass += ' beef';
            } else if (labelLower.includes('geflügel') || labelLower.includes('poultry')) {
                colorClass += ' poultry';
            } else if (labelLower.includes('fisch') || labelLower.includes('fish')) {
                colorClass += ' fish';
            } else if (labelLower.includes('kalbfleisch') || labelLower.includes('veal')) {
                colorClass += ' veal';
            }
            
            return { label, colorClass };
        }
        return null;
    }).filter(info => info);
    
    const priceHtml = price > 0 ? `<span class="price-badge text-sm px-3 py-1 rounded-full">CHF ${price.toFixed(2)}</span>` : '';
    
    // Menu type badge (Menu, Vegi, Hit, etc.)
    const menuTypeBadge = `<span class="menu-type-badge text-sm px-2 py-1 rounded-full">${menulineLabel}</span>`;
    
    // Create dietary badges with different colors
    const dietaryHtml = dietaryInfo.length > 0 ? 
        dietaryInfo.map(info => `<span class="${info.colorClass} text-sm px-2 py-1 rounded-full mr-2">${info.label}</span>`).join('') : '';

    // Generate kiosk voting HTML (read-only numbers)
    const votingHtml = generateKioskVotingHtml(dishName, menulineLabel);
    
    // Generate kiosk image HTML (slideshow instead of modal)
    const imageHtml = generateKioskImageHtml(dishName, menulineLabel);

    return `
        <div class="swiftui-card p-6 rounded-xl">
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-semibold text-white flex-1 pr-3 text-xl leading-tight">${dishName}</h3>
                ${priceHtml}
            </div>
            <div class="flex flex-wrap gap-2 mb-4">
                ${menuTypeBadge}
                ${dietaryHtml}
            </div>
            ${votingHtml}
            ${imageHtml}
        </div>
    `;
}

// Generate kiosk voting HTML (read-only numbers)
function generateKioskVotingHtml(dishName, menuType) {
    const voteKey = getVoteKey(dishName, menuType, currentDate, 'lunch'); // Use lunch as default for kiosk
    // Use local votes initially, will be updated by loadKioskVotesForItem
    const votes = getVotes(voteKey);

    const voteDisplay = Object.values(VOTE_TYPES).map(voteType => {
        const emoji = VOTE_EMOJIS[voteType];
        const count = votes[voteType];
        
        return `
            <span class="kiosk-vote-item text-lg px-3 py-2 rounded-lg bg-ios-dark-3">
                <span class="text-xl">${emoji}</span>
                <span class="text-lg font-medium ml-2">${count}</span>
            </span>
        `;
    }).join('');

    return `
        <div class="border-t border-ios-gray border-opacity-20 pt-3 mt-3" data-kiosk-vote-key="${voteKey}">
            <div class="flex justify-between items-center">
                <span class="text-ios-gray-2 text-lg font-medium">Reactions:</span>
                <div class="flex gap-3">
                    ${voteDisplay}
                </div>
            </div>
        </div>
    `;
}

// Generate kiosk image HTML (slideshow display)
function generateKioskImageHtml(dishName, menuType) {
    const imageKey = getImageKey(dishName, menuType, currentDate);
    
    return `
        <div class="kiosk-images-container mt-4" data-image-key="${imageKey}">
            <div class="kiosk-slideshow" id="slideshow-${imageKey.replace(/[^a-zA-Z0-9]/g, '_')}">
                <!-- Images will be loaded here -->
            </div>
        </div>
    `;
}

// Helper function to get current document height
function getCurrentDocumentHeight() {
    const body = document.body;
    const html = document.documentElement;
    return Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
    );
}

// Auto-scroll functionality
function setupAutoScroll() {
    // Clear any existing interval
    if (window.autoScrollInterval) {
        clearInterval(window.autoScrollInterval);
    }
    
    // Check if content height is larger than screen height to determine if scrolling is needed
    const initialDocumentHeight = getCurrentDocumentHeight();
    const screenHeight = window.innerHeight;
    
    console.log('Auto-scroll check:', { 
        documentHeight: initialDocumentHeight, 
        screenHeight, 
        willScroll: initialDocumentHeight > screenHeight 
    });
    
    if (initialDocumentHeight > screenHeight) {
        // Start auto-scroll every 30 seconds
        window.autoScrollInterval = setInterval(() => {
            // Recalculate document height on each scroll to handle dynamic content
            const currentDocumentHeight = getCurrentDocumentHeight();
            const currentScreenHeight = window.innerHeight;
            const currentScroll = window.pageYOffset;
            const maxScroll = currentDocumentHeight - currentScreenHeight;
            
            // Skip scrolling if content no longer needs scrolling
            if (currentDocumentHeight <= currentScreenHeight) {
                return;
            }
            
            if (currentScroll >= maxScroll) {
                // Scroll back to top with smooth but quick transition
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Scroll down by screen height with smooth but quick transition
                window.scrollTo({ 
                    top: Math.min(currentScroll + currentScreenHeight, maxScroll), 
                    behavior: 'smooth' 
                });
            }
        }, 30000); // 30 seconds
        
        console.log('Auto-scroll started with interval:', window.autoScrollInterval);
    }
}

// Load images for all kiosk menu items
async function loadKioskImages() {
    const imageContainers = document.querySelectorAll('.kiosk-images-container');
    
    for (const container of imageContainers) {
        const imageKey = container.getAttribute('data-image-key');
        if (imageKey) {
            try {
                // For demo purposes, we'll use placeholder images
                // In real implementation, this would call getImages()
                const demoImages = generateDemoImages(imageKey);
                if (demoImages.length > 0) {
                    displayKioskSlideshow(container, demoImages);
                }
            } catch (error) {
                console.log('Failed to load images for', imageKey, error);
            }
        }
    }
}

// Generate demo images for testing
function generateDemoImages(imageKey) {
    // Return some demo images for testing
    const imageCount = Math.floor(Math.random() * 4) + 1; // 1-4 images
    const images = [];
    
    for (let i = 0; i < imageCount; i++) {
        images.push({
            url: `https://picsum.photos/300/200?random=${imageKey}_${i}`,
            originalName: `food_photo_${i + 1}.jpg`,
            timestamp: new Date(Date.now() - Math.random() * 86400000).toLocaleString()
        });
    }
    
    return images;
}

// Display slideshow in kiosk mode
function displayKioskSlideshow(container, images) {
    const slideshowId = container.querySelector('.kiosk-slideshow').id;
    const slideshow = document.getElementById(slideshowId);
    
    if (images.length === 0) {
        slideshow.style.display = 'none';
        return;
    }
    
    let currentImageIndex = 0;
    
    // Create slideshow HTML
    slideshow.innerHTML = `
        <div class="relative bg-ios-dark-3 rounded-lg overflow-hidden" style="height: 200px;">
            <img id="${slideshowId}_img" 
                 src="${images[0].url}" 
                 alt="${images[0].originalName}"
                 class="w-full h-full object-cover transition-opacity duration-500">
            <div class="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                <div class="text-xs text-white bg-black bg-opacity-50 rounded px-2 py-1">
                    ${images.length} photo${images.length > 1 ? 's' : ''}
                </div>
                <div class="text-xs text-white bg-black bg-opacity-50 rounded px-2 py-1">
                    ${currentImageIndex + 1}/${images.length}
                </div>
            </div>
        </div>
    `;
    
    // Start slideshow rotation if there are multiple images
    if (images.length > 1) {
        setInterval(() => {
            currentImageIndex = (currentImageIndex + 1) % images.length;
            const imgElement = document.getElementById(`${slideshowId}_img`);
            const counterElement = slideshow.querySelector('.absolute .text-xs:last-child');
            
            if (imgElement) {
                imgElement.style.opacity = '0';
                setTimeout(() => {
                    imgElement.src = images[currentImageIndex].url;
                    imgElement.alt = images[currentImageIndex].originalName;
                    imgElement.style.opacity = '1';
                }, 250);
            }
            
            if (counterElement) {
                counterElement.textContent = `${currentImageIndex + 1}/${images.length}`;
            }
        }, 4000); // Change image every 4 seconds
    }
}

// Display kiosk menu with demo data for testing
function displayKioskMenuWithDemoData() {
    const menuContainer = document.getElementById('menuContainer');
    const loadingState = document.getElementById('loadingState');
    
    loadingState.classList.add('hidden');
    
    // Demo menu data for all categories
    const demoData = {
        breakfast: [
            {
                name: "Bircher Müsli mit Früchten",
                type: "Frühstück",
                price: 4.50,
                dietary: ["Vegetarisch"],
                votes: { good: 12, neutral: 3, bad: 1 }
            },
            {
                name: "Rösti mit Spiegelei",
                type: "Warm",
                price: 8.90,
                dietary: ["Ei"],
                votes: { good: 8, neutral: 2, bad: 0 }
            }
        ],
        lunch: [
            {
                name: "Geschnetzeltes Zürcher Art mit Rösti",
                type: "Menu",
                price: 12.50,
                dietary: ["Fleisch"],
                votes: { good: 25, neutral: 8, bad: 2 }
            },
            {
                name: "Gemüse-Curry mit Basmatireis",
                type: "Vegi",
                price: 11.90,
                dietary: ["Vegetarisch", "Vegan"],
                votes: { good: 18, neutral: 4, bad: 1 }
            },
            {
                name: "Pasta Bolognese",
                type: "Hit",
                price: 9.80,
                dietary: ["Rindfleisch"],
                votes: { good: 22, neutral: 6, bad: 3 }
            }
        ],
        dinner: [
            {
                name: "Grilliertes Poulet mit Gemüse",
                type: "Abendmenu",
                price: 14.20,
                dietary: ["Geflügel"],
                votes: { good: 15, neutral: 5, bad: 1 }
            },
            {
                name: "Crème Brûlée",
                type: "Tagesdessert",
                price: 4.80,
                dietary: ["Ei", "Milch"],
                votes: { good: 20, neutral: 2, bad: 0 }
            }
        ]
    };
    
    // Build HTML for all categories
    let allMenuHtml = '';
    
    Object.keys(demoData).forEach(category => {
        const items = demoData[category];
        
        if (items.length > 0) {
            // Add category header
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
            allMenuHtml += `
                <div class="kiosk-category-header mb-6 mt-8 first:mt-0">
                    <h2 class="text-3xl font-bold text-white text-center">${categoryTitle}</h2>
                    <div class="w-20 h-1 bg-ios-blue mx-auto mt-3 rounded-full"></div>
                </div>
            `;
            
            // Add menu items for this category
            const categoryMenuHtml = items.map(item => createDemoKioskMenuItemHtml(item)).join('');
            allMenuHtml += `<div class="space-y-6 mb-12">${categoryMenuHtml}</div>`;
        }
    });
    
    menuContainer.innerHTML = allMenuHtml;
    
    // Load images for all menu items after rendering
    if (IMAGE_CONFIG.enabled) {
        loadKioskImages();
    }
    
    // Start auto-scroll if content is larger than screen
    setupAutoScroll();
}

// Create HTML for demo menu item in kiosk mode
function createDemoKioskMenuItemHtml(item) {
    const priceHtml = item.price > 0 ? `<span class="price-badge text-lg px-4 py-2 rounded-full">CHF ${item.price.toFixed(2)}</span>` : '';
    
    // Menu type badge
    const menuTypeBadge = `<span class="menu-type-badge text-lg px-3 py-2 rounded-full">${item.type}</span>`;
    
    // Create dietary badges
    const dietaryHtml = item.dietary.length > 0 ? 
        item.dietary.map(diet => `<span class="dietary-badge text-lg px-3 py-2 rounded-full mr-3">${diet}</span>`).join('') : '';

    // Generate image key for slideshow
    const imageKey = `img_${currentDate}_${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${item.type.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Generate kiosk voting HTML (read-only numbers)
    const votingHtml = `
        <div class="border-t border-ios-gray border-opacity-20 pt-4 mt-4">
            <div class="flex justify-between items-center">
                <span class="text-ios-gray-2 text-xl font-medium">Reactions:</span>
                <div class="flex gap-4">
                    <span class="kiosk-vote-item text-xl px-4 py-3 rounded-lg bg-ios-dark-3">
                        <span class="text-2xl">🤩</span>
                        <span class="text-xl font-medium ml-3">${item.votes.good}</span>
                    </span>
                    <span class="kiosk-vote-item text-xl px-4 py-3 rounded-lg bg-ios-dark-3">
                        <span class="text-2xl">😐</span>
                        <span class="text-xl font-medium ml-3">${item.votes.neutral}</span>
                    </span>
                    <span class="kiosk-vote-item text-xl px-4 py-3 rounded-lg bg-ios-dark-3">
                        <span class="text-2xl">🤮</span>
                        <span class="text-xl font-medium ml-3">${item.votes.bad}</span>
                    </span>
                </div>
            </div>
        </div>
    `;

    // Generate image slideshow container
    const imageHtml = `
        <div class="kiosk-images-container mt-4" data-image-key="${imageKey}">
            <div class="kiosk-slideshow" id="slideshow-${imageKey}">
                <!-- Images will be loaded here -->
            </div>
        </div>
    `;

    return `
        <div class="swiftui-card p-8 rounded-xl">
            <div class="flex justify-between items-start mb-4">
                <h3 class="font-semibold text-white flex-1 pr-4 text-2xl leading-tight">${item.name}</h3>
                ${priceHtml}
            </div>
            <div class="flex flex-wrap gap-3 mb-5">
                ${menuTypeBadge}
                ${dietaryHtml}
            </div>
            ${votingHtml}
            ${imageHtml}
        </div>
    `;
}