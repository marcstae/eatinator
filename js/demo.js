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
    const imageHtml = generateImageHtml(item.dishName, item.menuType);

    return `
        <div class="swiftui-card p-4 rounded-xl">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-white flex-1 pr-3 text-lg leading-tight">${item.dishName}</h3>
                ${priceHtml}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${menuTypeBadge}
            </div>
            ${imageHtml}
        </div>
    `;
}

// Initialize demo
function initDemo() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = demoMenuItems.map(item => createMenuItemHtml(item)).join('');
}

// Start demo when page loads
document.addEventListener('DOMContentLoaded', initDemo);