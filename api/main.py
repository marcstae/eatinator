"""
FastAPI backend for Eatinator
Replaces PHP implementation with Python FastAPI + SQLite
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os
import time
import uuid
import hashlib
from pathlib import Path
from typing import Optional, List
import shutil
import mimetypes
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Eatinator API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DATA_DIR = Path(__file__).parent / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "eatinator.db"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
RETENTION_HOURS = 24
MAX_VOTES_PER_USER = 10

# Create directories
DATA_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)

# Pydantic models
class VoteRequest(BaseModel):
    action: str
    key: str
    voteType: str
    userId: str

class VoteResponse(BaseModel):
    success: bool
    votes: Optional[dict] = None
    error: Optional[str] = None

class ImageResponse(BaseModel):
    success: bool
    images: Optional[List[dict]] = None
    message: Optional[str] = None
    filename: Optional[str] = None
    error: Optional[str] = None

# Database initialization
def init_db():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Votes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS votes (
            vote_key TEXT PRIMARY KEY,
            good INTEGER DEFAULT 0,
            neutral INTEGER DEFAULT 0,
            bad INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # User votes tracking table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_votes (
            user_id TEXT,
            vote_key TEXT,
            vote_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, vote_key)
        )
    ''')
    
    # Image metadata table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dish_key TEXT,
            filename TEXT,
            original_name TEXT,
            file_path TEXT,
            upload_time INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Utility functions
def sanitize_key(key: str) -> str:
    """Sanitize keys to prevent path traversal"""
    return "".join(c if c.isalnum() or c in "_-" else "_" for c in key)

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def cleanup_old_images():
    """Remove images older than retention period"""
    try:
        cutoff_time = time.time() - (RETENTION_HOURS * 3600)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Find old images
        cursor.execute(
            "SELECT file_path FROM images WHERE upload_time < ?",
            (cutoff_time,)
        )
        old_images = cursor.fetchall()
        
        # Delete files and database records
        for image in old_images:
            file_path = Path(image["file_path"])
            if file_path.exists():
                file_path.unlink()
        
        cursor.execute(
            "DELETE FROM images WHERE upload_time < ?",
            (cutoff_time,)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Cleaned up {len(old_images)} old images")
    except Exception as e:
        logger.error(f"Error cleaning up old images: {e}")

def validate_image_file(file: UploadFile) -> str:
    """Validate uploaded image and return safe extension"""
    # Check MIME type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Invalid file type. Only JPEG, PNG, and WebP are allowed")
    
    # Save to temporary file for validation
    temp_path = IMAGES_DIR / f"temp_{uuid.uuid4().hex}"
    try:
        with temp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Validate with PIL
        with Image.open(temp_path) as img:
            format_map = {
                "JPEG": "jpg",
                "PNG": "png",
                "WEBP": "webp"
            }
            safe_extension = format_map.get(img.format)
            if not safe_extension or safe_extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(400, "Unsupported image format")
        
        # Reset file pointer for later use
        file.file.seek(0)
        return safe_extension
    
    finally:
        if temp_path.exists():
            temp_path.unlink()

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    cleanup_old_images()

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "eatinator-api"}

# Voting endpoints
@app.get("/api/votes.php")
async def get_votes(key: str = Query(..., description="Vote key")):
    """Get votes for a specific key"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT good, neutral, bad FROM votes WHERE vote_key = ?",
            (key,)
        )
        result = cursor.fetchone()
        conn.close()
        
        if result:
            votes = {"good": result["good"], "neutral": result["neutral"], "bad": result["bad"]}
        else:
            votes = {"good": 0, "neutral": 0, "bad": 0}
        
        return {"success": True, "votes": votes}
    
    except Exception as e:
        logger.error(f"Error getting votes: {e}")
        raise HTTPException(400, f"Failed to get votes: {str(e)}")

