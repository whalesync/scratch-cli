#!/usr/bin/env python3
"""
FastAPI Endpoints for Chat Server
"""

import time
import uuid
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, HTTPException

from models import ChatMessage, ChatSession, SendMessageRequest, SendMessageResponse, ChatSessionSummary
from chat_service import ChatService
from logger import log_info, log_warning, log_error

# Create router
router = APIRouter(tags=["chat"])

# Initialize chat service
chat_service = ChatService()

@router.post("/sessions", response_model=Dict[str, ChatSessionSummary])
async def create_session(snapshot_id: str):
    """Create a new chat session"""
    # if not session_id:
    session_id = f"session_{int(time.time())}_{uuid.uuid4().hex[:8]}"

    session = chat_service.create_session(session_id, snapshot_id)
    chat_service.sessions[session_id] = session
    
    # Create summary for client response
    session_summary = ChatSessionSummary(
        id=session.id,
        name=session.name,
        last_activity=session.last_activity,
        created_at=session.created_at
    )
    
    log_info(
        "Session created", 
        session_id=session_id, 
        total_sessions=len(chat_service.sessions), 
        snapshot_id=snapshot_id
    )
    return {"session": session_summary}

@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_session(session_id: str):
    """Get session information"""
    log_info("Session accessed", session_id=session_id)
    print(f"🔍 Looking for session: {session_id}")
    print(f"📋 Available sessions: {list(chat_service.sessions.keys())}")
    
    if session_id not in chat_service.sessions:
        log_warning("Session not found", session_id=session_id, available_sessions=list(chat_service.sessions.keys()))
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_service.sessions[session_id]
    session.last_activity = datetime.now()
    return session

@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(session_id: str, request: SendMessageRequest):
    """Send a message to the agent"""
    log_info("Message received", session_id=session_id, message_length=len(request.message), has_api_token=request.api_token is not None, style_guides_count=len(request.style_guides) if request.style_guides else 0)
    print(f"💬 Processing message for session: {session_id}")
    print(f"📋 Available sessions: {list(chat_service.sessions.keys())}")
    print(f"📝 Message: {request.message}")
    if request.api_token:
        print(f"🔑 API token provided: {request.api_token[:8]}..." if len(request.api_token) > 8 else request.api_token)
    else:
        print(f"ℹ️ No API token provided")
    if request.style_guides:
        print(f"📚 Style guides provided: {len(request.style_guides)} guides")
        for i, guide in enumerate(request.style_guides, 1):
            print(f"   Guide {i}: {guide[:50]}..." if len(guide) > 50 else f"   Guide {i}: {guide}")
    else:
        print(f"ℹ️ No style guides provided")
    
    if session_id not in chat_service.sessions:
        log_error("Message failed - session not found", session_id=session_id, available_sessions=list(chat_service.sessions.keys()))
        print(f"❌ Session {session_id} not found!")
        print(f"🔍 Available sessions: {list(chat_service.sessions.keys())}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_service.sessions[session_id]
    print(f"✅ Found session: {session_id}")
    if session.snapshot_id:
        print(f"📊 Session associated with snapshot: {session.snapshot_id}")
    print(f"📊 Session history length: {len(session.history)}")
    print(f"💾 Important facts: {len(session.important_facts)}")
    
    session.last_activity = datetime.now()
    
    # Add user message to history
    user_message = ChatMessage(
        message=request.message,
        role="user",
        timestamp=datetime.now()
    )
    
 
    session.history.append(user_message)
    print(f"📝 Added user message to history. New length: {len(session.history)}")
    
    try:
        # Process with agent
        print(f"🤖 Processing with agent...")
        log_info("Agent processing started", session_id=session_id, history_length=len(session.history), snapshot_id=session.snapshot_id)
        
        response = await chat_service.process_message_with_agent(session, request.message, request.api_token, request.style_guides)
        
        log_info("Agent response received", session_id=session_id, response_length=len(response.message), emotion=response.emotion, snapshot_id=session.snapshot_id)
        print(f"✅ Agent response received: {response.message[:50]}...")
        
        # Add assistant response to history

        assistant_message = ChatMessage(
            message=response.message,
            role="assistant",
            timestamp=datetime.now()
        )
        
        session.history.append(assistant_message)
        print(f"📝 Added assistant message to history. New length: {len(session.history)}")
        
        # Check if user mentioned remembering something
        if "remember" in request.message.lower() or "=" in request.message:
            # Extract potential facts (simple heuristic)
            if "=" in request.message:
                fact = request.message.strip()
                if fact not in session.important_facts:
                    session.important_facts.append(fact)
                    log_info("Fact stored", session_id=session_id, fact=fact, snapshot_id=session.snapshot_id)
                    print(f"💾 Stored fact for session {session_id}: {fact}")
        
        # Update session
        chat_service.sessions[session_id] = session
        print(f"💾 Session updated in storage")
        print(f"📊 Final session state - History: {len(session.history)}, Facts: {len(session.important_facts)}")
        
        return response
        
    except Exception as e:
        log_error("Message processing failed", session_id=session_id, error=str(e), snapshot_id=session.snapshot_id)
        print(f"❌ Error processing message: {e}")
        print(f"🔍 Session state after error - History: {len(session.history)}, Facts: {len(session.important_facts)}")
        # Don't update the session if there was an error
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    log_info("Session deleted", session_id=session_id)
    
    if session_id not in chat_service.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del chat_service.sessions[session_id]
    print(f"🗑️ Deleted session: {session_id}")
    return {"success": True}

@router.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    log_info("Sessions listed", session_count=len(chat_service.sessions))
    
    # Convert full sessions to summaries
    session_summaries = []
    for session in chat_service.sessions.values():
        summary = ChatSessionSummary(
            id=session.id,
            name=session.name,
            last_activity=session.last_activity,
            created_at=session.created_at
        )
        session_summaries.append(summary)
    
    return {"sessions": session_summaries}

@router.post("/cleanup")
async def cleanup_sessions():
    """Manually trigger session cleanup"""
    before_count = len(chat_service.sessions)
    chat_service.cleanup_inactive_sessions()
    after_count = len(chat_service.sessions)
    cleaned_count = before_count - after_count
    
    log_info("Session cleanup completed", sessions_cleaned=cleaned_count, remaining_sessions=after_count)
    return {"message": "Cleanup completed"} 