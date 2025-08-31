// Main application initialization

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UwU mode if previously enabled
    if (uwuModeEnabled) {
        document.body.classList.add('uwu-mode');
    }
    
    generateWeekDays();
    updateWeekLabel();
    
    // Set the correct meal category button as active
    selectCategory(currentCategory);
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    selectDay(currentDate, dayNames[dayOfWeek]);
    loadMenu();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('data:text/javascript,console.log("SW loaded")');
    }
});