"""
FastAPI backend for Eatinator
Replaces PHP implementation with Python FastAPI + SQLite
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
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
import requests
import json
import asyncio

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
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
RETENTION_HOURS = 24
MAX_VOTES_PER_USER = 10

# Cloudflare Turnstile Configuration
TURNSTILE_SECRET_KEY = os.getenv('TURNSTILE_SECRET_KEY', '')
TURNSTILE_ENABLED = bool(TURNSTILE_SECRET_KEY)
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

# AI Configuration - Only mlvoca with deepseek as requested
AI_CONFIG = {
    'url': 'https://mlvoca.com/api/generate',
    'model': 'deepseek-r1:1.5b',
    'max_tokens': 300,
    'temperature': 0.7,
    'timeout': 60  # Increased to 60 seconds for AI processing
}

# Create directories
DATA_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)

# Pydantic models
class VoteRequest(BaseModel):
    action: str
    key: str
    voteType: str
    userId: str
    turnstileToken: Optional[str] = None

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

class AiRequest(BaseModel):
    message: str
    context: dict
    turnstileToken: Optional[str] = None

class AiResponse(BaseModel):
    success: bool
    response: Optional[str] = None
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

async def verify_turnstile_token(token: str, remote_ip: str = None) -> bool:
    """Verify Cloudflare Turnstile token"""
    if not TURNSTILE_ENABLED:
        return True  # Skip verification if Turnstile is disabled
    
    if not token:
        return False
    
    try:
        data = {
            'secret': TURNSTILE_SECRET_KEY,
            'response': token
        }
        if remote_ip:
            data['remoteip'] = remote_ip
        
        response = requests.post(
            TURNSTILE_VERIFY_URL,
            data=data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get('success', False)
        else:
            logger.warning(f"Turnstile verification failed with status: {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Error verifying Turnstile token: {e}")
        return False

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

def get_system_prompt(context: dict) -> str:
    """Generate system prompt with menu context"""
    language = context.get('language', 'en')
    items = context.get('items', [])
    category = context.get('category', 'lunch')
    restaurant = context.get('restaurant', 'Restaurant')
    date = context.get('date', '')
    
    has_items = len(items) > 0
    
    if language == 'de':
        menu_context = f"Heutige Gerichte ({category}): {', '.join(item['name'] for item in items)}" if has_items else f"Keine Menüdaten verfügbar für {category} am {date}"
        return f"""Du bist ein persönlicher Menü-Berater für "{restaurant}".

{menu_context}

🎯 FOKUS: Gib persönliche EMPFEHLUNGEN und ALLERGIE-BERATUNG. Nutzer kennen bereits das Menü.

Hauptaufgaben:
1. 🍽️ EMPFEHLUNGEN: "Was soll ich heute essen?" - Vorschläge basierend auf Geschmack, Gesundheit, Stimmung
2. 🚫 ALLERGIE-SICHERHEIT: Gluten, Laktose, Nüsse, etc. - bei Unsicherheit: "Frag das Personal vor Ort"
3. 🥗 ERNÄHRUNGSBERATUNG: Vegetarisch, vegan, kalorienarm, proteinreich
4. 👨‍🍳 GESCHMACKS-TIPPS: "Wie schmeckt das?" - beschreibe Aromen, Texturen, Zubereitungsart

Antworte kurz (1-3 Sätze), freundlich und praktisch. Keine Menülisten - nur Beratung!"""
    elif language == 'fr':
        menu_context = f"Plats du jour ({category}): {', '.join(item['name'] for item in items)}" if has_items else f"Aucune donnée de menu disponible pour {category} le {date}"
        return f"""Vous êtes un conseiller personnel de menu pour "{restaurant}".

{menu_context}

🎯 FOCUS: Donnez des RECOMMANDATIONS personnelles et des CONSEILS ALLERGIES. Les utilisateurs connaissent déjà le menu.

Tâches principales:
1. 🍽️ RECOMMANDATIONS: "Que dois-je manger aujourd'hui?" - suggestions basées sur le goût, la santé, l'humeur
2. 🚫 SÉCURITÉ ALLERGIES: Gluten, lactose, noix, etc. - en cas d'incertitude: "Demandez au personnel sur place"
3. 🥗 CONSEILS ALIMENTAIRES: Végétarien, végétalien, faible en calories, riche en protéines
4. 👨‍🍳 CONSEILS GUSTATIFS: "Quel goût cela a-t-il?" - décrivez les arômes, textures, méthodes de cuisson

