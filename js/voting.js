// Voting system functionality

// Check if voting is currently active (only for current day and current meal time)
function isVotingActive() {
    const today = new Date().toISOString().split('T')[0];
    const currentMealCategory = getDefaultMealCategory();
    
    // Voting is only active when viewing today's menu for the current meal period
    return currentDate === today && currentCategory === currentMealCategory;
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

async function submitServerVote(voteKey, voteType, userId) {
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

// Cast a vote for a menu item
async function castVote(dishName, menuType, voteType) {
    if (!isVotingActive()) {
        return false; // Voting not active
    }

    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    const userVoteKey = `user_${voteKey}`;
    const userId = getUserId();
    
    // Check if user has already voted
    const existingVote = localStorage.getItem(userVoteKey);
    if (existingVote) {
        return false; // User has already voted
    }

    // Try to submit vote to server first
    const serverSuccess = await submitServerVote(voteKey, voteType, userId);
    
    if (serverSuccess) {
        // Server vote successful - save user vote locally to prevent re-voting
        localStorage.setItem(userVoteKey, voteType);
        // Clear cached server votes to force refresh
        localStorage.removeItem(`server_${voteKey}`);
        return true;
    } else {
        // Server vote failed - fall back to local voting
        console.log('Server voting failed, using local storage fallback');
        
        // Get current local votes
        const votes = getVotes(voteKey);
        
        // Increment the selected vote type
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
    if (!isVotingActive()) {
        return ''; // No voting UI if voting is not active
    }

    const voteKey = getVoteKey(dishName, menuType, currentDate, currentCategory);
    // Use local votes initially, will be updated by loadVotesForItem
    const votes = getVotes(voteKey);
    const userVote = getUserVote(dishName, menuType);
    const hasVoted = hasUserVoted(dishName, menuType);

    const voteButtons = Object.values(VOTE_TYPES).map(voteType => {
        const emoji = VOTE_EMOJIS[voteType];
        const count = votes[voteType];
        const isUserVote = userVote === voteType;
        const buttonClass = hasVoted 
            ? (isUserVote ? 'vote-button-selected' : 'vote-button-disabled') 
            : 'vote-button';
        
        return `
            <button class="${buttonClass} swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                    onclick="handleVote('${dishName.replace(/'/g, "\\'")}', '${menuType}', '${voteType}')"
                    ${hasVoted ? 'disabled' : ''}>
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
    if (!isVotingActive()) return;
    
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
    } else {
        // Show feedback if voting failed
        console.log('Voting failed - either not active or already voted');
    }
}