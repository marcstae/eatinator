// Navigation functionality for weeks, days, and categories

// Generate day buttons for the current week
function generateWeekDays() {
    const dayButtonsContainer = document.getElementById('dayButtons');
    const today = new Date(currentDate);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const currentWeekStart = new Date(today);
    
    // Get Monday of current week
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(today.getDate() + daysToMonday);
    
    let buttonsHtml = '';
    
    // Generate 5 day buttons (Monday to Friday)
    for (let i = 0; i < 5; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        
        const dateStr = date.toISOString().split('T')[0];
        const dayName = dayNames[i];
        const dayNumber = date.getDate();
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        
        buttonsHtml += `
            <button onclick="selectDay('${dateStr}', '${dayName}')" 
                    class="day-button swiftui-button py-3 px-2 text-center font-medium text-sm rounded-lg bg-ios-dark-3 text-ios-gray-2 ${isToday ? 'active' : ''}" 
                    data-date="${dateStr}">
                <div class="text-xs opacity-75">${dayName}</div>
                <div class="text-lg font-semibold">${dayNumber}</div>
            </button>
        `;
    }
    
    dayButtonsContainer.innerHTML = buttonsHtml;
}

// Update week label
function updateWeekLabel() {
    document.getElementById('weekLabel').textContent = `Week ${currentWeek}, ${currentYear}`;
}

// Select a day
function selectDay(date, dayName) {
    currentDate = date;
    
    // Update button states
    document.querySelectorAll('.day-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedBtn = document.querySelector(`[data-date="${date}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    loadMenu();
}

// Select category
function selectCategory(category) {
    currentCategory = category;
    
    // Update segment control
    document.querySelectorAll('[data-category]').forEach(btn => {
        btn.classList.remove('segment-active');
        btn.classList.add('text-ios-gray-2');
    });
    
    const selectedBtn = document.querySelector(`[data-category="${category}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('segment-active');
        selectedBtn.classList.remove('text-ios-gray-2');
    }
    
    if (menuData) {
        displayMenu(menuData);
    }
}

// Week navigation
function previousWeek() {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - 7);
    currentDate = weekStart.toISOString().split('T')[0];
    currentWeek -= 1;
    if (currentWeek < 1) {
        currentWeek = 52;
        currentYear -= 1;
    }
    generateWeekDays();
    updateWeekLabel();
    loadMenu();
}

function nextWeek() {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() + 7);
    currentDate = weekStart.toISOString().split('T')[0];
    currentWeek += 1;
    if (currentWeek > 52) {
        currentWeek = 1;
        currentYear += 1;
    }
    generateWeekDays();
    updateWeekLabel();
    loadMenu();
}

// Keyboard navigation functionality
function initKeyboardNavigation() {
    document.addEventListener('keydown', handleKeyboardNavigation);
}

function handleKeyboardNavigation(event) {
    // Skip if typing in an input field, textarea, or contenteditable
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.contentEditable === 'true') {
        return;
    }

    // Skip if kiosk mode is active
    if (kioskMode) {
        return;
    }

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            navigateCategory('up');
            break;
        case 'ArrowDown':
            event.preventDefault();
            navigateCategory('down');
            break;
        case 'ArrowLeft':
            event.preventDefault();
            navigateDay('left');
            break;
        case 'ArrowRight':
            event.preventDefault();
            navigateDay('right');
            break;
    }
}

function navigateCategory(direction) {
    const categories = ['breakfast', 'lunch', 'dinner'];
    const currentIndex = categories.indexOf(currentCategory);
    
    let newIndex;
    if (direction === 'up') {
        // Up: dinner → lunch → breakfast (reverse order)
        newIndex = currentIndex > 0 ? currentIndex - 1 : categories.length - 1;
    } else {
        // Down: breakfast → lunch → dinner (forward order)
        newIndex = currentIndex < categories.length - 1 ? currentIndex + 1 : 0;
    }
    
    selectCategory(categories[newIndex]);
}

function navigateDay(direction) {
    // Get the current week's days (Monday to Friday)
    const currentDateObj = new Date(currentDate);
    const dayOfWeek = currentDateObj.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayOfWeek = new Date(currentDateObj);
    mondayOfWeek.setDate(currentDateObj.getDate() + daysToMonday);
    
    // Calculate current day index (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4)
    const currentDayIndex = Math.floor((currentDateObj - mondayOfWeek) / (1000 * 60 * 60 * 24));
    
    let newDayIndex;
    if (direction === 'left') {
        // Left: Friday → Thursday → Wednesday → Tuesday → Monday
        newDayIndex = currentDayIndex > 0 ? currentDayIndex - 1 : 0; // Stay at Monday
    } else {
        // Right: Monday → Tuesday → Wednesday → Thursday → Friday
        newDayIndex = currentDayIndex < 4 ? currentDayIndex + 1 : 4; // Stay at Friday
    }
    
    // Calculate the new date
    const newDate = new Date(mondayOfWeek);
    newDate.setDate(mondayOfWeek.getDate() + newDayIndex);
    const newDateStr = newDate.toISOString().split('T')[0];
    
    // Get day name for the new date
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayName = dayNames[newDayIndex];
    
    selectDay(newDateStr, dayName);
}