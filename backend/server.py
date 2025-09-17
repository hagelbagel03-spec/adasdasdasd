from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection - Use environment variable or fallback
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/stadtwache_db")
DB_NAME = os.getenv("DB_NAME", "stadtwache_db")

# Handle both local and cloud MongoDB URLs
if MONGO_URL.startswith("mongodb://localhost") or MONGO_URL.startswith("mongodb://127.0.0.1"):
    # Local development
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"🔗 Connected to local MongoDB: {MONGO_URL}")
else:
    # Production/Cloud MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]  
    print(f"🔗 Connected to cloud MongoDB: {MONGO_URL[:20]}...")

# Test connection
async def test_db_connection():
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Tage

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Online users tracking - Simplified without SocketIO
online_users = {}  # {user_id: {"last_seen": datetime, "username": str}}

# Create FastAPI app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# User roles
class UserRole:
    ADMIN = "admin"          # Eigentümer
    POLICE = "police"        # Stadtwache
    COMMUNITY = "community"  # Member
    TRAINEE = "trainee"      # Praktikant

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    role: str
    badge_number: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    status: str = "Im Dienst"  # Im Dienst, Pause, Einsatz, Streife, Nicht verfügbar
    photo: Optional[str] = None  # base64 encoded profile photo
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: Optional[str] = UserRole.POLICE  # Default role
    badge_number: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    photo: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    photo: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Incident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    priority: str  # high, medium, low
    status: str = "open"  # open, in_progress, closed
    location: Dict[str, float]  # lat, lng
    address: str
    reported_by: str  # user_id
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    images: List[str] = []  # base64 encoded images
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class IncidentCreate(BaseModel):
    title: str
    description: str
    priority: str
    location: Dict[str, float]
    address: str
    images: List[str] = []

class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    author_id: str
    author_name: str
    shift_date: str
    images: List[str] = []  # base64 encoded images from incidents
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "draft"  # draft, submitted, reviewed
    last_edited_by: Optional[str] = None  # ID of last editor
    last_edited_by_name: Optional[str] = None  # Name of last editor
    edit_history: List[Dict[str, Any]] = []  # Track edit history

class ReportCreate(BaseModel):
    title: str
    content: str
    shift_date: str

# Security functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_identifier: str = payload.get("sub")  # Could be email or user_id
        user_id: str = payload.get("user_id")  # Token also contains user_id
        
        if user_identifier is None:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception
    
    # Try to find user by different methods
    user = None
    
    # First, try to find by ID (if the identifier looks like a UUID)
    if user_identifier and '-' in user_identifier and len(user_identifier) == 36:
        user = await db.users.find_one({"id": user_identifier})
    
    # If not found by ID, try by email
    if user is None:
        user = await db.users.find_one({"email": user_identifier})
    
    # If still not found and we have a separate user_id, try that
    if user is None and user_id:
        user = await db.users.find_one({"id": user_id})
    
    if user is None:
        raise credentials_exception
    
    return User(**user)

