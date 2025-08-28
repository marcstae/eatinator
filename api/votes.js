const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

/**
 * Simple voting API for Eatinator - Node.js version
 * Stores votes in JSON files - works with static hosting
 */

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'votes_data');
const MAX_VOTES_PER_USER = 10;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Utility functions
function sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getVoteFile(voteKey) {
    return path.join(DATA_DIR, `${sanitizeKey(voteKey)}.json`);
}

function getUserFile(userId) {
    return path.join(DATA_DIR, `user_${sanitizeKey(userId)}.json`);
}

function loadVotes(voteKey) {
    const file = getVoteFile(voteKey);
    if (!fs.existsSync(file)) {
        return { good: 0, neutral: 0, bad: 0 };
    }
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return data || { good: 0, neutral: 0, bad: 0 };
    } catch {
        return { good: 0, neutral: 0, bad: 0 };
    }
}

function saveVotes(voteKey, votes) {
    const file = getVoteFile(voteKey);
    try {
        fs.writeFileSync(file, JSON.stringify(votes, null, 2));
        return true;
    } catch {
        return false;
    }
}

function loadUserVotes(userId) {
    const file = getUserFile(userId);
    if (!fs.existsSync(file)) {
        return {};
    }
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return data || {};
    } catch {
        return {};
    }
}

function saveUserVotes(userId, userVotes) {
    const file = getUserFile(userId);
    try {
        fs.writeFileSync(file, JSON.stringify(userVotes, null, 2));
        return true;
    } catch {
        return false;
    }
}

// Request handler
function handleRequest(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        if (req.method === 'GET') {
            const parsedUrl = url.parse(req.url, true);
            const voteKey = parsedUrl.query.key;
            
            if (!voteKey) {
                throw new Error('Vote key is required');
            }
            
            const votes = loadVotes(voteKey);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, votes }));
            
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const input = JSON.parse(body);
                    
                    if (!input || input.action !== 'vote') {
                        throw new Error('Invalid request');
                    }
                    
                    const { key: voteKey, voteType, userId } = input;
                    
                    if (!voteKey || !voteType || !userId) {
                        throw new Error('Missing required parameters');
                    }
                    
                    if (!['good', 'neutral', 'bad'].includes(voteType)) {
                        throw new Error('Invalid vote type');
                    }
                    
                    // Check if user has already voted for this item
                    const userVotes = loadUserVotes(userId);
                    if (userVotes[voteKey]) {
                        throw new Error('User has already voted for this item');
                    }
                    
                    // Check vote limit per user
                    if (Object.keys(userVotes).length >= MAX_VOTES_PER_USER) {
                        throw new Error('Vote limit exceeded');
                    }
                    
                    // Load current votes
                    const votes = loadVotes(voteKey);
                    
                    // Increment the vote
                    votes[voteType]++;
                    
                    // Save updated votes
                    if (!saveVotes(voteKey, votes)) {
                        throw new Error('Failed to save votes');
                    }
                    
                    // Save user vote record
                    userVotes[voteKey] = voteType;
                    if (!saveUserVotes(userId, userVotes)) {
                        throw new Error('Failed to save user vote record');
                    }
                    
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, votes }));
                    
                } catch (error) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
            });
            
        } else {
            throw new Error('Method not allowed');
        }
        
    } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// Start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`Voting API server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});