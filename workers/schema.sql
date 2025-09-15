-- Eatinator D1 Database Schema
-- SQLite-compatible schema for Cloudflare D1

-- Votes table - stores aggregated vote counts
CREATE TABLE IF NOT EXISTS votes (
    vote_key TEXT PRIMARY KEY,
    good INTEGER NOT NULL DEFAULT 0,
    neutral INTEGER NOT NULL DEFAULT 0,
    bad INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User votes tracking table - prevents duplicate votes
CREATE TABLE IF NOT EXISTS user_votes (
    user_id TEXT NOT NULL,
    vote_key TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('good', 'neutral', 'bad')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, vote_key)
);

-- Image metadata table - stores image information
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    r2_key TEXT NOT NULL, -- R2 object key
    file_size INTEGER,
    content_type TEXT,
    upload_time INTEGER NOT NULL, -- Unix timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_votes_user_id ON user_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_vote_key ON user_votes(vote_key);
CREATE INDEX IF NOT EXISTS idx_images_dish_key ON images(dish_key);
CREATE INDEX IF NOT EXISTS idx_images_upload_time ON images(upload_time);
CREATE INDEX IF NOT EXISTS idx_votes_updated_at ON votes(updated_at);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_votes_timestamp 
    AFTER UPDATE ON votes
    FOR EACH ROW
    BEGIN
        UPDATE votes SET updated_at = CURRENT_TIMESTAMP WHERE vote_key = NEW.vote_key;
    END;