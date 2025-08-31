// UwU mode functionality

// UwU text transformation
function uwuifyText(text) {
    if (!uwuModeEnabled || !text) return text;
    
    return text
        .toLowerCase()
        .replace(/r/g, 'w')
        .replace(/l/g, 'w')
        .replace(/n([aeiou])/g, 'ny$1')
        .replace(/ove/g, 'uv')
        .replace(/\b(you|u)\b/g, 'uwu')
        .replace(/th/g, 'f')
        .replace(/\b(the)\b/g, 'da')
        .replace(/!/g, ' uwu!')
        .replace(/\./g, ' owo.')
        + (Math.random() > 0.7 ? ' >w<' : Math.random() > 0.5 ? ' uwu' : ' owo');
}

// Handle title click for UwU mode activation
function handleTitleClick() {
    titleClickCount++;
    
    // Clear any existing timeout
    if (titleClickTimeout) {
        clearTimeout(titleClickTimeout);
    }
    
    // Reset counter after 3 seconds of inactivity
    titleClickTimeout = setTimeout(() => {
        titleClickCount = 0;
    }, 3000);
    
    // Activate UwU mode after 5 clicks
    if (titleClickCount >= 5) {
        titleClickCount = 0;
        toggleUwuMode();
    }
}

// Toggle UwU mode
function toggleUwuMode() {
    uwuModeEnabled = !uwuModeEnabled;
    localStorage.setItem('uwuModeEnabled', uwuModeEnabled);
    
    // Apply/remove uwu mode class to body
    if (uwuModeEnabled) {
        document.body.classList.add('uwu-mode');
    } else {
        document.body.classList.remove('uwu-mode');
    }
    
    // Refresh menu display if data is available
    if (menuData) {
        displayMenu(menuData);
    }
    
    // Show a subtle indication that UwU mode was toggled
    const title = document.querySelector('h1');
    if (title) {
        title.style.transform = 'scale(1.1)';
        setTimeout(() => {
            title.style.transform = 'scale(1)';
        }, 200);
    }
}