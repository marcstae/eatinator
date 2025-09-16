// Menu loading and display functionality

// Generate base64 payload for the current week (using correct API format)
function generateCurrentPayload(date) {
    const targetDate = new Date(date);
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - targetDate.getDay() + 1);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const formatDate = (d) => d.toISOString().split('T')[0];
    const startDate = formatDate(startOfWeek);
    const endDate = formatDate(endOfWeek);
    const currentDate = formatDate(targetDate);
    
    const fieldsStart = '100-0/+MenuDate1&+MenuOrder1/ID';
    const otherFields = [
        'MenuDate1',
        'MenuIngredients1',
        'MenuIngredients2',
        'MenuIngredients3', 
        'MenuIngredients4',
        'MenuPricePrefix1',
        'MenuPrice1',
        'MenuPrice2',
        'MenuPrice3',
        'MenuPrice4',
        'MenuPriceDescription1',
        'MenuPriceDescription2',
        'MenuPriceDescription3',
        'MenuPriceDescription4',
        'Menuline.ID',
        'Menuline._LanguageConfig',
        'Menuline.MenulineLabel1',
        'Menuline.MenulineKey1',
        'Menuline.MenulineOrder1',
        'Menuline.Outlet',
        'Special',
        'MenuDeclaration',
        '_LanguageConfig',
        'Outlet.ID',
        'MenuAdditionalInformation1',
        'MenuNutriscore1',
        'MenuEcoscore1',
        'MenuAcidBased1'
    ];
    
    const filters = [
        `MenuOrder1/MenuDate1=bt:{{${startDate}|${endDate}}}`,
        `MenuDate1=ge:{{${currentDate}}}`,
        'Outlet=eq:{{578}}',
        `MenuDate1=le:{{${endDate}}}`
    ];
    
    const params = [fieldsStart, ...otherFields, ...filters].join('&');
    return btoa(encodeURIComponent(params));
}

// Build API URL
function buildApiUrl(date) {
    const baseUrl = 'https://clients.eurest.ch/api/Menu';
    const base64Payload = generateCurrentPayload(date);
    return `${baseUrl}/${base64Payload}`;
}

