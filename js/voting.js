// Voting system functionality

// Voting time windows for each meal
const VOTING_TIMES = {
    breakfast: { start: 6 * 60, end: 7 * 60 + 15 }, // 06:00 - 07:15
    lunch: { start: 11 * 60 + 30, end: 13 * 60 }, // 11:30 - 13:00
    dinner: { start: 17 * 60 + 30, end: 19 * 60 } // 17:30 - 19:00
};

// Check if current time falls within voting window for a meal category
function isVotingTimeActive(category = currentCategory) {
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    const votingWindow = VOTING_TIMES[category];
    if (!votingWindow) return false;
    
    return currentTimeMinutes >= votingWindow.start && currentTimeMinutes <= votingWindow.end;
}

// Get voting time info for display in popups
function getVotingTimeInfo(category = currentCategory) {
    const votingWindow = VOTING_TIMES[category];
    if (!votingWindow) return null;
    
    const startHour = Math.floor(votingWindow.start / 60);
    const startMin = votingWindow.start % 60;
    const endHour = Math.floor(votingWindow.end / 60);
    const endMin = votingWindow.end % 60;
    
    const formatTime = (hour, min) => `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    
    return {
        category,
        startTime: formatTime(startHour, startMin),
        endTime: formatTime(endHour, endMin),
        isActive: isVotingTimeActive(category)
    };
}

// Check if voting is currently active (today's menu, current meal, and within voting time)
function isVotingActive() {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Voting is only active when viewing today's menu for the current meal period and within voting time
    return currentDate === today && 
           currentCategory === currentMealCategory && 
           isVotingTimeActive(currentCategory);
}

// Generate a unique key for menu item voting
function getVoteKey(dishName, menuType, date, category) {
    return `vote_${date}_${category}_${dishName.replace(/[^a-zA-Z0-9]/g, '_')}_${menuType}`;
}

// Get votes for a specific menu item
function getVotes(voteKey) {
    const votes = localStorage.getItem(voteKey);
    return votes ? JSON.parse(votes) : {
        [VOTE_TYPES.GOOD]: 0,
        [VOTE_TYPES.NEUTRAL]: 0,
        [VOTE_TYPES.BAD]: 0
    };
}

// Server-side voting functions
async function getServerVotes(voteKey) {
    if (!VOTING_CONFIG.enabled) {
        return null;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VOTING_CONFIG.timeout);

        const response = await fetch(`${VOTING_CONFIG.apiUrl}/${encodeURIComponent(voteKey)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.success ? data.votes : null;
        }
    } catch (error) {
        console.log('Server vote fetch failed:', error.message);
    }
    return null;
}

async function submitServerVote(voteKey, voteType, userId, previousVote = null) {
    if (!VOTING_CONFIG.enabled) {
        return false;
    }

    try {
        // Get Turnstile token if enabled
        let turnstileToken = null;
        if (typeof getTurnstileTokenWithUI === 'function') {
            turnstileToken = await getTurnstileTokenWithUI('Verify Vote', 'Please verify to submit your vote:');
            if (TURNSTILE_CONFIG.enabled && !turnstileToken) {
                console.log('Vote cancelled: Turnstile verification required');
                return false;
            }
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VOTING_CONFIG.timeout);

        const requestBody = {
            key: voteKey,
            voteType: voteType,
            userId: userId
        };
        
        // Include previous vote if this is a vote change
        if (previousVote) {
            requestBody.previousVote = previousVote;
        }
        
        if (turnstileToken) {
            requestBody.turnstileToken = turnstileToken;
        }

        const response = await fetch(VOTING_CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.success;
        } else if (response.status === 403) {
            console.log('Vote rejected: Turnstile verification failed');
            // Reset turnstile for retry
            if (typeof resetTurnstileWidget === 'function') {
                resetTurnstileWidget();
            }
        }
    } catch (error) {
        console.log('Server vote submission failed:', error.message);
    }
    return false;
}

// Get combined votes (server + local fallback)
async function getCombinedVotes(voteKey) {
    // Try to get server votes first
    const serverVotes = await getServerVotes(voteKey);
    
    if (serverVotes) {
        // Store server votes in localStorage for caching
        localStorage.setItem(`server_${voteKey}`, JSON.stringify(serverVotes));
        return serverVotes;
    }

    // Fallback to cached server votes or local votes
    const cachedServerVotes = localStorage.getItem(`server_${voteKey}`);
    if (cachedServerVotes) {
        return JSON.parse(cachedServerVotes);
    }

    // Final fallback to local votes only
    return getVotes(voteKey);
}

// Generate a unique user ID for vote tracking
function getUserId() {
    let userId = localStorage.getItem('voting_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('voting_user_id', userId);
    }
    return userId;
}

// Show voting time restriction popup
function showVotingTimePopup() {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Check if we're viewing today's menu for current meal
    if (currentDate !== today || currentCategory !== currentMealCategory) {
        alert('Voting is only available for today\'s current meal.');
        return;
    }
    
    // Show time restriction info
    const timeInfo = getVotingTimeInfo(currentCategory);
    if (timeInfo) {
        const message = `Voting for ${timeInfo.category} is only available from ${timeInfo.startTime} to ${timeInfo.endTime}.\n\nPlease try again during the voting window.`;
        alert(message);
    } else {
        alert('Voting is not available for this meal category.');
    }
}