# API Routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user object with all required fields
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "username": user_data.username,
        "role": user_data.role,
        "badge_number": user_data.badge_number,
        "department": user_data.department,
        "phone": user_data.phone,
        "service_number": user_data.service_number,
        "rank": user_data.rank,
        "status": "Im Dienst",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "hashed_password": hashed_password  # Store hashed password
    }
    
    # Insert user into database
    await db.users.insert_one(user_dict)
    
    # Return user without password
    user_dict.pop('hashed_password')
    return User(**user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Check both possible password field names
    stored_password = user.get("hashed_password") or user.get("password_hash")
    if not stored_password:
        raise HTTPException(status_code=400, detail="User password not found")
    
    if not verify_password(user_data.password, stored_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "user_id": user["id"], "role": user.get("role", "user")},
        expires_delta=access_token_expires
    )
    
    # Create user object for response
    user_obj = User(**user)
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(user_updates: UserUpdate, current_user: User = Depends(get_current_user)):
    # Prepare update data
    update_data = {k: v for k, v in user_updates.dict().items() if v is not None}
    update_data['updated_at'] = datetime.utcnow()
    
    # Update user in database
    result = await db.users.update_one(
        {"id": current_user.id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get updated user
    updated_user = await db.users.find_one({"id": current_user.id})
    return User(**updated_user)

@api_router.post("/emergency/broadcast")
async def broadcast_emergency_alert(
    alert_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Broadcast emergency alert to all active users with GPS location"""
    try:
        # Extract location data
        location_data = alert_data.get("location", None)
        location_status = alert_data.get("location_status", "Unbekannt")
        
        # Create comprehensive emergency broadcast record
        broadcast_dict = {
            "id": str(uuid.uuid4()),
            "type": alert_data.get("type", "sos_alarm"),
            "message": alert_data.get("message", "Notfall-Alarm"),
            "sender_id": current_user.id,
            "sender_name": current_user.username,
            "sender_badge": getattr(current_user, 'badge_number', 'N/A'),
            "location": location_data,
            "location_status": location_status,
            "has_gps": location_data is not None,
            "timestamp": datetime.utcnow(),
            "priority": alert_data.get("priority", "urgent"),
            "recipients": "all_users",
            "status": "sent"
        }
        
        # Store in database
        result = await db.emergency_broadcasts.insert_one(broadcast_dict)
        
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create emergency broadcast")
        
        # Log detailed info
        location_info = ""
        if location_data:
            try:
                # Safely format GPS coordinates with validation
                lat = location_data.get('latitude')
                lng = location_data.get('longitude')
                accuracy = location_data.get('accuracy', 0)
                
                if lat is not None and lng is not None and isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                    location_info = f" at GPS: {float(lat):.6f}, {float(lng):.6f} (±{float(accuracy):.0f}m)"
                else:
                    location_info = f" - GPS: Invalid coordinates provided"
            except (ValueError, TypeError) as e:
                location_info = f" - GPS: Error formatting coordinates ({str(e)})"
        else:
            location_info = f" - GPS: {location_status}"
            
        print(f"🚨 EMERGENCY BROADCAST: {broadcast_dict['id']} by {current_user.username}{location_info}")
        
        return {
            "success": True,
            "broadcast_id": broadcast_dict["id"],
            "message": "Emergency alert broadcasted to all team members",
            "location_transmitted": location_data is not None,
            "location_status": location_status,
            "timestamp": broadcast_dict["timestamp"].isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error creating emergency broadcast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.post("/reports", response_model=Report)
async def create_report(report_data: ReportCreate, current_user: User = Depends(get_current_user)):
    report_dict = report_data.dict()
    report_dict['author_id'] = current_user.id
    report_dict['author_name'] = current_user.username
    report_dict['status'] = 'draft'
    report_dict['created_at'] = datetime.utcnow()
    report_dict['updated_at'] = datetime.utcnow()
    
    report_obj = Report(**report_dict)
    result = await db.reports.insert_one(report_obj.dict())
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to create report")
    
    return report_obj

@api_router.put("/reports/{report_id}", response_model=Report)
async def update_report(
    report_id: str, 
    report_data: ReportCreate, 
    current_user: User = Depends(get_current_user)
):
    """Update an existing report including status changes"""
    try:
        # Find the existing report
        existing_report = await db.reports.find_one({"id": report_id})
        
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Check if user has permission to update this report
        if existing_report.get("author_id") != current_user.id and current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Prepare update data
        update_data = report_data.dict()
        update_data['updated_at'] = datetime.utcnow()
        
        # Update the report
        result = await db.reports.update_one(
            {"id": report_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Get the updated report
        updated_report = await db.reports.find_one({"id": report_id})
        if '_id' in updated_report:
            del updated_report['_id']
        
        print(f"Report updated: {report_id} by {current_user.username}")
        return Report(**updated_report)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.get("/reports", response_model=List[Report])
async def get_reports(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        # Admin can see all reports
        reports = await db.reports.find().sort("created_at", -1).to_list(100)
    else:
        # Users can only see their own reports
        reports = await db.reports.find({"author_id": current_user.id}).sort("created_at", -1).to_list(100)
    
    return [Report(**report) for report in reports]

@api_router.get("/users/by-status")
async def get_users_by_status(current_user: User = Depends(get_current_user)):
    """Get users grouped by their work status with online information"""
    users = await db.users.find().to_list(100)
    now = datetime.utcnow()
    offline_threshold = timedelta(minutes=2)
    
    users_by_status = {}
    for user_doc in users:
        user_status = user_doc.get("status", "Im Dienst")
        
        # Check if user is online (last activity within 2 minutes)
        last_activity = user_doc.get("last_activity")
        is_online = False
        if last_activity and isinstance(last_activity, datetime):
            is_online = now - last_activity < offline_threshold
        
        if user_status not in users_by_status:
            users_by_status[user_status] = []
            
        user_data = {
            "id": user_doc.get("id"),
            "username": user_doc.get("username"),
            "phone": user_doc.get("phone"),
            "service_number": user_doc.get("service_number"),
            "rank": user_doc.get("rank"),
            "department": user_doc.get("department"),
            "status": user_status,
            "is_online": is_online,
            "online_status": "Online" if is_online else "Offline",
            "last_activity": last_activity.isoformat() if last_activity else None
        }
        users_by_status[user_status].append(user_data)
    
    return users_by_status

# Root route
@api_router.get("/")
async def root():
    return {"message": "Stadtwache API", "version": "1.0.0", "status": "running"}

# Include router
app.include_router(api_router)

# Root route für direkte Backend-Zugriffe
@app.get("/")
async def root():
    return {"message": "Stadtwache Backend API", "version": "1.0.0", "status": "running", "api_docs": "/docs"}

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Server starten
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)