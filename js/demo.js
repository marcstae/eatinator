// Demo-specific functionality for image upload demo

// Note: currentDate is defined in state.js, no need to redeclare

// Demo menu data
const demoMenuItems = [
    {
        dishName: "Spaghetti Carbonara, Parmesan, Bacon",
        menuType: "Menu",
        price: 12.50
    },
    {
        dishName: "Grilled Salmon, Lemon Herb Sauce, Vegetables",
        menuType: "Hit",
        price: 15.90
    },
    {
        dishName: "Vegetarian Buddha Bowl, Quinoa, Avocado",
        menuType: "Vegi",
        price: 11.20
    }
];

// Create HTML for a demo menu item
function createMenuItemHtml(item) {
    const priceHtml = item.price > 0 ? `<span class="text-ios-blue text-sm font-semibold">CHF ${item.price.toFixed(2)}</span>` : '';
    const menuTypeBadge = `<span class="bg-ios-dark-4 text-ios-gray-2 text-xs px-2 py-1 rounded-full">${item.menuType}</span>`;
    
    // For demo purposes, simulate voting being active to show inline image buttons
    const votingHtml = generateDemoVotingHtml(item.dishName, item.menuType);
    // Don't show standalone image buttons - they only appear with voting buttons
    const imageHtml = '';

    return `
        <div class="swiftui-card p-4 rounded-xl">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-white flex-1 pr-3 text-lg leading-tight">${item.dishName}</h3>
                ${priceHtml}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${menuTypeBadge}
            </div>
            ${votingHtml}
        </div>
    `;
}

// Generate demo voting HTML with image button inline
function generateDemoVotingHtml(dishName, menuType) {
    const imageKey = getImageKey(dishName, menuType, currentDate);
    
    // Demo vote buttons (enabled for demo to simulate active voting state)
    const voteButtons = `
        <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                onclick="alert('Demo: Voting functionality is disabled in demo mode')">
            <span class="text-lg">👍</span>
            <span class="text-sm font-medium">0</span>
        </button>
        <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                onclick="alert('Demo: Voting functionality is disabled in demo mode')">
            <span class="text-lg">😐</span>
            <span class="text-sm font-medium">0</span>
        </button>
        <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                onclick="alert('Demo: Voting functionality is disabled in demo mode')">
            <span class="text-lg">👎</span>
            <span class="text-sm font-medium">0</span>
        </button>
    `;

    // Image button (functional)
    const imageButtonHtml = `
        <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                onclick="handleImageButtonClick('${dishName.replace(/'/g, "\\'")}', '${menuType}')"
                data-image-button-key="${imageKey}">
            <span class="text-lg">📷</span>
            <span class="text-sm font-medium" data-image-count="${imageKey}">0</span>
        </button>
    `;

    return `
        <div class="border-t border-ios-gray border-opacity-20 pt-3 mt-3" data-vote-key="demo_${imageKey}">
            <div class="flex justify-center">
                <div class="flex gap-2">
                    ${voteButtons}
                    ${imageButtonHtml}
                </div>
            </div>
        </div>
    `;
}

// Initialize demo
function initDemo() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = demoMenuItems.map(item => createMenuItemHtml(item)).join('');
    
    // Refresh image counts after rendering demo items
    setTimeout(() => {
        if (typeof refreshImageCounts === 'function') {
            refreshImageCounts();
        }
    }, 100);
}

// Start demo when page loads
document.addEventListener('DOMContentLoaded', initDemo);