@app.post("/api/votes.php")
async def cast_vote(vote_request: VoteRequest):
    """Cast a vote"""
    try:
        if vote_request.action != "vote":
            raise HTTPException(400, "Invalid action")
        
        if not all([vote_request.key, vote_request.voteType, vote_request.userId]):
            raise HTTPException(400, "Missing required parameters")
        
        if vote_request.voteType not in ["good", "neutral", "bad"]:
            raise HTTPException(400, "Invalid vote type")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user already voted for this item
        cursor.execute(
            "SELECT 1 FROM user_votes WHERE user_id = ? AND vote_key = ?",
            (vote_request.userId, vote_request.key)
        )
        if cursor.fetchone():
            conn.close()
            raise HTTPException(400, "User has already voted for this item")
        
        # Check vote limit per user
        cursor.execute(
            "SELECT COUNT(*) as count FROM user_votes WHERE user_id = ?",
            (vote_request.userId,)
        )
        user_vote_count = cursor.fetchone()["count"]
        if user_vote_count >= MAX_VOTES_PER_USER:
            conn.close()
            raise HTTPException(400, "Vote limit exceeded")
        
        # Insert or update vote counts
        cursor.execute(
            "INSERT OR IGNORE INTO votes (vote_key) VALUES (?)",
            (vote_request.key,)
        )
        
        cursor.execute(f'''
            UPDATE votes 
            SET {vote_request.voteType} = {vote_request.voteType} + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE vote_key = ?
        ''', (vote_request.key,))
        
        # Record user vote
        cursor.execute(
            "INSERT INTO user_votes (user_id, vote_key, vote_type) VALUES (?, ?, ?)",
            (vote_request.userId, vote_request.key, vote_request.voteType)
        )
        
        # Get updated votes
        cursor.execute(
            "SELECT good, neutral, bad FROM votes WHERE vote_key = ?",
            (vote_request.key,)
        )
        result = cursor.fetchone()
        votes = {"good": result["good"], "neutral": result["neutral"], "bad": result["bad"]}
        
        conn.commit()
        conn.close()
        
        return {"success": True, "votes": votes}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error casting vote: {e}")
        raise HTTPException(400, f"Failed to save vote: {str(e)}")

# Image endpoints
@app.get("/api/images.php")
async def get_images(
    key: Optional[str] = Query(None, description="Image key"),
    action: Optional[str] = Query(None, description="Action"),
    file: Optional[str] = Query(None, description="File name")
):
    """Get images for a dish or serve a specific image file"""
    try:
        # Clean up old images on every request
        cleanup_old_images()
        
        # If action is 'view', serve the image file
        if action == "view":
            if not key or not file:
                raise HTTPException(400, "Key and filename are required")
            
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT file_path FROM images WHERE dish_key = ? AND filename = ?",
                (key, file)
            )
            result = cursor.fetchone()
            conn.close()
            
            if not result or not Path(result["file_path"]).exists():
                raise HTTPException(404, "Image not found")
            
            return FileResponse(
                result["file_path"],
                media_type=mimetypes.guess_type(file)[0] or "image/jpeg"
            )
        
        # Get images for a specific dish
        if not key:
            raise HTTPException(400, "Dish key is required")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT filename, original_name, upload_time, file_path
            FROM images 
            WHERE dish_key = ? AND file_path IS NOT NULL
            ORDER BY upload_time DESC
        ''', (key,))
        
        results = cursor.fetchall()
        conn.close()
        
        images = []
        for row in results:
            # Verify file still exists
            if Path(row["file_path"]).exists():
                images.append({
                    "filename": row["filename"],
                    "originalName": row["original_name"],
                    "uploadTime": row["upload_time"],
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(row["upload_time"])),
                    "url": f"/api/images.php?action=view&key={key}&file={row['filename']}"
                })
        
        return {"success": True, "images": images}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting images: {e}")
        raise HTTPException(400, f"Failed to get images: {str(e)}")

@app.post("/api/images.php")
async def upload_image(
    key: str = Form(..., description="Image key"),
    image: UploadFile = File(..., description="Image file")
):
    """Upload an image for a dish"""
    try:
        # Validate file size
        if not image.size:
            raise HTTPException(400, "No file provided")
        
        if image.size > MAX_FILE_SIZE:
            raise HTTPException(400, "File too large. Maximum size is 5MB")
        
        # Validate image
        safe_extension = validate_image_file(image)
        
        # Generate unique filename
        upload_time = int(time.time())
        unique_id = hashlib.md5(f"{key}_{upload_time}_{uuid.uuid4().hex}".encode()).hexdigest()[:8]
        filename = f"{upload_time}_{unique_id}.{safe_extension}"
        
        # Create dish-specific directory
        dish_dir = IMAGES_DIR / sanitize_key(key)
        dish_dir.mkdir(exist_ok=True)
        
        file_path = dish_dir / filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        # Save metadata to database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO images (dish_key, filename, original_name, file_path, upload_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (key, filename, image.filename, str(file_path), upload_time))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Image uploaded: {filename} for dish {key}")
        
        return {
            "success": True,
            "message": "Image uploaded successfully",
            "filename": filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(400, f"Failed to save image: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)