Répondez brièvement (1-3 phrases), amicalement et pratiquement. Pas de listes de menu - juste des conseils!"""
    else:
        menu_context = f"Today's dishes ({category}): {', '.join(item['name'] for item in items)}" if has_items else f"No menu data available for {category} on {date}"
        return f"""You are a personal menu advisor for "{restaurant}".

{menu_context}

🎯 FOCUS: Give personal RECOMMENDATIONS and ALLERGY GUIDANCE. Users already know the menu.

Main tasks:
1. 🍽️ RECOMMENDATIONS: "What should I eat today?" - suggestions based on taste, health, mood
2. 🚫 ALLERGY SAFETY: Gluten, lactose, nuts, etc. - when uncertain: "Ask the staff on-site"
3. 🥗 DIETARY ADVICE: Vegetarian, vegan, low-calorie, high-protein options
4. 👨‍🍳 TASTE GUIDANCE: "How does it taste?" - describe flavors, textures, cooking methods

Respond briefly (1-3 sentences), friendly and practical. No menu lists - just advice!"""

async def call_ai_api(message: str, context: dict) -> str:
    """Call the mlvoca AI API with the message and context"""
    try:
        system_prompt = get_system_prompt(context)
        
        payload = {
            'model': AI_CONFIG['model'],
            'prompt': f"{system_prompt}\n\nUser: {message}\nAssistant:",
            'stream': False,
            'options': {
                'temperature': AI_CONFIG['temperature'],
                'num_predict': AI_CONFIG['max_tokens']
            }
        }
        
        response = requests.post(
            AI_CONFIG['url'],
            headers={'Content-Type': 'application/json'},
            json=payload,
            timeout=AI_CONFIG['timeout']
        )
        
        if response.ok:
            data = response.json()
            ai_response = data.get('response', '')
            if ai_response:
                return ai_response.strip()
            else:
                raise Exception("AI API returned empty response")
        else:
            raise Exception(f"AI API responded with status {response.status_code}: {response.text}")
        
    except requests.exceptions.Timeout:
        logger.error("AI API timeout")
        raise Exception("AI request timed out - the service may be overloaded. Please try again.")
    except requests.exceptions.ConnectionError:
        logger.error("AI API connection error")
        raise Exception("Could not connect to AI service. Please check your internet connection.")
    except Exception as e:
        logger.error(f"AI API error: {e}")
        raise

async def stream_ai_api(message: str, context: dict):
    """Stream AI API response"""
    try:
        system_prompt = get_system_prompt(context)
        
        payload = {
            'model': AI_CONFIG['model'],
            'prompt': f"{system_prompt}\n\nUser: {message}\nAssistant:",
            'stream': True,  # Enable streaming
            'options': {
                'temperature': AI_CONFIG['temperature'],
                'num_predict': AI_CONFIG['max_tokens']
            }
        }
        
        # Use streaming request
        with requests.post(
            AI_CONFIG['url'],
            headers={'Content-Type': 'application/json'},
            json=payload,
            timeout=AI_CONFIG['timeout'],
            stream=True
        ) as response:
            if not response.ok:
                raise Exception(f"AI API responded with status {response.status_code}: {response.text}")
            
            # Stream the response
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    try:
                        # Parse streaming JSON response
                        data = json.loads(line)
                        if 'response' in data:
                            chunk = data['response']
                            if chunk:
                                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                        elif data.get('done'):
                            # End of stream
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            break
                    except json.JSONDecodeError:
                        # Skip malformed JSON lines
                        continue
                        
    except requests.exceptions.Timeout:
        logger.error("AI API timeout")
        yield f"data: {json.dumps({'error': 'AI request timed out - the service may be overloaded. Please try again.'})}\n\n"
    except requests.exceptions.ConnectionError:
        logger.error("AI API connection error")
        yield f"data: {json.dumps({'error': 'Could not connect to AI service. Please check your internet connection.'})}\n\n"
    except Exception as e:
        logger.error(f"AI API streaming error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

def get_fallback_response(message: str, context: dict) -> str:
    """Generate fallback response when AI API is unavailable"""
    language = context.get('language', 'en')
    
    if language == 'de':
        return 'Entschuldigung, der KI-Assistent ist momentan nicht verfügbar. Gerne helfe ich bei Menü-Empfehlungen, Allergie-Fragen oder Ernährungsberatung! Was interessiert Sie am meisten?'
    elif language == 'fr':
        return 'Désolé, l\'assistant IA n\'est pas disponible pour le moment. Je serais heureux de vous aider avec des recommandations de menu, des questions d\'allergie ou des conseils diététiques! Qu\'est-ce qui vous intéresse le plus?'
    else:
        return 'Sorry, the AI assistant is currently unavailable. I\'m happy to help with menu recommendations, allergy questions, or dietary advice! What interests you most?'

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    cleanup_old_images()

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "eatinator-api"}

# REST-compliant voting endpoints
@app.get("/api/votes/{vote_key}")
async def get_votes_rest(vote_key: str):
    """Get votes for a specific key (REST endpoint)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT good, neutral, bad FROM votes WHERE vote_key = ?",
            (vote_key,)
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

