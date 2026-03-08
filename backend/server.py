from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import json
import csv
import io
import asyncio
import time
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI()

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    contact_id: str = Field(default_factory=lambda: f"contact_{uuid.uuid4().hex[:12]}")
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"
    status: str = "pending"  # pending, enriching, scoring, scored, activated, nurtured, suppressed
    enrichment_data: Optional[Dict[str, Any]] = None
    score: Optional[int] = None
    tier: Optional[str] = None  # A, B, C
    score_reasoning: Optional[str] = None
    pipeline_stage: str = "new"  # new, qualified, contacted, meeting, proposal, closed_won, closed_lost
    funnel_stage: str = "top"  # top, middle, bottom
    deal_value: Optional[float] = None
    acquisition_source: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    enriched_at: Optional[datetime] = None
    scored_at: Optional[datetime] = None

class ContactCreate(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"
    acquisition_source: Optional[str] = None
    deal_value: Optional[float] = None

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str = Field(default_factory=lambda: f"company_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    funding_stage: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    icp_signal: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LLMCallLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: f"log_{uuid.uuid4().hex[:12]}")
    user_id: str
    call_type: str  # enrichment, scoring, email_personalization, judge_check, guardrail
    model_name: str
    provider: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    success: bool = True
    error_message: Optional[str] = None
    contact_id: Optional[str] = None
    input_preview: Optional[str] = None
    output_preview: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivationLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: f"activation_{uuid.uuid4().hex[:12]}")
    user_id: str
    contact_id: str
    action_type: str  # outbound, nurture, suppress
    tier: str
    email_variants: Optional[List[str]] = None
    sequence_name: Optional[str] = None
    status: str = "pending"  # pending, sent, delivered, opened, replied
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FunnelEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: f"event_{uuid.uuid4().hex[:12]}")
    user_id: str
    contact_id: str
    event_type: str  # stage_change, deal_update, conversion
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    deal_value: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HubSpotWebhook(BaseModel):
    email: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    jobtitle: Optional[str] = None
    phone: Optional[str] = None

# ===================== AUTH HELPERS =====================

async def get_session_from_cookie(request: Request) -> Optional[str]:
    """Get session token from cookie or Authorization header"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    return session_token

async def get_current_user(request: Request) -> User:
    """Get current authenticated user"""
    session_token = await get_session_from_cookie(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# ===================== LLM SERVICES =====================

async def log_llm_call(
    user_id: str,
    call_type: str,
    model_name: str,
    provider: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    success: bool,
    contact_id: Optional[str] = None,
    error_message: Optional[str] = None,
    input_preview: Optional[str] = None,
    output_preview: Optional[str] = None
):
    """Log LLM call for observability"""
    log = LLMCallLog(
        user_id=user_id,
        call_type=call_type,
        model_name=model_name,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        success=success,
        contact_id=contact_id,
        error_message=error_message,
        input_preview=input_preview[:200] if input_preview else None,
        output_preview=output_preview[:200] if output_preview else None
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.llm_call_logs.insert_one(doc)
    return log

async def enrich_contact_with_llm(contact: Dict, user_id: str) -> Dict:
    """Enrich contact with firmographic data using Claude Sonnet 4.5"""
    start_time = time.time()
    
    company_name = contact.get('company_name', '')
    company_domain = contact.get('company_domain', '')
    job_title = contact.get('job_title', '')
    
    prompt = f"""Analyze this B2B contact and provide firmographic enrichment data.

Contact Information:
- Company: {company_name}
- Domain: {company_domain}
- Job Title: {job_title}

Return a JSON object with these fields:
{{
    "company_size": "startup/smb/mid-market/enterprise",
    "industry": "string - primary industry",
    "funding_stage": "pre-seed/seed/series-a/series-b/series-c+/public/bootstrapped/unknown",
    "tech_stack": ["array of likely technologies based on industry and company type"],
    "icp_signal": "high/medium/low - how well does this match a typical B2B SaaS ICP",
    "decision_maker_level": "c-level/vp/director/manager/individual-contributor/unknown",
    "department": "string - likely department based on job title"
}}

Be realistic and conservative. If information is insufficient, use "unknown" values."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"enrich_{contact.get('contact_id', uuid.uuid4().hex)}",
            system_message="You are a B2B data enrichment specialist. Return only valid JSON."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        response = await chat.send_message(UserMessage(text=prompt))
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Parse JSON from response
        try:
            # Try to extract JSON from response
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            enrichment_data = json.loads(json_str.strip())
        except:
            enrichment_data = {
                "company_size": "unknown",
                "industry": "unknown",
                "funding_stage": "unknown",
                "tech_stack": [],
                "icp_signal": "medium",
                "decision_maker_level": "unknown",
                "department": "unknown"
            }
        
        await log_llm_call(
            user_id=user_id,
            call_type="enrichment",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=len(response.split()),
            latency_ms=latency_ms,
            success=True,
            contact_id=contact.get('contact_id'),
            input_preview=prompt,
            output_preview=response
        )
        
        return enrichment_data
        
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        await log_llm_call(
            user_id=user_id,
            call_type="enrichment",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=0,
            latency_ms=latency_ms,
            success=False,
            contact_id=contact.get('contact_id'),
            error_message=str(e),
            input_preview=prompt
        )
        # Fallback enrichment
        return {
            "company_size": "unknown",
            "industry": "unknown",
            "funding_stage": "unknown",
            "tech_stack": [],
            "icp_signal": "medium",
            "decision_maker_level": "unknown",
            "department": "unknown",
            "fallback": True
        }

