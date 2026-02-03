"""
AI Sports Booking Backend API - FIXED VERSION
A lightweight FastAPI server for the Amman sports booking demo
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import random
from datetime import datetime, timedelta
import os
import openai
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="AI Sports Booking API",
    description="Backend API for AI-powered sports venue booking in Amman, Jordan",
    version="1.0.0"
)

# Global Project State (Admin Controls)
SYSTEM_TIME_OVERRIDE = None # Setting this will override the auto-detected time

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class Venue(BaseModel):
    name: str
    location: str
    type: str
    priceJOD: float
    isIndoor: bool
    aiLabel: Optional[str] = None

class TimeSlot(BaseModel):
    time: str
    available: bool
    priceJOD: float

class AvailabilityResponse(BaseModel):
    venue: str
    date: str
    slots: List[TimeSlot]

class ChatRequest(BaseModel):
    message: str
    timeOfDay: Optional[str] = "Afternoon"
    location: Optional[str] = None
    sessionId: Optional[str] = "default"

class ChatResponse(BaseModel):
    botMessage: str
    venues: List[Venue]
    filterApplied: str
    booking_context: Optional[dict] = None
    suggestedDate: Optional[str] = None
    bookingConfirmed: bool = False
    slots: Optional[List[TimeSlot]] = None

class BookingRequest(BaseModel):
    venue: str
    date: str
    time: str
    userName: str
    phone: str

class BookingResponse(BaseModel):
    success: bool
    bookingId: str
    message: str

# Load venues data with fallback
VENUES_DATA = None
try:
    # Get absolute path to the data directory relative to this file
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    VENUES_PATH = os.path.join(BASE_DIR, "..", "data", "venues.json")
    
    if os.path.exists(VENUES_PATH):
        with open(VENUES_PATH, "r", encoding="utf-8") as f:
            VENUES_DATA = json.load(f)
    else:
        # Fallback to current directory for safety during migration
        if os.path.exists("venues.json"):
            with open("venues.json", "r", encoding="utf-8") as f:
                VENUES_DATA = json.load(f)
        else:
            # Fallback demo data if file doesn't exist
            VENUES_DATA = {
                "venues": [
                    {
                        "name": "Trax Padel",
                        "location": "Abdoun",
                        "type": "Padel",
                        "priceJOD": 25.0,
                        "isIndoor": True
                    },
                    {
                        "name": "Fitness First Sports",
                        "location": "Sweifieh",
                        "type": "Soccer",
                        "priceJOD": 30.0,
                        "isIndoor": False
                    },
                    {
                        "name": "Jordan Sports City",
                        "location": "Shmeisani",
                        "type": "Soccer",
                        "priceJOD": 15.0,
                        "isIndoor": False
                    },
                    {
                        "name": "Elite Padel Club",
                        "location": "Abdoun",
                        "type": "Padel",
                        "priceJOD": 35.0,
                        "isIndoor": True
                    }
                ]
            }
            print("⚠️  venues.json not found. Using fallback demo data.")
except Exception as e:
    print(f"❌ Error loading venues: {e}")
    VENUES_DATA = {"venues": []}

# ============================================
# HELPER FUNCTIONS (Logic Matrix) - FIXED
# ============================================

def apply_time_rule(venues: List[dict], time_of_day: str) -> List[dict]:
    """Sort venues based on time suitability"""
    if not venues:
        return []
    
    # Priority logic:
    # Noon/Afternoon -> Indoor (Cooler)
    # Morning -> Outdoor (Fresh air)
    # Evening/Night -> Best rated/Top (Any)
    
    if time_of_day in ["Noon", "Afternoon"]:
        return sorted(venues, key=lambda v: (0 if v.get("isIndoor", False) else 1, v.get("priceJOD", 999)))
    elif time_of_day == "Morning":
        return sorted(venues, key=lambda v: (0 if not v.get("isIndoor", False) else 1, v.get("priceJOD", 999)))
    
    return venues

def apply_price_rule(venues: List[dict], query_text: str) -> List[dict]:
    """Filter by price if budget keywords detected"""
    if not venues:
        return []
    
    q = query_text.lower()
    if "cheap" in q or "budget" in q or "affordable" in q:
        return [v for v in venues if v.get("priceJOD", 999) < 20]
    return venues

def apply_sport_filter(venues: List[dict], query_text: str) -> List[dict]:
    """Detect sport type from query"""
    if not venues:
        return []
    
    q = query_text.lower()
    if "padel" in q:
        return [v for v in venues if v.get("type", "").lower() == "padel"]
    elif "soccer" in q or "football" in q:
        return [v for v in venues if v.get("type", "").lower() == "soccer"]
    return venues

def apply_location_filter(venues: List[dict], location: Optional[str]) -> List[dict]:
    """Filter by location if specified - now supports partial matching"""
    if not venues or not location:
        return venues
    
    location_lower = location.lower().strip()
    return [v for v in venues if location_lower in v.get("location", "").lower()]

def label_ai_pick(venues: List[dict]) -> List[dict]:
    """Mark the top recommendation - properly copies dictionaries"""
    if not venues:
        return []
    
    labeled = []
    for index, venue in enumerate(venues):
        # Create a proper copy of the dictionary
        v = dict(venue)
        v["aiLabel"] = "AI Recommended" if index == 0 else None
        labeled.append(v)
    
    return labeled

def generate_bot_message(venues: List[dict], query_text: str, filter_applied: str, time_of_day: str = "Afternoon") -> str:
    """Generate contextual bot responses"""
    if not venues:
        return "I couldn't find any venues matching your criteria. Try adjusting your preferences!"
    
    venue = venues[0]
    q = query_text.lower()
    venue_name = venue.get("name", "this venue")
    venue_location = venue.get("location", "")
    venue_price = venue.get("priceJOD", 0)
    is_indoor = venue.get("isIndoor", False)
    
    # Map time of day to appropriate phrase
    time_phrases = {
        "Morning": "this morning",
        "Noon": "at noon",
        "Afternoon": "this afternoon",
        "Evening": "this evening",
        "Night": "tonight"
    }
    time_phrase = time_phrases.get(time_of_day, "today")
    
    # Weather-based responses
    if ("soccer" in q or "football" in q) and not is_indoor:
        return f"Great choice! The weather is perfect for outdoor soccer {time_phrase}. I recommend {venue_name} in {venue_location}."
    
    # Price-based responses
    if "cheap" in q or "budget" in q or "affordable" in q:
        return f"I found the best budget option for you! {venue_name} is only {venue_price} JOD. Great value!"
    
    # Indoor preference
    if is_indoor:
        return f"Perfect! {venue_name} has air-conditioned indoor courts. You'll stay cool while playing!"
    
    # Default response
    return f"I found {len(venues)} great option{'s' if len(venues) > 1 else ''} for you! {venue_name} in {venue_location} is my top pick at {venue_price} JOD."

def build_filter_description(venues_before: List[dict], venues_after: List[dict], query: str, location: Optional[str]) -> str:
    """Build a clear description of what filters were applied"""
    filters = []
    q = query.lower()
    
    # Sport filter
    if "padel" in q:
        filters.append("sport: Padel")
    elif "soccer" in q or "football" in q:
        filters.append("sport: Soccer")
    
    # Price filter
    if "cheap" in q or "budget" in q or "affordable" in q:
        filters.append("price: budget")
    
    # Location filter
    if location:
        filters.append(f"location: {location}")
    
    return " + ".join(filters) if filters else "general"

# ============================================
# API ENDPOINTS
# ============================================

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "AI Sports Booking API",
        "version": "1.0.0",
        "city": "Amman, Jordan",
        "venues_loaded": len(VENUES_DATA.get("venues", []))
    }

@app.get("/venues", response_model=List[Venue])
def get_all_venues():
    """Get all available venues"""
    if not VENUES_DATA or "venues" not in VENUES_DATA:
        raise HTTPException(status_code=500, detail="Venue data not available")
    return VENUES_DATA["venues"]

@app.get("/availability/{venue_name}", response_model=AvailabilityResponse)
def get_availability(venue_name: str, date: Optional[str] = None):
    """
    Get random available time slots for a venue (demo simulation)
    Returns realistic-looking availability without complex DB logic
    """
    if not VENUES_DATA or "venues" not in VENUES_DATA:
        raise HTTPException(status_code=500, detail="Venue data not available")
    
    # Find venue (case-insensitive)
    venue = next(
        (v for v in VENUES_DATA["venues"] if v["name"].lower() == venue_name.lower()), 
        None
    )
    
    if not venue:
        raise HTTPException(status_code=404, detail=f"Venue '{venue_name}' not found")
    
    # Use today's date if not provided
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    # Seed random for consistent results per venue+date combo
    random.seed(f"{venue_name}{date}")
    
    # Generate time slots (8 AM to 10 PM)
    time_slots = []
    start_hour = 8
    end_hour = 22
    
    for hour in range(start_hour, end_hour):
        time_str = f"{hour:02d}:00"
        # 70% availability rate
        available = random.random() > 0.2

        
        time_slots.append({
            "time": time_str,
            "available": available,
            "priceJOD": venue["priceJOD"]
        })
    
    # Reset random seed
    random.seed()
    
    return {
        "venue": venue["name"],
        "date": date,
        "slots": time_slots
    }

# ============================================
# OPENAI AGENT INTEGRATION
# ============================================

# Initialize OpenAI client (requires OPENAI_API_KEY env var)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def get_venues_tool(query: str = None, location: str = None, type: str = None, max_price: float = None, date: str = None):
    """
    Search for sports venues in Amman.
    """
    venues = [dict(v) for v in VENUES_DATA["venues"]]
    
    if type:
        venues = [v for v in venues if type.lower() in v.get("type", "").lower()]
    if location:
        venues = [v for v in venues if location.lower() in v.get("location", "").lower()]
    if max_price:
        venues = [v for v in venues if v.get("priceJOD", 0) <= max_price]
    
    # If a general query is provided, apply existing logic filters
    if query:
        venues = apply_sport_filter(venues, query)
        venues = apply_price_rule(venues, query)
        
    return venues

def get_availability_tool(venue_name: str, date: str = None):
    """
    Check available time slots for a specific venue.
    """
    try:
        return get_availability(venue_name, date)
    except HTTPException as e:
        return {"error": e.detail}

def create_booking_tool(venue: str, date: str, time: str, user_name: str, phone: str):
    """
    Create a sports booking reservation.
    """
    booking_req = BookingRequest(
        venue=venue,
        date=date,
        time=time,
        userName=user_name,
        phone=phone
    )
    return create_booking(booking_req)

# Define tools for OpenAI function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_venues",
            "description": "List sports venues in Amman with optional filters for location, sport type, and price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "Area in Amman (e.g. Abdoun, Sweifieh)"},
                    "type": {"type": "string", "description": "Sport type (e.g. Padel, Soccer)"},
                    "max_price": {"type": "number", "description": "Maximum price in JOD"},
                    "query": {"type": "string", "description": "General search query"},
                    "date": {"type": "string", "description": "The date the user is interested in (YYYY-MM-DD)"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_availability",
            "description": "Check available time slots for a specific venue on a given date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "venue_name": {"type": "string", "description": "The exact name of the venue"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"}
                },
                "required": ["venue_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": "Book a sports venue at a specific time. Requires venue name, date, time, customer name, and phone.",
            "parameters": {
                "type": "object",
                "properties": {
                    "venue": {"type": "string", "description": "Name of the venue"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "time": {"type": "string", "description": "Time in HH:00 format"},
                    "user_name": {"type": "string", "description": "Customer name"},
                    "phone": {"type": "string", "description": "Customer phone number"}
                },
                "required": ["venue", "date", "time", "user_name", "phone"]
            }
        }
    }
]

# Global Chat History (in-memory for demo)
# Structure: { sessionId: [messages] }
CHAT_HISTORY = {}
MAX_HISTORY = 20

@app.post("/chat", response_model=ChatResponse)
def chat_with_ai(request: ChatRequest):
    """
    AI chat endpoint using OpenAI Agent with function calling and memory.
    """
    if not os.environ.get("OPENAI_API_KEY"):
        # Fallback to static logic if no API key
        return static_chat_fallback(request)

    session_id = request.sessionId or "default"
    
    # Initialize or retrieve history
    if session_id not in CHAT_HISTORY:
        CHAT_HISTORY[session_id] = [
            {"role": "system", "content": f"You are an AI Sports Booking Assistant for Amman, Jordan. Today is {datetime.now().strftime('%A, %Y-%m-%d')}. "
                                         f"You help users find sports venues, check availability, and book slots. "
                                         f"If a user mentions 'tomorrow', 'next Friday', etc., calculate the exact date relative to {datetime.now().strftime('%Y-%m-%d')}. "
                                         f"Always pass the 'date' parameter to tools whenever a date is mentioned or implied. "
                                         f"CRITICAL: To actually finalize a booking, you MUST call the 'create_booking' tool. Never tell the user a booking is confirmed unless that tool has returned success. "
                                         f"Current system time context: {SYSTEM_TIME_OVERRIDE if SYSTEM_TIME_OVERRIDE else request.timeOfDay}. "
                                         "Be friendly and concise."}
        ]
    
    # Add user message to history
    CHAT_HISTORY[session_id].append({"role": "user", "content": request.message})

    # Keep only the last MAX_HISTORY messages (plus always keep the system message at index 0)
    if len(CHAT_HISTORY[session_id]) > MAX_HISTORY + 1:
        # Keep the system message, but slice the rest
        CHAT_HISTORY[session_id] = [CHAT_HISTORY[session_id][0]] + CHAT_HISTORY[session_id][-(MAX_HISTORY):]

    # Keep track of venues found during tool calls to return in the response
    discovered_venues = []
    suggested_date = None
    booking_confirmed = False
    booking_context = None
    slots_data = None

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=CHAT_HISTORY[session_id],
            tools=TOOLS,
            tool_choice="auto"
        )

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        if tool_calls:
            CHAT_HISTORY[session_id].append(response_message)
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                print(f"AI calling tool: {function_name} with args: {function_args}")
                
                # Extract date if present in tool calls
                if "date" in function_args:
                    suggested_date = function_args["date"]
                
                if function_name == "get_venues":
                    function_response = get_venues_tool(**function_args)
                    discovered_venues = function_response
                elif function_name == "get_availability":
                    function_response = get_availability_tool(**function_args)
                    if "error" not in function_response:
                        slots_data = function_response.get("slots")
                        # Extract price to pass to the frontend UI
                        venue_name = function_args.get("venue_name")
                        venue_data = next((v for v in VENUES_DATA["venues"] if v["name"].lower() == venue_name.lower()), None)
                        booking_context = {
                            "venue": venue_name,
                            "date": function_response.get("date"),
                            "price": venue_data["priceJOD"] if venue_data else 25
                        }
                elif function_name == "create_booking":
                    function_response = create_booking_tool(**function_args)
                    if function_response.get("success"):
                        booking_confirmed = True
                
                CHAT_HISTORY[session_id].append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(function_response),
                })
            
            # Get a second response from the model to handle the tool outputs
            second_response = client.chat.completions.create(
                model="gpt-4o",
                messages=CHAT_HISTORY[session_id],
            )
            final_message = second_response.choices[0].message
            bot_text = final_message.content
            CHAT_HISTORY[session_id].append(final_message)
        else:
            bot_text = response_message.content
            CHAT_HISTORY[session_id].append(response_message)

        return {
            "botMessage": bot_text,
            "venues": [Venue(**v) for v in discovered_venues] if discovered_venues else [],
            "filterApplied": "OpenAI Agent (with Memory)",
            "suggestedDate": suggested_date,
            "bookingConfirmed": booking_confirmed,
            "booking_context": booking_context,
            "slots": [TimeSlot(**s) for s in slots_data] if slots_data else None
        }

    except Exception as e:
        print(f"Agent Error: {e}")
        return static_chat_fallback(request)

def static_chat_fallback(request: ChatRequest):
    """Original static logic as fallback"""
    if not VENUES_DATA or "venues" not in VENUES_DATA:
        raise HTTPException(status_code=500, detail="Venue data not available")
    
    venues = [dict(v) for v in VENUES_DATA["venues"]]
    effective_time = SYSTEM_TIME_OVERRIDE if SYSTEM_TIME_OVERRIDE else request.timeOfDay
    
    venues = apply_sport_filter(venues, request.message)
    venues = apply_price_rule(venues, request.message)
    venues = apply_location_filter(venues, request.location)
    venues = apply_time_rule(venues, effective_time)
    venues = label_ai_pick(venues)
    
    bot_message = generate_bot_message(venues, request.message, request.message, effective_time)
    
    return {
        "botMessage": bot_message,
        "venues": venues,
        "filterApplied": request.message
    }

@app.post("/booking", response_model=BookingResponse)
def create_booking(booking: BookingRequest):
    """
    Simulate booking action - logs to console and returns success
    In production, this would save to database
    """
    # Validate venue exists
    if VENUES_DATA and "venues" in VENUES_DATA:
        venue_exists = any(
            v["name"].lower() == booking.venue.lower() 
            for v in VENUES_DATA["venues"]
        )
        if not venue_exists:
            raise HTTPException(status_code=404, detail="Venue not found")
    
    # Generate random booking ID
    booking_id = f"BK{random.randint(10000, 99999)}"
    
    # Console log for demo
    print("\n" + "="*50)
    print("🎾 NEW BOOKING RECEIVED")
    print("="*50)
    print(f"Booking ID: {booking_id}")
    print(f"Venue: {booking.venue}")
    print(f"Date: {booking.date}")
    print(f"Time: {booking.time}")
    print(f"Customer: {booking.userName}")
    print(f"Phone: {booking.phone}")
    print("="*50 + "\n")
    
    return {
        "success": True,
        "bookingId": booking_id,
        "message": f"Booking confirmed! Your booking ID is {booking_id}. We'll send you a confirmation via WhatsApp."
    }

@app.post("/whatsapp/connect")
def whatsapp_connect():
    """
    Simulate WhatsApp integration
    Returns 200 OK status when clicked
    """
    print("\n✅ WhatsApp Connect clicked - Returning 200 OK")
    return {
        "status": "success",
        "message": "WhatsApp integration simulated successfully",
        "connected": True
    }

@app.get("/admin/metrics")
def get_admin_metrics():
    """Get admin dashboard metrics"""
    return {
        "monthly_revenue_jod": 4500,
        "total_bookings_this_month": 186,
        "average_booking_value_jod": 24.2,
        "active_inquiries": 12,
        "conversion_rate_percent": 38,
        "top_venue_this_month": "Trax Padel",
        "peak_booking_time": "8:00 PM – 10:00 PM",
        "returning_users_percent": 42,
        "system_time_override": SYSTEM_TIME_OVERRIDE
    }

@app.post("/admin/settings")
def update_admin_settings(settings: dict):
    """Update system-wide settings from dashboard"""
    global SYSTEM_TIME_OVERRIDE
    
    if "system_time_override" in settings:
        val = settings["system_time_override"]
        SYSTEM_TIME_OVERRIDE = val if val != "Auto" else None
        print(f"⚙️ Admin: System time set to {SYSTEM_TIME_OVERRIDE}")
        
    return {"status": "success", "settings": settings}

# ============================================
# STATIC FRONTEND SERVING
# ============================================

# Get the path to the frontend directory relative to this file
FRONTEND_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

# Mount the static files LAST so they don't override API routes
if os.path.exists(FRONTEND_PATH):
    app.mount("/", StaticFiles(directory=FRONTEND_PATH, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    # Use the PORT environment variable if available (Render provides this)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)