class RestVoteRequest(BaseModel):
    key: str
    voteType: str
    userId: str
    turnstileToken: Optional[str] = None

@app.post("/api/votes")
async def cast_vote_rest(vote_request: RestVoteRequest, request: Request):
    """Cast a vote (REST endpoint)"""
    try:
        if not all([vote_request.key, vote_request.voteType, vote_request.userId]):
            raise HTTPException(400, "Missing required parameters")
        
        # Verify Turnstile token if enabled
        if TURNSTILE_ENABLED:
            client_ip = request.client.host if request.client else None
            if not await verify_turnstile_token(vote_request.turnstileToken, client_ip):
                raise HTTPException(403, "Turnstile verification failed")
        
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

# Legacy PHP-style voting endpoints (for backward compatibility)
@app.get("/api/votes.php")
async def get_votes(key: str = Query(..., description="Vote key")):
    """Get votes for a specific key (legacy endpoint)"""
    return await get_votes_rest(key)

@app.post("/api/votes.php")
async def cast_vote(vote_request: VoteRequest, request: Request):
    """Cast a vote (legacy endpoint)"""
    try:
        if vote_request.action != "vote":
            raise HTTPException(400, "Invalid action")
        
        # Convert to REST format and delegate
        rest_request = RestVoteRequest(
            key=vote_request.key,
            voteType=vote_request.voteType,
            userId=vote_request.userId,
            turnstileToken=vote_request.turnstileToken
        )
        return await cast_vote_rest(rest_request, request)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error casting vote: {e}")
        raise HTTPException(400, f"Failed to save vote: {str(e)}")