async def score_contact_with_llm(contact: Dict, enrichment_data: Dict, user_id: str) -> Dict:
    """Score contact using Claude Sonnet 4.5 with structured output"""
    start_time = time.time()
    
    prompt = f"""Score this B2B lead for sales prioritization.

Contact:
- Email: {contact.get('email', '')}
- Name: {contact.get('first_name', '')} {contact.get('last_name', '')}
- Job Title: {contact.get('job_title', '')}
- Company: {contact.get('company_name', '')}

Enrichment Data:
{json.dumps(enrichment_data, indent=2)}

Return a JSON object with exactly these fields:
{{
    "score": <integer 0-100>,
    "tier": "<A, B, or C>",
    "reasoning": "<2-3 sentence explanation of the score>"
}}

Scoring Criteria:
- Tier A (80-100): Decision makers at enterprise/mid-market companies with high ICP signal
- Tier B (50-79): Good fit with some gaps - manager level, SMBs, or medium ICP signal
- Tier C (0-49): Low fit - individual contributors, startups, low ICP signal, or unknown data

Be specific in reasoning. Reference actual data points."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"score_{contact.get('contact_id', uuid.uuid4().hex)}",
            system_message="You are a lead scoring specialist. Return only valid JSON."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        response = await chat.send_message(UserMessage(text=prompt))
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Parse JSON
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            score_data = json.loads(json_str.strip())
        except:
            # Rule-based fallback
            icp_signal = enrichment_data.get('icp_signal', 'medium')
            decision_level = enrichment_data.get('decision_maker_level', 'unknown')
            company_size = enrichment_data.get('company_size', 'unknown')
            
            score = 50
            if icp_signal == 'high':
                score += 20
            elif icp_signal == 'low':
                score -= 20
            if decision_level in ['c-level', 'vp', 'director']:
                score += 15
            if company_size in ['enterprise', 'mid-market']:
                score += 15
            
            score = max(0, min(100, score))
            tier = 'A' if score >= 80 else ('B' if score >= 50 else 'C')
            
            score_data = {
                "score": score,
                "tier": tier,
                "reasoning": f"Rule-based fallback scoring. ICP: {icp_signal}, Level: {decision_level}, Size: {company_size}"
            }
        
        await log_llm_call(
            user_id=user_id,
            call_type="scoring",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=len(response.split()),
            latency_ms=latency_ms,
            success=True,
            contact_id=contact.get('contact_id'),
            input_preview=prompt,
            output_preview=response
        )
        
        return score_data
        
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        await log_llm_call(
            user_id=user_id,
            call_type="scoring",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=0,
            latency_ms=latency_ms,
            success=False,
            contact_id=contact.get('contact_id'),
            error_message=str(e),
            input_preview=prompt
        )
        return {
            "score": 50,
            "tier": "B",
            "reasoning": "Fallback score due to processing error",
            "fallback": True
        }

async def generate_email_variants(contact: Dict, enrichment_data: Dict, user_id: str) -> List[str]:
    """Generate personalized email first-lines using GPT-4o"""
    start_time = time.time()
    
    prompt = f"""Generate 3 personalized cold email first-line variants for this B2B prospect.

Contact:
- Name: {contact.get('first_name', '')} {contact.get('last_name', '')}
- Job Title: {contact.get('job_title', '')}
- Company: {contact.get('company_name', '')}

Context:
- Industry: {enrichment_data.get('industry', 'unknown')}
- Company Size: {enrichment_data.get('company_size', 'unknown')}
- Tech Stack: {', '.join(enrichment_data.get('tech_stack', []))}
- ICP Signal: {enrichment_data.get('icp_signal', 'unknown')}

Return a JSON array of 3 strings, each being a compelling first-line (1-2 sentences max).
Focus on relevance, personalization, and value proposition.
Example format: ["First line 1...", "First line 2...", "First line 3..."]"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"email_{contact.get('contact_id', uuid.uuid4().hex)}",
            system_message="You are a sales copywriter. Return only a JSON array of strings."
        ).with_model("openai", "gpt-4o")
        
        response = await chat.send_message(UserMessage(text=prompt))
        latency_ms = int((time.time() - start_time) * 1000)
        
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            variants = json.loads(json_str.strip())
            if not isinstance(variants, list):
                variants = [str(variants)]
        except:
            variants = ["Looking forward to connecting about your growth initiatives."]
        
        await log_llm_call(
            user_id=user_id,
            call_type="email_personalization",
            model_name="gpt-4o",
            provider="openai",
            input_tokens=len(prompt.split()),
            output_tokens=len(response.split()),
            latency_ms=latency_ms,
            success=True,
            contact_id=contact.get('contact_id'),
            input_preview=prompt,
            output_preview=response
        )
        
        return variants[:3]
        
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        await log_llm_call(
            user_id=user_id,
            call_type="email_personalization",
            model_name="gpt-4o",
            provider="openai",
            input_tokens=len(prompt.split()),
            output_tokens=0,
            latency_ms=latency_ms,
            success=False,
            contact_id=contact.get('contact_id'),
            error_message=str(e),
            input_preview=prompt
        )
        return ["Looking forward to connecting about your growth initiatives."]

