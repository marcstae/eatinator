// Application state management

// Get default meal category based on current time
function getDefaultMealCategory() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes; // Convert to minutes since midnight
    
    // Time thresholds in minutes
    const breakfastEnd = 7 * 60; // 7:00
    const lunchEnd = 16 * 60 + 30; // 16:30
    const dinnerEnd = 23 * 60 + 59; // 23:59
    
    if (currentTime <= breakfastEnd) {
        return 'breakfast';
    } else if (currentTime <= lunchEnd) {
        return 'lunch';
    } else if (currentTime <= dinnerEnd) {
        return 'dinner';
    } else {
        // This should never happen since dinner goes until 23:59
        return 'breakfast';
    }
}

// App state variables
let currentDate = new Date().toISOString().split('T')[0];
let currentCategory = getDefaultMealCategory(); // Auto-select based on time
let currentWeek = Math.ceil(((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000 + 1) / 7);
let currentYear = new Date().getFullYear();
let menuData = null;