# REST-compliant image endpoints
@app.get("/api/images/{image_key}")
async def get_images_rest(image_key: str):
    """Get images for a dish (REST endpoint)"""
    try:
        # Clean up old images on every request
        cleanup_old_images()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT filename, original_name, upload_time, file_path
            FROM images 
            WHERE dish_key = ? AND file_path IS NOT NULL
            ORDER BY upload_time DESC
        ''', (image_key,))
        
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
                    "url": f"/api/images/{image_key}/{row['filename']}"
                })
        
        return {"success": True, "images": images}
    
    except Exception as e:
        logger.error(f"Error getting images: {e}")
        raise HTTPException(400, f"Failed to get images: {str(e)}")

@app.get("/api/images/{image_key}/{filename}")
async def get_image_file_rest(image_key: str, filename: str):
    """Serve a specific image file (REST endpoint)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT file_path FROM images WHERE dish_key = ? AND filename = ?",
            (image_key, filename)
        )
        result = cursor.fetchone()
        conn.close()
        
        if not result or not Path(result["file_path"]).exists():
            raise HTTPException(404, "Image not found")
        
        return FileResponse(
            result["file_path"],
            media_type=mimetypes.guess_type(filename)[0] or "image/jpeg"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving image: {e}")
        raise HTTPException(400, f"Failed to serve image: {str(e)}")

class RestImageUpload(BaseModel):
    key: str

@app.post("/api/images")
async def upload_image_rest(
    request: Request,
    key: str = Form(..., description="Image key"),
    image: UploadFile = File(..., description="Image file"),
    turnstileToken: Optional[str] = Form(None, description="Turnstile token")
):
    """Upload an image for a dish (REST endpoint)"""
    try:
        # Verify Turnstile token if enabled
        if TURNSTILE_ENABLED:
            client_ip = request.client.host if request.client else None
            if not await verify_turnstile_token(turnstileToken, client_ip):
                raise HTTPException(403, "Turnstile verification failed")
        
        # Validate file size
        if not image.size:
            raise HTTPException(400, "No file provided")
        
        if image.size > MAX_FILE_SIZE:
            raise HTTPException(400, "File too large. Maximum size is 15MB")
        
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

# Legacy PHP-style image endpoints (for backward compatibility)
@app.get("/api/images.php")
async def get_images(
    key: Optional[str] = Query(None, description="Image key"),
    action: Optional[str] = Query(None, description="Action"),
    file: Optional[str] = Query(None, description="File name")
):
    """Get images for a dish or serve a specific image file (legacy endpoint)"""
    try:
        # If action is 'view', serve the image file
        if action == "view":
            if not key or not file:
                raise HTTPException(400, "Key and filename are required")
            return await get_image_file_rest(key, file)
        
        # Get images for a specific dish
        if not key:
            raise HTTPException(400, "Dish key is required")
        
        return await get_images_rest(key)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in legacy images endpoint: {e}")
        raise HTTPException(400, f"Failed to process request: {str(e)}")

@app.post("/api/images.php")
async def upload_image(
    request: Request,
    key: str = Form(..., description="Image key"),
    image: UploadFile = File(..., description="Image file"),
    turnstileToken: Optional[str] = Form(None, description="Turnstile token")
):
    """Upload an image for a dish (legacy endpoint)"""
    return await upload_image_rest(request, key, image, turnstileToken)

# AI API endpoints
@app.post("/api/ai")
async def ai_chat(ai_request: AiRequest, request: Request):
    """Process AI chat request with streaming support"""
    try:
        # Verify Turnstile token if enabled
        if TURNSTILE_ENABLED:
            client_ip = request.client.host if request.client else None
            if not await verify_turnstile_token(ai_request.turnstileToken, client_ip):
                raise HTTPException(403, "Turnstile verification failed")
        
        if not ai_request.message.strip():
            raise HTTPException(400, "Message cannot be empty")
        
        # Check if client accepts streaming
        accept = request.headers.get("accept", "")
        if "text/event-stream" in accept:
            # Return streaming response
            return StreamingResponse(
                stream_ai_api(ai_request.message, ai_request.context),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"  # Disable nginx buffering
                }
            )
        else:
            # Return traditional response for backward compatibility
            try:
                response_text = await call_ai_api(ai_request.message, ai_request.context)
                return {"success": True, "response": response_text}
            except Exception as e:
                # Return actual error message instead of fallback
                error_msg = str(e)
                logger.error(f"AI chat error: {error_msg}")
                return {"success": False, "error": error_msg}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected AI chat error: {e}")
        return {"success": False, "error": f"Unexpected error: {str(e)}"}

@app.get("/api/ai/health")
async def ai_health():
    """Check AI API health"""
    try:
        # Test the AI API with a simple request
        test_context = {
            'language': 'en',
            'items': [],
            'category': 'test',
            'restaurant': 'Test Restaurant',
            'date': 'today'
        }
        
        response = requests.post(
            AI_CONFIG['url'],
            headers={'Content-Type': 'application/json'},
            json={
                'model': AI_CONFIG['model'],
                'prompt': 'Test prompt',
                'stream': False,
                'options': {
                    'temperature': 0.1,
                    'num_predict': 10
                }
            },
            timeout=5
        )
        
        if response.ok:
            return {"status": "healthy", "ai_service": "available"}
        else:
            return {"status": "degraded", "ai_service": "unavailable", "fallback": "active"}
    
    except Exception as e:
        logger.warning(f"AI health check failed: {e}")
        return {"status": "degraded", "ai_service": "unavailable", "fallback": "active"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5694)