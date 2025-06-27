#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import HTTPException

from models import ChatSession, ChatMessage, SendMessageResponse, ChatResponse
from agent import create_agent, extract_response
from logger import log_info, log_error, log_debug, log_warning
from scratchpad_api import API_CONFIG, check_server_health
from tools import set_api_token, set_session_data

class ChatService:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}
        self.agent: Optional[Any] = None
        self._initialize_agent()

    def _initialize_agent(self) -> None:
        """Initialize the PydanticAI agent"""
        self.agent = create_agent()
        if self.agent:
            log_info("Agent initialized successfully")
        else:
            log_error("Agent initialization failed")

    def create_chat_message(self, message: str, role: str, timestamp: datetime) -> ChatMessage:
        """Create a new chat message"""
        return ChatMessage(
            message=message,
            role=role,
            timestamp=timestamp
        )

    def create_session(self, session_id: str, snapshot_id: Optional[str] = None) -> ChatSession:
        """Create a new chat session and set session data in tools"""
        now = datetime.now()
        session = ChatSession(
            id=session_id,
            name=f"Chat Session {now.strftime('%Y-%m-%d %H:%M')}",
            last_activity=now,
            created_at=now,
            snapshot_id=snapshot_id
        )
        
        # Set session data in tools' global state
        session_data = {
            'session_id': session_id,
            'snapshot_id': snapshot_id
        }
        set_session_data(session_data)
        
        log_info("Session created and session data set", 
                 session_id=session_id, 
                 snapshot_id=snapshot_id)
        print(f"📝 Created session: {session_id}")
        if snapshot_id:
            print(f"📊 Session associated with snapshot: {snapshot_id}")
        
        return session

    async def process_message_with_agent(self, session: ChatSession, user_message: str, api_token: Optional[str] = None) -> SendMessageResponse:
        """Process a message with the agent and return the response"""
        print(f"🤖 Starting agent processing for session: {session.id}")
        if session.snapshot_id:
            print(f"📊 Session associated with snapshot: {session.snapshot_id}")
        
        # Set API token in tools' global state for this message
        if api_token:
            set_api_token(api_token)
            log_info("API token set for tools", 
                     session_id=session.id, 
                     token_length=len(api_token), 
                     token_preview=api_token[:8] + "..." if len(api_token) > 8 else api_token,
                     snapshot_id=session.snapshot_id)
            print(f"🔑 API token set for tools: {api_token[:8]}..." if len(api_token) > 8 else api_token)
            
            # Test server connectivity
            if check_server_health():
                log_info("Scratchpad server health check passed", session_id=session.id, snapshot_id=session.snapshot_id)
                print(f"✅ Scratchpad server is healthy")
            else:
                log_warning("Scratchpad server health check failed", session_id=session.id, snapshot_id=session.snapshot_id)
                print(f"⚠️ Scratchpad server health check failed")
        else:
            log_info("No API token provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No API token provided")
        
        if not self.agent:
            log_error("Agent processing failed - agent not initialized", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"❌ Agent not initialized!")
            raise HTTPException(status_code=500, detail="Agent not initialized")
        
        try:
            # Build context from session history and important facts
            context = ""
            if session.important_facts:
                context = f"\n\nIMPORTANT FACTS TO REMEMBER:\n" + "\n".join(session.important_facts[-3:])  # Only last 3 facts
            
            if session.history:
                # Include only the last 4 messages to keep context manageable
                recent_history = session.history[-4:]  # Last 4 messages instead of 6
                context += f"\n\nRECENT CONVERSATION:\n"
                for msg in recent_history:
                    # Truncate long messages to prevent context explosion
                    truncated_msg = msg.message[:100] + "..." if len(msg.message) > 100 else msg.message
                    context += f"{msg.role.capitalize()}: {truncated_msg}\n"
            
            # Create the full prompt with memory
            full_prompt = f"Respond to: {user_message}. Provide your response with a message and an emotion.{context}"
            
            print(f"DEBUG - Context length: {len(context)}")
            print(f"DEBUG - History length: {len(session.history)}")
            print(f"DEBUG - Important facts: {len(session.important_facts)}")
            print(f"DEBUG - Full prompt length: {len(full_prompt)}")
            
            # Log agent processing details
            log_debug("Agent processing details", 
                     session_id=session.id,
                     context_length=len(context),
                     history_length=len(session.history),
                     important_facts_count=len(session.important_facts),
                     full_prompt_length=len(full_prompt),
                     user_message=user_message,
                     has_api_token=api_token is not None,
                     snapshot_id=session.snapshot_id)
            
            # Get structured response from agent with timeout
            print(f"🤖 Calling agent.run() with timeout...")
            try:
                # Create context with API token and snapshot ID for tools
                context = {}
                if api_token:
                    context['api_token'] = api_token
                if session.snapshot_id:
                    context['snapshot_id'] = session.snapshot_id
                
                result = await asyncio.wait_for(self.agent.run(full_prompt, deps=context), timeout=30.0)  # 30 second timeout
                print(f"✅ Agent.run() completed")
            except asyncio.TimeoutError:
                log_error("Agent processing timeout", session_id=session.id, timeout_seconds=30, snapshot_id=session.snapshot_id)
                print(f"❌ Agent.run() timed out after 30 seconds")
                raise HTTPException(status_code=408, detail="Agent response timeout")
            
            response = extract_response(result)
            print(f"🔍 Extracted response: {type(response)}")
            
            if response and isinstance(response, ChatResponse):
                log_info("Agent response successful", 
                         session_id=session.id,
                         response_length=len(response.message),
                         emotion=response.emotion,
                         had_api_token=api_token is not None,
                         snapshot_id=session.snapshot_id)
                print(f"✅ Valid ChatResponse received")
                return SendMessageResponse(
                    message=response.message,
                    emotion=response.emotion,
                    session_id=session.id
                )
            else:
                log_error("Invalid agent response", session_id=session.id, response_type=type(response), snapshot_id=session.snapshot_id)
                print(f"❌ Invalid response from agent: {response}")
                raise HTTPException(status_code=500, detail="Invalid response from agent")
                
        except Exception as e:
            log_error("Agent processing error", session_id=session.id, error=str(e), snapshot_id=session.snapshot_id)
            print(f"❌ Error in agent processing: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

    def cleanup_inactive_sessions(self, max_age_hours: int = 24) -> None:
        """Clean up inactive sessions"""
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        to_delete = []
        
        for session_id, session in self.sessions.items():
            if session.last_activity < cutoff:
                to_delete.append(session_id)
        
        for session_id in to_delete:
            del self.sessions[session_id]
        
        if to_delete:
            log_info("Sessions cleaned up", sessions_cleaned=len(to_delete), max_age_hours=max_age_hours)
            print(f"🧹 Cleaned up {len(to_delete)} inactive sessions") 