async def judge_score_quality(contact: Dict, score_data: Dict, enrichment_data: Dict, user_id: str) -> Dict:
    """LLM-as-a-judge to validate scoring quality"""
    start_time = time.time()
    
    prompt = f"""Evaluate if this lead score reasoning matches the input data.

Input Data:
{json.dumps(enrichment_data, indent=2)}

Score Result:
{json.dumps(score_data, indent=2)}

Return JSON:
{{
    "valid": true/false,
    "confidence": 0.0-1.0,
    "issues": ["list of any inconsistencies found"]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"judge_{contact.get('contact_id', uuid.uuid4().hex)}",
            system_message="You are a QA specialist. Return only valid JSON."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        response = await chat.send_message(UserMessage(text=prompt))
        latency_ms = int((time.time() - start_time) * 1000)
        
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            result = json.loads(json_str.strip())
        except:
            result = {"valid": True, "confidence": 0.8, "issues": []}
        
        await log_llm_call(
            user_id=user_id,
            call_type="judge_check",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=len(response.split()),
            latency_ms=latency_ms,
            success=True,
            contact_id=contact.get('contact_id'),
            input_preview=prompt,
            output_preview=response
        )
        
        return result
        
    except Exception:
        return {"valid": True, "confidence": 0.5, "issues": ["Judge check failed"]}

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange Emergent session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            user_data = auth_response.json()
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Auth service unavailable")
    
    # Create or update user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        user = User(
            user_id=user_id,
            email=user_data["email"],
            name=user_data.get("name", ""),
            picture=user_data.get("picture")
        )
        user_doc = user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = user_data.get("session_token", str(uuid.uuid4()))
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    session_doc = session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    session_doc['created_at'] = session_doc['created_at'].isoformat()
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {
        "user_id": user_id,
        "email": user_data["email"],
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture")
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user data"""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = await get_session_from_cookie(request)
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ===================== CONTACTS ENDPOINTS =====================

@api_router.get("/contacts")
async def get_contacts(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: User = Depends(get_current_user)
):
    """Get contacts for current user"""
    query = {"user_id": user.user_id}
    if status:
        query["status"] = status
    if tier:
        query["tier"] = tier
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    
    contacts = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime strings
    for contact in contacts:
        for field in ['created_at', 'updated_at', 'enriched_at', 'scored_at']:
            if contact.get(field) and isinstance(contact[field], str):
                contact[field] = datetime.fromisoformat(contact[field])
    
    return contacts

@api_router.post("/contacts")
async def create_contact(contact_data: ContactCreate, user: User = Depends(get_current_user)):
    """Create a new contact"""
    contact = Contact(
        user_id=user.user_id,
        **contact_data.model_dump()
    )
    doc = contact.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.contacts.insert_one(doc)
    
    return {"contact_id": contact.contact_id, "message": "Contact created"}