// Cast a vote for a menu item (now allows vote changes)
async function castVote(dishName, menuType, voteType) {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Check if we're voting for today's current meal
    if (currentDate !== today || currentCategory !== currentMealCategory) {
        showVotingTimePopup();
        return false;
    }
    
    // Check if voting time is active
    if (!isVotingTimeActive(currentCategory)) {
        showVotingTimePopup();
        return false;
    }

    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    const userVoteKey = `user_${voteKey}`;
    const userId = getUserId();
    
    // Check if user has already voted - if so, we're changing the vote
    const existingVote = localStorage.getItem(userVoteKey);
    const isVoteChange = existingVote !== null;

    // Try to submit vote to server first
    const serverSuccess = await submitServerVote(voteKey, voteType, userId, isVoteChange ? existingVote : null);
    
    if (serverSuccess) {
        // Server vote successful - save user vote locally
        localStorage.setItem(userVoteKey, voteType);
        // Clear cached server votes to force refresh
        localStorage.removeItem(`server_${voteKey}`);
        return true;
    } else {
        // Server vote failed - fall back to local voting
        console.log('Server voting failed, using local storage fallback');
        
        // Get current local votes
        const votes = getVotes(voteKey);
        
        // If changing vote, decrement old vote first
        if (isVoteChange && votes[existingVote] > 0) {
            votes[existingVote]--;
        }
        
        // Increment the new vote type
        votes[voteType]++;
        
        // Save updated votes and user's vote locally
        localStorage.setItem(voteKey, JSON.stringify(votes));
        localStorage.setItem(userVoteKey, voteType);
        
        return true;
    }
}

// Check if user has voted for a specific item
function hasUserVoted(dishName, menuType) {
    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    const userVoteKey = `user_${voteKey}`;
    return localStorage.getItem(userVoteKey) !== null;
}

// Get user's vote for a specific item
function getUserVote(dishName, menuType) {
    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    const userVoteKey = `user_${voteKey}`;
    return localStorage.getItem(userVoteKey);
}

// Generate voting HTML for menu items
function generateVotingHtml(dishName, menuType) {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Only show voting UI if viewing today's menu for current meal
    if (currentDate !== today || currentCategory !== currentMealCategory) {
        return ''; // No voting UI if not current day/meal
    }

    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    // Use local votes initially, will be updated by loadVotesForItem
    const votes = getVotes(voteKey);
    const userVote = getUserVote(dishName, menuType);
    const hasVoted = hasUserVoted(dishName, menuType);
    const votingTimeActive = isVotingTimeActive(currentCategory);

    const voteButtons = Object.values(VOTE_TYPES).map(voteType => {
        const emoji = VOTE_EMOJIS[voteType];
        const count = votes[voteType];
        const isUserVote = userVote === voteType;
        
        // Button styling: highlight user's current vote, but allow changes if in voting time
        let buttonClass = 'vote-button swiftui-button';
        if (isUserVote) {
            buttonClass += ' vote-button-selected';
        } else if (!votingTimeActive) {
            buttonClass += ' vote-button-disabled';
        }
        
        // Disable buttons only if voting time is not active
        const isDisabled = !votingTimeActive;
        
        return `
            <button class="${buttonClass} px-3 py-2 rounded-lg flex items-center gap-2" 
                    onclick="handleVote('${dishName.replace(/'/g, "\\'")}', '${menuType}', '${voteType}')"
                    ${isDisabled ? 'disabled' : ''}>
                <span class="text-lg">${emoji}</span>
                <span class="text-sm font-medium vote-count" data-vote-type="${voteType}">${count}</span>
            </button>
        `;
    }).join('');

    // Generate image button HTML to be included in the same row
    const imageButtonHtml = generateImageButtonHtml(dishName, menuType);

    return `
        <div class="border-t border-ios-gray border-opacity-20 pt-3 mt-3" data-vote-key="${voteKey}">
            <div class="flex justify-center">
                <div class="flex gap-2">
                    ${voteButtons}
                    ${imageButtonHtml}
                </div>
            </div>
        </div>
    `;
}

// Load server votes for a specific item and update the display
async function loadVotesForItem(voteKey) {
    const combinedVotes = await getCombinedVotes(voteKey);
    
    // Find the voting container for this item
    const votingContainer = document.querySelector(`[data-vote-key="${voteKey}"]`);
    if (votingContainer) {
        // Update vote counts in the UI
        Object.entries(combinedVotes).forEach(([voteType, count]) => {
            const countElement = votingContainer.querySelector(`[data-vote-type="${voteType}"]`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }
}

// Load all visible vote counts from server
async function refreshVoteCounts() {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Only refresh if viewing today's menu for current meal
    if (currentDate !== today || currentCategory !== currentMealCategory) {
        return;
    }
    
    const votingContainers = document.querySelectorAll('[data-vote-key]');
    const loadPromises = Array.from(votingContainers).map(container => {
        const voteKey = container.getAttribute('data-vote-key');
        return loadVotesForItem(voteKey);
    });
    
    // Load all votes in parallel
    await Promise.all(loadPromises);
}

// Handle vote button click
async function handleVote(dishName, menuType, voteType) {
    const success = await castVote(dishName, menuType, voteType);
    if (success) {
        // Refresh vote counts to show updated votes from server
        await refreshVoteCounts();
        
        // Also refresh the menu display to update vote button states
        if (menuData) {
            displayMenu(menuData);
            // Refresh vote counts again after re-rendering
            setTimeout(() => refreshVoteCounts(), 100);
        }
    }
    // Note: castVote now handles showing popups for failed attempts, so no need for console.log here
}