// Load menu data from API
async function loadMenu() {
    const loadingState = document.getElementById('loadingState');
    const menuContainer = document.getElementById('menuContainer');
    const errorState = document.getElementById('errorState');

    loadingState.classList.remove('hidden');
    menuContainer.innerHTML = '';
    errorState.classList.add('hidden');

    try {
        const apiUrl = buildApiUrl(currentDate);
        console.log('Fetching from:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                'Referer': 'https://clients.eurest.ch/kaserne/de/Timeout'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        menuData = data;
        displayMenu(data);

    } catch (error) {
        console.error('Error loading menu:', error);
        errorState.classList.remove('hidden');
    } finally {
        loadingState.classList.add('hidden');
    }
}

// Display menu items
function displayMenu(data) {
    const menuContainer = document.getElementById('menuContainer');
    const errorState = document.getElementById('errorState');

    if (!data || !data.data || (Array.isArray(data.data) && data.data.length === 0)) {
        errorState.classList.remove('hidden');
        return;
    }

    let menuItems = data.data || [];
    const filteredItems = filterByDateAndCategory(menuItems, currentDate, currentCategory);
    
    if (filteredItems.length === 0) {
        menuContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="text-ios-gray text-lg mb-2">No ${currentCategory} menu available</div>
                <div class="text-ios-gray-2 text-sm">for ${new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
        `;
        return;
    }

    const menuHtml = filteredItems.map(item => createMenuItemHtml(item)).join('');
    menuContainer.innerHTML = menuHtml;
    menuContainer.classList.add('slide-up');
    
    // Load server-side vote counts and image counts after rendering the menu
    setTimeout(() => {
        refreshVoteCounts();
        if (typeof refreshImageCounts === 'function') {
            refreshImageCounts();
        }
    }, 100);
}

// Filter menu items by date and category
function filterByDateAndCategory(items, targetDate, category) {
    const targetDateStr = targetDate;
    const dateFilteredItems = items.filter(item => {
        if (!item.MenuDate1) return false;
        // The API returns dates like "2025-07-20T22:00:00.000Z" which is actually the next day
        // We need to parse this correctly
        const itemDate = new Date(item.MenuDate1);
        // Add one day to get the actual menu date
        itemDate.setDate(itemDate.getDate() + 1);
        const itemDateStr = itemDate.toISOString().split('T')[0];
        return itemDateStr === targetDateStr;
    });

    return dateFilteredItems.filter(item => {
        if (!item.Menuline || !item.Menuline.MenulineKey1) return true;
        
        const menulineKey = item.Menuline.MenulineKey1.toLowerCase();
        
        switch (category) {
            case 'breakfast':
                return menulineKey.includes('frühstück');
            case 'lunch':
                return menulineKey === 'menu' || menulineKey === 'vegi' || menulineKey === 'hit';
            case 'dinner':
                return menulineKey.includes('abend') || menulineKey === 'tagesdessert';
            default:
                return true;
        }
    });
}

// Create HTML for a menu item
function createMenuItemHtml(item) {
    const menulineLabel = item.Menuline?.MenulineLabel1 ? 
        JSON.parse(item.Menuline.MenulineLabel1).DE || item.Menuline.MenulineKey1 : 'Menu Item';
    
    // Get the actual dish description (ingredients combined) - this should be the main title
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
    
    const priceHtml = price > 0 ? `<span class="price-badge text-xs px-3 py-1 rounded-full">CHF ${price.toFixed(2)}</span>` : '';
    
    // Menu type badge (Menu, Vegi, Hit, etc.) - with UwU transformation
    const displayMenulineLabel = uwuifyText(menulineLabel);
    const menuTypeBadge = `<span class="menu-type-badge text-xs px-2 py-1 rounded-full">${displayMenulineLabel}</span>`;
    
    // Create dietary badges with different colors - with UwU transformation
    const dietaryHtml = dietaryInfo.length > 0 ? 
        dietaryInfo.map(info => {
            const displayLabel = uwuifyText(info.label);
            return `<span class="${info.colorClass} text-xs px-2 py-1 rounded-full mr-2">${displayLabel}</span>`;
        }).join('') : '';

    // Apply UwU transformation to dish name
    const displayDishName = uwuifyText(dishName);

    // Generate voting HTML if voting is active (this now includes image button)
    const votingHtml = generateVotingHtml(dishName, menulineLabel);
    
    // Don't show standalone image buttons - they only appear with voting buttons when voting is active
    const imageHtml = '';

    return `
        <div class="swiftui-card p-4 rounded-xl ${votingHtml || imageHtml ? '' : 'swiftui-button'}" ${votingHtml || imageHtml ? '' : `onclick="showItemDetails('${dishName.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}', '${menulineLabel.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}')"`}>
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-white flex-1 pr-3 text-lg leading-tight">${displayDishName}</h3>
                ${priceHtml}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${menuTypeBadge}
                ${dietaryHtml}
            </div>
            ${votingHtml}
            ${imageHtml}
        </div>
    `;
}

// Show item details
function showItemDetails(dishName, menuType) {
    // Create a simple modal-like alert for now - with UwU transformation
    const displayDishName = uwuifyText(dishName);
    const displayMenuType = uwuifyText(menuType);
    const message = `${displayDishName}\n\nType: ${displayMenuType}`;
    
    // For iOS, we can create a more native-looking modal
    if (window.confirm(message)) {
        // User clicked OK
    }
}

// Load weekly menu data for all days
async function loadWeeklyMenu() {
    const weeklyContainer = document.getElementById('weeklyContainer');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');

    loadingState.classList.remove('hidden');
    weeklyContainer.innerHTML = '';
    errorState.classList.add('hidden');

    try {
        const weekDays = getWeekDays();
        const weeklyData = {};
        
        // Load menu for each day of the week
        let hasAnyData = false;
        for (const day of weekDays) {
            try {
                const apiUrl = buildApiUrl(day.date);
                console.log(`Fetching weekly data for ${day.name}:`, apiUrl);

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                        'Referer': 'https://clients.eurest.ch/kaserne/de/Timeout'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    weeklyData[day.date] = {
                        data: data,
                        dayName: day.name,
                        dayNumber: day.number
                    };
                    hasAnyData = true;
                } else {
                    console.warn(`Failed to load menu for ${day.name}: ${response.status}`);
                    weeklyData[day.date] = {
                        data: null,
                        dayName: day.name,
                        dayNumber: day.number
                    };
                }
            } catch (error) {
                console.error(`Error loading menu for ${day.name}:`, error);
                weeklyData[day.date] = {
                    data: null,
                    dayName: day.name,
                    dayNumber: day.number
                };
            }
        }

        // If no data was loaded successfully, show demo data instead
        if (!hasAnyData) {
            displayWeeklyMenuWithDemoData();
        } else {
            displayWeeklyMenu(weeklyData);
        }

    } catch (error) {
        console.error('Error loading weekly menu:', error);
        // Fall back to demo data for weekly view
        displayWeeklyMenuWithDemoData();
    } finally {
        loadingState.classList.add('hidden');
    }
}

// Get week days for current week
function getWeekDays() {
    const today = new Date(currentDate);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const currentWeekStart = new Date(today);
    
    // Get Monday of current week
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(today.getDate() + daysToMonday);
    
    const weekDays = [];
    
    // Generate 5 days (Monday to Friday)
    for (let i = 0; i < 5; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        
        weekDays.push({
            date: date.toISOString().split('T')[0],
            name: dayNames[i],
            number: date.getDate()
        });
    }
    
    return weekDays;
}

// Display weekly menu overview
function displayWeeklyMenu(weeklyData) {
    const weeklyContainer = document.getElementById('weeklyContainer');
    
    if (!weeklyData || Object.keys(weeklyData).length === 0) {
        displayWeeklyMenuWithDemoData();
        return;
    }
    
    const categories = ['breakfast', 'lunch', 'dinner'];
    let weeklyHtml = '<div class="space-y-8">';
    
    // For each meal category
    categories.forEach(category => {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        
        weeklyHtml += `
            <div class="bg-ios-dark-2 rounded-xl p-4">
                <h2 class="text-xl font-bold text-white mb-4 text-center">${categoryTitle}</h2>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        `;
        
        // For each day
        Object.entries(weeklyData).forEach(([date, dayData]) => {
            const dayItems = dayData.data && dayData.data.data 
                ? filterByDateAndCategory(dayData.data.data, date, category)
                : [];
            
            weeklyHtml += `
                <div class="bg-ios-dark-3 rounded-lg p-3">
                    <div class="text-center mb-3">
                        <div class="text-ios-blue font-semibold">${dayData.dayName}</div>
                        <div class="text-2xl font-bold text-white">${dayData.dayNumber}</div>
                    </div>
                    <div class="space-y-2">
            `;
            
            if (dayItems.length === 0) {
                weeklyHtml += `
                    <div class="text-center text-ios-gray-2 text-sm py-4">
                        No ${category}<br>available
                    </div>
                `;
            } else {
                dayItems.slice(0, 3).forEach(item => { // Limit to 3 items per day per category
                    const price = (item.MenuPrice1 || item.price || 0).toFixed(2);
                    weeklyHtml += `
                        <div class="bg-ios-dark-4 rounded p-2 text-xs">
                            <div class="font-medium text-white mb-1">${item.MenuIngredients1 || item.name || 'Menu Item'}</div>
                            <div class="text-ios-blue font-semibold">CHF ${price}</div>
                        </div>
                    `;
                });
                
                if (dayItems.length > 3) {
                    weeklyHtml += `
                        <div class="text-center text-ios-gray-2 text-xs">
                            +${dayItems.length - 3} more
                        </div>
                    `;
                }
            }
            
            weeklyHtml += `
                    </div>
                </div>
            `;
        });
        
        weeklyHtml += `
                </div>
            </div>
        `;
    });
    
    weeklyHtml += '</div>';
    weeklyContainer.innerHTML = weeklyHtml;
}

// Display weekly menu with demo data (fallback)
function displayWeeklyMenuWithDemoData() {
    const weeklyContainer = document.getElementById('weeklyContainer');
    const weekDays = getWeekDays();
    
    // Demo data for weekly overview
    const demoWeeklyData = {
        breakfast: [
            { name: "Bircher Müsli", price: 4.50 },
            { name: "Croissant", price: 2.80 }
        ],
        lunch: [
            { name: "Geschnetzeltes Zürcher Art", price: 14.50 },
            { name: "Vegetarian Pasta", price: 12.90 },
            { name: "Chicken Salad", price: 11.80 }
        ],
        dinner: [
            { name: "Grilled Salmon", price: 16.80 },
            { name: "Pizza Margherita", price: 13.50 }
        ]
    };
    
    const categories = ['breakfast', 'lunch', 'dinner'];
    let weeklyHtml = '<div class="space-y-8">';
    
    categories.forEach(category => {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        const categoryItems = demoWeeklyData[category] || [];
        
        weeklyHtml += `
            <div class="bg-ios-dark-2 rounded-xl p-4">
                <h2 class="text-xl font-bold text-white mb-4 text-center">${categoryTitle}</h2>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        `;
        
        weekDays.forEach((day, dayIndex) => {
            weeklyHtml += `
                <div class="bg-ios-dark-3 rounded-lg p-3">
                    <div class="text-center mb-3">
                        <div class="text-ios-blue font-semibold">${day.name}</div>
                        <div class="text-2xl font-bold text-white">${day.number}</div>
                    </div>
                    <div class="space-y-2">
            `;
            
            // Rotate items for variety across days
            const dayItems = categoryItems.length > 0 
                ? categoryItems.slice(dayIndex % categoryItems.length, (dayIndex % categoryItems.length) + 2)
                : [];
            
            if (dayItems.length === 0) {
                weeklyHtml += `
                    <div class="text-center text-ios-gray-2 text-sm py-4">
                        No ${category}<br>available
                    </div>
                `;
            } else {
                dayItems.forEach(item => {
                    weeklyHtml += `
                        <div class="bg-ios-dark-4 rounded p-2 text-xs">
                            <div class="font-medium text-white mb-1">${item.name}</div>
                            <div class="text-ios-blue font-semibold">CHF ${item.price.toFixed(2)}</div>
                        </div>
                    `;
                });
            }
            
            weeklyHtml += `
                    </div>
                </div>
            `;
        });
        
        weeklyHtml += `
                </div>
            </div>
        `;
    });
    
    weeklyHtml += '</div>';
    weeklyContainer.innerHTML = weeklyHtml;
}