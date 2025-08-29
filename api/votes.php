<?php
/**
 * Simple voting API for Eatinator
 * Stores votes in JSON files - works with static hosting
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$dataDir = __DIR__ . '/votes_data';
$maxVotesPerUser = 10; // Prevent spam

// Ensure data directory exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Utility functions
function sanitizeKey($key) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
}

function getVoteFile($voteKey) {
    global $dataDir;
    return $dataDir . '/' . sanitizeKey($voteKey) . '.json';
}

function getUserFile($userId) {
    global $dataDir;
    return $dataDir . '/user_' . sanitizeKey($userId) . '.json';
}

function loadVotes($voteKey) {
    $file = getVoteFile($voteKey);
    if (!file_exists($file)) {
        return ['good' => 0, 'neutral' => 0, 'bad' => 0];
    }
    $data = json_decode(file_get_contents($file), true);
    return $data ?: ['good' => 0, 'neutral' => 0, 'bad' => 0];
}

function saveVotes($voteKey, $votes) {
    $file = getVoteFile($voteKey);
    return file_put_contents($file, json_encode($votes, JSON_PRETTY_PRINT)) !== false;
}

function loadUserVotes($userId) {
    $file = getUserFile($userId);
    if (!file_exists($file)) {
        return [];
    }
    $data = json_decode(file_get_contents($file), true);
    return $data ?: [];
}

function saveUserVotes($userId, $userVotes) {
    $file = getUserFile($userId);
    return file_put_contents($file, json_encode($userVotes, JSON_PRETTY_PRINT)) !== false;
}

// Main request handling
try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get votes for a specific key
        $voteKey = $_GET['key'] ?? '';
        if (empty($voteKey)) {
            throw new Exception('Vote key is required');
        }
        
        $votes = loadVotes($voteKey);
        echo json_encode(['success' => true, 'votes' => $votes]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Cast a vote
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || $input['action'] !== 'vote') {
            throw new Exception('Invalid request');
        }
        
        $voteKey = $input['key'] ?? '';
        $voteType = $input['voteType'] ?? '';
        $userId = $input['userId'] ?? '';
        $existingVote = $input['existingVote'] ?? null;
        
        if (empty($voteKey) || empty($voteType) || empty($userId)) {
            throw new Exception('Missing required parameters');
        }
        
        if (!in_array($voteType, ['good', 'neutral', 'bad'])) {
            throw new Exception('Invalid vote type');
        }
        
        // Load user votes and current votes
        $userVotes = loadUserVotes($userId);
        $votes = loadVotes($voteKey);
        
        // Check if user has already voted for this item
        $hasExistingVote = isset($userVotes[$voteKey]);
        
        if ($hasExistingVote) {
            // User is changing their vote
            $currentVote = $userVotes[$voteKey];
            
            // Decrement the old vote count
            if (isset($votes[$currentVote]) && $votes[$currentVote] > 0) {
                $votes[$currentVote]--;
            }
        } else {
            // New vote - check vote limit per user
            if (count($userVotes) >= $maxVotesPerUser) {
                throw new Exception('Vote limit exceeded');
            }
        }
        
        // Increment the new vote
        $votes[$voteType]++;
        
        // Save updated votes
        if (!saveVotes($voteKey, $votes)) {
            throw new Exception('Failed to save votes');
        }
        
        // Save user vote record
        $userVotes[$voteKey] = $voteType;
        if (!saveUserVotes($userId, $userVotes)) {
            throw new Exception('Failed to save user vote record');
        }
        
        echo json_encode(['success' => true, 'votes' => $votes]);
        
    } else {
        throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>