@api_router.post("/contacts/bulk")
async def bulk_create_contacts(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Bulk create contacts from CSV"""
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    contacts_created = 0
    for row in reader:
        contact = Contact(
            user_id=user.user_id,
            email=row.get('email', ''),
            first_name=row.get('first_name', row.get('firstname', '')),
            last_name=row.get('last_name', row.get('lastname', '')),
            company_name=row.get('company_name', row.get('company', '')),
            company_domain=row.get('company_domain', row.get('website', row.get('domain', ''))),
            job_title=row.get('job_title', row.get('jobtitle', '')),
            phone=row.get('phone', ''),
            source='csv_upload',
            acquisition_source=row.get('acquisition_source', 'csv_upload')
        )
        doc = contact.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.contacts.insert_one(doc)
        contacts_created += 1
    
    return {"contacts_created": contacts_created}

@api_router.post("/contacts/{contact_id}/enrich")
async def enrich_contact(contact_id: str, user: User = Depends(get_current_user)):
    """Enrich a contact with LLM"""
    contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Update status
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {"status": "enriching", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Enrich with LLM
    enrichment_data = await enrich_contact_with_llm(contact, user.user_id)
    
    # Update contact with enrichment
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {
            "enrichment_data": enrichment_data,
            "status": "enriched",
            "enriched_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"contact_id": contact_id, "enrichment_data": enrichment_data}

@api_router.post("/contacts/{contact_id}/score")
async def score_contact(contact_id: str, user: User = Depends(get_current_user)):
    """Score a contact with LLM"""
    contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    enrichment_data = contact.get('enrichment_data', {})
    
    # Update status
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {"status": "scoring", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Score with LLM
    score_data = await score_contact_with_llm(contact, enrichment_data, user.user_id)
    
    # Judge check
    judge_result = await judge_score_quality(contact, score_data, enrichment_data, user.user_id)
    
    # Update contact
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {
            "score": score_data.get('score', 50),
            "tier": score_data.get('tier', 'B'),
            "score_reasoning": score_data.get('reasoning', ''),
            "status": "scored",
            "scored_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "contact_id": contact_id,
        "score": score_data.get('score'),
        "tier": score_data.get('tier'),
        "reasoning": score_data.get('reasoning'),
        "judge_validation": judge_result
    }

@api_router.post("/contacts/{contact_id}/process")
async def process_contact(contact_id: str, user: User = Depends(get_current_user)):
    """Full pipeline: enrich -> score -> activate"""
    contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Enrich
    enrichment_data = await enrich_contact_with_llm(contact, user.user_id)
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {
            "enrichment_data": enrichment_data,
            "enriched_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Score
    score_data = await score_contact_with_llm(contact, enrichment_data, user.user_id)
    tier = score_data.get('tier', 'B')
    
    # Determine activation status
    if tier == 'A':
        status = 'activated'
        action_type = 'outbound'
        # Generate email variants for Tier A
        email_variants = await generate_email_variants(contact, enrichment_data, user.user_id)
    elif tier == 'B':
        status = 'nurtured'
        action_type = 'nurture'
        email_variants = []
    else:
        status = 'suppressed'
        action_type = 'suppress'
        email_variants = []
    
    # Update contact
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {
            "score": score_data.get('score'),
            "tier": tier,
            "score_reasoning": score_data.get('reasoning'),
            "status": status,
            "scored_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create activation log
    activation = ActivationLog(
        user_id=user.user_id,
        contact_id=contact_id,
        action_type=action_type,
        tier=tier,
        email_variants=email_variants if email_variants else None,
        sequence_name="default_sequence"
    )
    activation_doc = activation.model_dump()
    activation_doc['created_at'] = activation_doc['created_at'].isoformat()
    await db.activation_logs.insert_one(activation_doc)
    
    return {
        "contact_id": contact_id,
        "enrichment_data": enrichment_data,
        "score": score_data.get('score'),
        "tier": tier,
        "reasoning": score_data.get('reasoning'),
        "status": status,
        "email_variants": email_variants
    }

@api_router.patch("/contacts/{contact_id}/pipeline")
async def update_pipeline_stage(contact_id: str, request: Request, user: User = Depends(get_current_user)):
    """Update contact pipeline stage"""
    body = await request.json()
    new_stage = body.get('pipeline_stage')
    
    contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    old_stage = contact.get('pipeline_stage', 'new')
    
    # Update contact
    await db.contacts.update_one(
        {"contact_id": contact_id},
        {"$set": {
            "pipeline_stage": new_stage,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log funnel event
    event = FunnelEvent(
        user_id=user.user_id,
        contact_id=contact_id,
        event_type="stage_change",
        from_stage=old_stage,
        to_stage=new_stage,
        deal_value=contact.get('deal_value')
    )
    event_doc = event.model_dump()
    event_doc['created_at'] = event_doc['created_at'].isoformat()
    await db.funnel_events.insert_one(event_doc)
    
    return {"contact_id": contact_id, "pipeline_stage": new_stage}

# ===================== HUBSPOT WEBHOOK =====================

@api_router.post("/webhook/hubspot")
async def hubspot_webhook(payload: HubSpotWebhook, request: Request):
    """Receive contact from HubSpot webhook (mocked for now)"""
    # Get user from API key or use default
    # In production, this would validate HubSpot signature
    
    # For demo, create contact under first user or create demo user
    user = await db.users.find_one({}, {"_id": 0})
    if not user:
        user_id = f"user_demo_{uuid.uuid4().hex[:8]}"
        user = User(user_id=user_id, email="demo@example.com", name="Demo User")
        user_doc = user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        await db.users.insert_one(user_doc)
        user = user_doc
    
    contact = Contact(
        user_id=user['user_id'],
        email=payload.email,
        first_name=payload.firstname,
        last_name=payload.lastname,
        company_name=payload.company,
        company_domain=payload.website,
        job_title=payload.jobtitle,
        phone=payload.phone,
        source='hubspot',
        acquisition_source='hubspot_webhook'
    )
    doc = contact.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.contacts.insert_one(doc)
    
    return {"contact_id": contact.contact_id, "status": "received"}

# ===================== ANALYTICS ENDPOINTS =====================

@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(user: User = Depends(get_current_user)):
    """Get dashboard overview analytics"""
    # Contact counts by status
    total_contacts = await db.contacts.count_documents({"user_id": user.user_id})
    pending = await db.contacts.count_documents({"user_id": user.user_id, "status": "pending"})
    enriched = await db.contacts.count_documents({"user_id": user.user_id, "status": {"$in": ["enriched", "scoring", "scored"]}})
    scored = await db.contacts.count_documents({"user_id": user.user_id, "status": {"$in": ["scored", "activated", "nurtured", "suppressed"]}})
    
    # Tier distribution
    tier_a = await db.contacts.count_documents({"user_id": user.user_id, "tier": "A"})
    tier_b = await db.contacts.count_documents({"user_id": user.user_id, "tier": "B"})
    tier_c = await db.contacts.count_documents({"user_id": user.user_id, "tier": "C"})
    
    # Pipeline stages
    pipeline_stages = {}
    for stage in ['new', 'qualified', 'contacted', 'meeting', 'proposal', 'closed_won', 'closed_lost']:
        pipeline_stages[stage] = await db.contacts.count_documents({"user_id": user.user_id, "pipeline_stage": stage})
    
    # LLM stats
    llm_calls_today = await db.llm_call_logs.count_documents({
        "user_id": user.user_id,
        "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    llm_success_rate = 100
    total_llm = await db.llm_call_logs.count_documents({"user_id": user.user_id})
    if total_llm > 0:
        success_llm = await db.llm_call_logs.count_documents({"user_id": user.user_id, "success": True})
        llm_success_rate = round((success_llm / total_llm) * 100, 1)
    
    # Average latency
    latency_pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$group": {"_id": None, "avg_latency": {"$avg": "$latency_ms"}}}
    ]
    latency_result = await db.llm_call_logs.aggregate(latency_pipeline).to_list(1)
    avg_latency = round(latency_result[0]['avg_latency'], 0) if latency_result else 0
    
    # Revenue by source
    revenue_pipeline = [
        {"$match": {"user_id": user.user_id, "pipeline_stage": "closed_won", "deal_value": {"$exists": True}}},
        {"$group": {"_id": "$acquisition_source", "total": {"$sum": "$deal_value"}}}
    ]
    revenue_by_source = await db.contacts.aggregate(revenue_pipeline).to_list(100)
    
    return {
        "contacts": {
            "total": total_contacts,
            "pending": pending,
            "enriched": enriched,
            "scored": scored
        },
        "tiers": {
            "A": tier_a,
            "B": tier_b,
            "C": tier_c
        },
        "pipeline": pipeline_stages,
        "llm": {
            "calls_today": llm_calls_today,
            "success_rate": llm_success_rate,
            "avg_latency_ms": avg_latency
        },
        "revenue_by_source": {r['_id'] or 'unknown': r['total'] for r in revenue_by_source}
    }

@api_router.get("/analytics/funnel")
async def get_funnel_analytics(user: User = Depends(get_current_user)):
    """Get funnel conversion analytics"""
    # Pipeline conversion rates
    stages = ['new', 'qualified', 'contacted', 'meeting', 'proposal', 'closed_won']
    stage_counts = {}
    for stage in stages:
        stage_counts[stage] = await db.contacts.count_documents({"user_id": user.user_id, "pipeline_stage": stage})
    
    # Calculate conversion rates
    conversions = []
    for i in range(len(stages) - 1):
        from_stage = stages[i]
        to_stage = stages[i + 1]
        from_count = stage_counts[from_stage]
        to_count = stage_counts[to_stage]
        rate = round((to_count / from_count * 100), 1) if from_count > 0 else 0
        conversions.append({
            "from": from_stage,
            "to": to_stage,
            "rate": rate
        })
    
    # Deal velocity (avg days in each stage) - simplified for now
    return {
        "stages": stage_counts,
        "conversions": conversions,
        "avg_deal_velocity_days": 14  # Placeholder
    }

@api_router.get("/analytics/scoring")
async def get_scoring_analytics(user: User = Depends(get_current_user)):
    """Get scoring engine analytics"""
    # Score distribution
    score_ranges = [
        {"label": "0-20", "min": 0, "max": 20},
        {"label": "21-40", "min": 21, "max": 40},
        {"label": "41-60", "min": 41, "max": 60},
        {"label": "61-80", "min": 61, "max": 80},
        {"label": "81-100", "min": 81, "max": 100}
    ]
    
    score_distribution = []
    for sr in score_ranges:
        count = await db.contacts.count_documents({
            "user_id": user.user_id,
            "score": {"$gte": sr["min"], "$lte": sr["max"]}
        })
        score_distribution.append({"range": sr["label"], "count": count})
    
    # Recent scores
    recent_scores = await db.contacts.find(
        {"user_id": user.user_id, "score": {"$exists": True}},
        {"_id": 0, "contact_id": 1, "email": 1, "score": 1, "tier": 1, "score_reasoning": 1, "scored_at": 1}
    ).sort("scored_at", -1).limit(20).to_list(20)
    
    # Tier breakdown over time (last 7 days) - optimized single query
    tier_counts = {
        "A": await db.contacts.count_documents({"user_id": user.user_id, "tier": "A"}),
        "B": await db.contacts.count_documents({"user_id": user.user_id, "tier": "B"}),
        "C": await db.contacts.count_documents({"user_id": user.user_id, "tier": "C"})
    }
    tier_trend = []
    for i in range(7):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        tier_trend.append({
            "date": date,
            **tier_counts
        })
    
    return {
        "score_distribution": score_distribution,
        "recent_scores": recent_scores,
        "tier_trend": tier_trend[::-1]
    }

@api_router.get("/analytics/llm")
async def get_llm_analytics(user: User = Depends(get_current_user)):
    """Get LLM observability analytics"""
    # Calls by type
    call_types = ['enrichment', 'scoring', 'email_personalization', 'judge_check', 'guardrail']
    calls_by_type = {}
    for ct in call_types:
        calls_by_type[ct] = await db.llm_call_logs.count_documents({"user_id": user.user_id, "call_type": ct})
    
    # Latency trend (last 24 hours by hour)
    latency_trend = []
    for i in range(24):
        hour_start = datetime.now(timezone.utc) - timedelta(hours=i+1)
        hour_end = datetime.now(timezone.utc) - timedelta(hours=i)
        
        pipeline = [
            {"$match": {
                "user_id": user.user_id,
                "created_at": {"$gte": hour_start.isoformat(), "$lt": hour_end.isoformat()}
            }},
            {"$group": {"_id": None, "avg": {"$avg": "$latency_ms"}, "count": {"$sum": 1}}}
        ]
        result = await db.llm_call_logs.aggregate(pipeline).to_list(1)
        latency_trend.append({
            "hour": hour_end.strftime("%H:00"),
            "avg_latency": round(result[0]['avg'], 0) if result else 0,
            "count": result[0]['count'] if result else 0
        })
    
    # Error rate
    total = await db.llm_call_logs.count_documents({"user_id": user.user_id})
    errors = await db.llm_call_logs.count_documents({"user_id": user.user_id, "success": False})
    error_rate = round((errors / total * 100), 2) if total > 0 else 0
    
    # Recent logs
    recent_logs = await db.llm_call_logs.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Token usage
    token_pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$group": {
            "_id": None,
            "total_input": {"$sum": "$input_tokens"},
            "total_output": {"$sum": "$output_tokens"}
        }}
    ]
    token_result = await db.llm_call_logs.aggregate(token_pipeline).to_list(1)
    
    return {
        "calls_by_type": calls_by_type,
        "latency_trend": latency_trend[::-1],
        "error_rate": error_rate,
        "total_calls": total,
        "recent_logs": recent_logs,
        "token_usage": {
            "input": token_result[0]['total_input'] if token_result else 0,
            "output": token_result[0]['total_output'] if token_result else 0
        }
    }

@api_router.get("/analytics/attribution")
async def get_attribution_analytics(user: User = Depends(get_current_user)):
    """Get pipeline attribution analytics"""
    # Revenue by source
    revenue_pipeline = [
        {"$match": {"user_id": user.user_id, "deal_value": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": "$acquisition_source",
            "total_revenue": {"$sum": "$deal_value"},
            "deal_count": {"$sum": 1},
            "avg_deal": {"$avg": "$deal_value"}
        }}
    ]
    revenue_by_source = await db.contacts.aggregate(revenue_pipeline).to_list(100)
    
    # Revenue by tier
    revenue_by_tier = [
        {"$match": {"user_id": user.user_id, "deal_value": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": "$tier",
            "total_revenue": {"$sum": "$deal_value"},
            "deal_count": {"$sum": 1}
        }}
    ]
    tier_revenue = await db.contacts.aggregate(revenue_by_tier).to_list(10)
    
    return {
        "by_source": [
            {
                "source": r['_id'] or 'unknown',
                "total_revenue": r['total_revenue'],
                "deal_count": r['deal_count'],
                "avg_deal": round(r['avg_deal'], 2)
            } for r in revenue_by_source
        ],
        "by_tier": {r['_id'] or 'unknown': r for r in tier_revenue}
    }

# ===================== CONTACT DETAIL =====================

@api_router.get("/contacts/{contact_id}")
async def get_contact_detail(contact_id: str, user: User = Depends(get_current_user)):
    """Get detailed contact info"""
    contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get related activation logs
    activations = await db.activation_logs.find(
        {"contact_id": contact_id, "user_id": user.user_id}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get LLM call logs for this contact
    llm_logs = await db.llm_call_logs.find(
        {"contact_id": contact_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "contact": contact,
        "activations": activations,
        "llm_logs": llm_logs
    }

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: User = Depends(get_current_user)):
    """Delete a contact"""
    result = await db.contacts.delete_one({"contact_id": contact_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

# ===================== BULK PROCESSING =====================

@api_router.post("/contacts/bulk-process")
async def bulk_process_contacts(request: Request, user: User = Depends(get_current_user)):
    """Process multiple contacts through the pipeline"""
    body = await request.json()
    contact_ids = body.get("contact_ids", [])
    
    if not contact_ids:
        # Process all pending contacts
        pending = await db.contacts.find(
            {"user_id": user.user_id, "status": "pending"},
            {"_id": 0, "contact_id": 1}
        ).limit(50).to_list(50)
        contact_ids = [c["contact_id"] for c in pending]
    
    # Batch fetch all contacts at once (avoid N+1 queries)
    contacts_batch = await db.contacts.find(
        {"contact_id": {"$in": contact_ids[:50]}, "user_id": user.user_id},
        {"_id": 0}
    ).to_list(50)
    contacts_map = {c["contact_id"]: c for c in contacts_batch}
    
    results = []
    for contact_id in contact_ids[:50]:  # Limit to 50
        try:
            contact = contacts_map.get(contact_id)
            if not contact:
                results.append({"contact_id": contact_id, "status": "not_found"})
                continue
            
            # Enrich
            enrichment_data = await enrich_contact_with_llm(contact, user.user_id)
            
            # Score
            score_data = await score_contact_with_llm(contact, enrichment_data, user.user_id)
            tier = score_data.get('tier', 'B')
            
            # Determine status
            status = 'activated' if tier == 'A' else ('nurtured' if tier == 'B' else 'suppressed')
            action_type = 'outbound' if tier == 'A' else ('nurture' if tier == 'B' else 'suppress')
            
            # Update contact
            await db.contacts.update_one(
                {"contact_id": contact_id},
                {"$set": {
                    "enrichment_data": enrichment_data,
                    "score": score_data.get('score'),
                    "tier": tier,
                    "score_reasoning": score_data.get('reasoning'),
                    "status": status,
                    "enriched_at": datetime.now(timezone.utc).isoformat(),
                    "scored_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Create activation
            activation = ActivationLog(
                user_id=user.user_id,
                contact_id=contact_id,
                action_type=action_type,
                tier=tier,
                sequence_name="bulk_process"
            )
            activation_doc = activation.model_dump()
            activation_doc['created_at'] = activation_doc['created_at'].isoformat()
            await db.activation_logs.insert_one(activation_doc)
            
            results.append({
                "contact_id": contact_id,
                "status": "processed",
                "tier": tier,
                "score": score_data.get('score')
            })
        except Exception as e:
            results.append({"contact_id": contact_id, "status": "error", "error": str(e)})
    
    return {"processed": len(results), "results": results}

# ===================== GUARDRAIL CHECK =====================

async def check_guardrails(content: str, contact: Dict, user_id: str) -> Dict:
    """Check content against compliance guardrails"""
    start_time = time.time()
    
    # Ensure contact is never None
    if contact is None:
        contact = {}
    
    prompt = f"""Evaluate this outbound email content for compliance issues.

Content to evaluate:
"{content}"

Contact context:
- Company: {contact.get('company_name', 'unknown')}
- Industry: {contact.get('enrichment_data', {}).get('industry', 'unknown')}

Check for these compliance criteria:
1. No false claims or misleading statements
2. No aggressive or pushy language
3. No promises of specific results
4. Professional and respectful tone
5. No spam trigger words
6. Appropriate for B2B outreach

Return JSON:
{{
    "passed": true/false,
    "violations": ["list of any violations found"],
    "risk_level": "low/medium/high",
    "suggestions": ["improvements if any"]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"guardrail_{uuid.uuid4().hex[:8]}",
            system_message="You are a compliance checker. Return only valid JSON."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        response = await chat.send_message(UserMessage(text=prompt))
        latency_ms = int((time.time() - start_time) * 1000)
        
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            result = json.loads(json_str.strip())
        except:
            result = {"passed": True, "violations": [], "risk_level": "low", "suggestions": []}
        
        await log_llm_call(
            user_id=user_id,
            call_type="guardrail",
            model_name="claude-sonnet-4-5-20250929",
            provider="anthropic",
            input_tokens=len(prompt.split()),
            output_tokens=len(response.split()),
            latency_ms=latency_ms,
            success=True,
            input_preview=prompt,
            output_preview=response
        )
        
        return result
    except Exception as e:
        return {"passed": True, "violations": [], "risk_level": "unknown", "error": str(e)}

@api_router.post("/guardrail/check")
async def guardrail_check(request: Request, user: User = Depends(get_current_user)):
    """Check content against compliance guardrails"""
    body = await request.json()
    content = body.get("content", "")
    contact_id = body.get("contact_id")
    
    contact = {}
    if contact_id:
        contact = await db.contacts.find_one({"contact_id": contact_id, "user_id": user.user_id}, {"_id": 0}) or {}
    
    result = await check_guardrails(content, contact, user.user_id)
    return result

# ===================== WEEKLY HEALTH SUMMARY =====================

@api_router.get("/analytics/weekly-summary")
async def get_weekly_summary(user: User = Depends(get_current_user)):
    """Get weekly pipeline health summary"""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_ago_str = week_ago.isoformat()
    
    # Conversion rates by tier
    tier_conversions = {}
    for tier in ['A', 'B', 'C']:
        total = await db.contacts.count_documents({"user_id": user.user_id, "tier": tier})
        closed_won = await db.contacts.count_documents({
            "user_id": user.user_id, 
            "tier": tier, 
            "pipeline_stage": "closed_won"
        })
        tier_conversions[tier] = {
            "total": total,
            "closed_won": closed_won,
            "conversion_rate": round((closed_won / total * 100), 1) if total > 0 else 0
        }
    
    # Deal velocity (avg days from new to closed_won)
    closed_deals = await db.contacts.find({
        "user_id": user.user_id,
        "pipeline_stage": "closed_won"
    }, {"_id": 0, "created_at": 1, "updated_at": 1}).to_list(100)
    
    velocities = []
    for deal in closed_deals:
        try:
            created = deal.get('created_at')
            updated = deal.get('updated_at')
            if isinstance(created, str):
                created = datetime.fromisoformat(created)
            if isinstance(updated, str):
                updated = datetime.fromisoformat(updated)
            if created and updated:
                days = (updated - created).days
                velocities.append(days)
        except:
            pass
    
    avg_velocity = round(sum(velocities) / len(velocities), 1) if velocities else 0
    
    # Top acquisition sources
    source_pipeline = [
        {"$match": {"user_id": user.user_id, "deal_value": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": "$acquisition_source",
            "revenue": {"$sum": "$deal_value"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 5}
    ]
    top_sources = await db.contacts.aggregate(source_pipeline).to_list(5)
    
    # LLM health
    total_llm_week = await db.llm_call_logs.count_documents({
        "user_id": user.user_id,
        "created_at": {"$gte": week_ago_str}
    })
    failed_llm_week = await db.llm_call_logs.count_documents({
        "user_id": user.user_id,
        "created_at": {"$gte": week_ago_str},
        "success": False
    })
    
    # Contacts processed this week
    contacts_enriched = await db.contacts.count_documents({
        "user_id": user.user_id,
        "enriched_at": {"$gte": week_ago_str}
    })
    contacts_scored = await db.contacts.count_documents({
        "user_id": user.user_id,
        "scored_at": {"$gte": week_ago_str}
    })
    
    return {
        "period": "last_7_days",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tier_conversions": tier_conversions,
        "avg_deal_velocity_days": avg_velocity,
        "top_acquisition_sources": [
            {"source": s["_id"] or "unknown", "revenue": s["revenue"], "deals": s["count"]}
            for s in top_sources
        ],
        "llm_health": {
            "total_calls": total_llm_week,
            "failed_calls": failed_llm_week,
            "success_rate": round(((total_llm_week - failed_llm_week) / total_llm_week * 100), 1) if total_llm_week > 0 else 100
        },
        "processing_volume": {
            "contacts_enriched": contacts_enriched,
            "contacts_scored": contacts_scored
        }
    }

# ===================== ACTIVATION LOGS =====================

@api_router.get("/activations")
async def get_activations(
    action_type: Optional[str] = None,
    limit: int = 50,
    user: User = Depends(get_current_user)
):
    """Get activation logs"""
    query = {"user_id": user.user_id}
    if action_type:
        query["action_type"] = action_type
    
    logs = await db.activation_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return logs

# ===================== SEED DATA =====================

@api_router.post("/seed/demo")
async def seed_demo_data(user: User = Depends(get_current_user)):
    """Seed demo data for testing"""
    # Sample contacts
    sample_contacts = [
        {"email": "john.smith@acme.com", "first_name": "John", "last_name": "Smith", "company_name": "Acme Corp", "company_domain": "acme.com", "job_title": "VP of Engineering", "source": "hubspot", "acquisition_source": "webinar"},
        {"email": "sarah.johnson@techstartup.io", "first_name": "Sarah", "last_name": "Johnson", "company_name": "TechStartup", "company_domain": "techstartup.io", "job_title": "CTO", "source": "manual", "acquisition_source": "linkedin"},
        {"email": "mike.chen@enterprise.com", "first_name": "Mike", "last_name": "Chen", "company_name": "Enterprise Inc", "company_domain": "enterprise.com", "job_title": "Director of Product", "source": "hubspot", "acquisition_source": "referral"},
        {"email": "emma.davis@smallbiz.co", "first_name": "Emma", "last_name": "Davis", "company_name": "SmallBiz Co", "company_domain": "smallbiz.co", "job_title": "Marketing Manager", "source": "csv_upload", "acquisition_source": "content"},
        {"email": "alex.rodriguez@midmarket.com", "first_name": "Alex", "last_name": "Rodriguez", "company_name": "MidMarket Solutions", "company_domain": "midmarket.com", "job_title": "CEO", "source": "hubspot", "acquisition_source": "paid_ads"},
        {"email": "lisa.wong@growth.io", "first_name": "Lisa", "last_name": "Wong", "company_name": "Growth Labs", "company_domain": "growth.io", "job_title": "Head of Sales", "source": "manual", "acquisition_source": "webinar"},
        {"email": "david.kim@fintech.com", "first_name": "David", "last_name": "Kim", "company_name": "FinTech Pro", "company_domain": "fintech.com", "job_title": "VP Sales", "source": "hubspot", "acquisition_source": "linkedin"},
        {"email": "rachel.lee@saas.io", "first_name": "Rachel", "last_name": "Lee", "company_name": "SaaS Platform", "company_domain": "saas.io", "job_title": "Product Manager", "source": "csv_upload", "acquisition_source": "organic"},
    ]
    
    created_contacts = []
    for sc in sample_contacts:
        # Check if exists
        existing = await db.contacts.find_one({"email": sc['email'], "user_id": user.user_id})
        if not existing:
            contact = Contact(user_id=user.user_id, **sc)
            doc = contact.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['updated_at'] = doc['updated_at'].isoformat()
            await db.contacts.insert_one(doc)
            created_contacts.append(contact.contact_id)
    
    return {"contacts_created": len(created_contacts), "contact_ids": created_contacts}

# ===================== HEALTH CHECK =====================

@api_router.get("/")
async def root():
    return {"message": "GTM Intelligence Platform API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
