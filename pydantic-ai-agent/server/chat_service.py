#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import HTTPException

from agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agent.agent import create_agent, extract_response
from logger import log_info, log_error, log_debug, log_warning
from scratchpad_api import API_CONFIG, check_server_health
# from tools import set_api_token, set_session_data

class ChatService:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}

    def create_session(self, session_id: str, snapshot_id: str) -> ChatSession:
        """Create a new chat session and set session data in tools"""
        now = datetime.now()
        session = ChatSession(
            id=session_id,
            name=f"Chat Session {now.strftime('%Y-%m-%d %H:%M')}",
            last_activity=now,
            created_at=now,
            snapshot_id=snapshot_id
        )
        
        
        log_info("Session created and session data set", 
                 session_id=session_id, 
                 snapshot_id=snapshot_id)
        print(f"📝 Created session: {session_id}")
        if snapshot_id:
            print(f"📊 Session associated with snapshot: {snapshot_id}")
        
        return session

    async def process_message_with_agent(
        self, 
        session: ChatSession, 
        user_message: str, 
        api_token: str,
        style_guides: Optional[List[str]] = None
    ) -> ResponseFromAgent:
        """Process a message with the agent and return the response"""
        print(f"🤖 Starting agent processing for session: {session.id}")
        if session.snapshot_id:
            print(f"📊 Session associated with snapshot: {session.snapshot_id}")
        # Set API token in tools' global state for this message
        if api_token:
            # set_api_token(api_token)
            log_info("API token set for tools", 
                     session_id=session.id, 
                     token_length=len(api_token), 
                     token_preview=api_token[:8] + "..." if len(api_token) > 8 else api_token,
                     snapshot_id=session.snapshot_id)
            print(f"🔑 API token set for tools: {api_token[:8]}..." if len(api_token) > 8 else api_token)   
        else:
            log_info("No API token provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No API token provided")
        
        
        try:
            # Build context from session history
            context = ""
            
            # Include style guides if provided
            if style_guides:
                print(f"📚 Including {len(style_guides)} style guides in prompt")
                context += f"\n\nSTYLE GUIDES TO FOLLOW:\n"
                for i, style_guide in enumerate(style_guides, 1):
                    print(f"   Style Guide {i}: {style_guide[:50]}..." if len(style_guide) > 50 else f"   Style Guide {i}: {style_guide}")
                    context += f"Style Guide {i}:\n{style_guide}\n\n"
            else:
                print(f"ℹ️ No style guides to include")
            
            # Include summary history for agent context
            if session.summary_history:
                context += f"\n\nSUMMARY HISTORY:\n"
                for summary in session.summary_history:
                    context += f"Request: {summary.request_summary}\n"
                    context += f"Response: {summary.response_summary}\n\n"
            
            # Include recent chat history for user context (last 5 messages)
            if session.chat_history:
                recent_history = session.chat_history[-5:]
                context += f"\n\nRECENT CONVERSATION:\n"
                for msg in recent_history:
                    truncated_msg = msg.message[:100] + "..." if len(msg.message) > 100 else msg.message
                    context += f"{msg.role.capitalize()}: {truncated_msg}\n"
            
            # Create the full prompt with memory
            full_prompt = f"Respond to: {user_message}. Provide your response with a well-formatted message for the user and a concise summary of key actions/decisions for future reference.{context}"
            
            print(f"DEBUG - Context length: {len(context)}")
            print(f"DEBUG - Chat history length: {len(session.chat_history)}")
            print(f"DEBUG - Summary history length: {len(session.summary_history)}")
            print(f"DEBUG - Full prompt length: {len(full_prompt)}")
            
            # Log agent processing details
            log_debug("Agent processing details", 
                     session_id=session.id,
                     context_length=len(context),
                     chat_history_length=len(session.chat_history),
                     summary_history_length=len(session.summary_history),
                     style_guides_count=len(style_guides) if style_guides else 0,
                     full_prompt_length=len(full_prompt),
                     user_message=user_message,
                     has_api_token=api_token is not None,
                     snapshot_id=session.snapshot_id)
            
            # Get structured response from agent with timeout
            print(f"🤖 Calling agent.run() with timeout...")
            try:
                # Create context with API token and snapshot ID for tools
                chatRunContext:ChatRunContext = ChatRunContext(
                    session=session,
                    api_token=api_token
                )

                agent = create_agent()
                result = await asyncio.wait_for(agent.run(
                    full_prompt, 
                    deps=chatRunContext
                ), timeout=30.0)  # 30 second timeout
                print(f"✅ Agent.run() completed")
            except asyncio.TimeoutError:
                log_error("Agent processing timeout", session_id=session.id, timeout_seconds=30, snapshot_id=session.snapshot_id)
                print(f"❌ Agent.run() timed out after 30 seconds")
                raise HTTPException(status_code=408, detail="Agent response timeout")
            
            # The agent returns an AgentRunResult wrapper, we need to extract the actual response
            response = result
            print(f"🔍 Agent result: {type(response)}")
            print(f"🔍 Response class: {response.__class__}")
            print(f"🔍 ResponseFromAgent class: {ResponseFromAgent}")
            
            # Extract the actual response from the AgentRunResult
            actual_response = extract_response(response)
            if not actual_response:
                log_error("No response from agent", session_id=session.id, snapshot_id=session.snapshot_id)
                print(f"❌ No response from agent")
                raise HTTPException(status_code=500, detail="No response from agent")
            
            print(f"🔍 Actual response: {type(actual_response)}")
            print(f"🔍 Is instance check: {isinstance(actual_response, ResponseFromAgent)}")
            
            # Check if actual_response has the expected fields using getattr for safety
            try:
                response_message = getattr(actual_response, 'response_message', None)
                response_summary = getattr(actual_response, 'response_summary', None)
                request_summary = getattr(actual_response, 'request_summary', None)
                
                has_expected_fields = (
                    actual_response and 
                    response_message is not None and 
                    response_summary is not None and 
                    request_summary is not None
                )
            except:
                has_expected_fields = False
            
            if has_expected_fields:
                log_info("Agent response successful", 
                         session_id=session.id,
                         response_length=len(response_message),  # type: ignore
                         response_summary_length=len(response_summary),  # type: ignore
                         request_summary_length=len(request_summary),  # type: ignore
                         had_api_token=api_token is not None,
                         snapshot_id=session.snapshot_id)
                print(f"✅ Valid ResponseFromAgent received")
                # Return both the SendMessageResponse and the original ResponseFromAgent
                # send_response = SendMessageResponseDTO(
                #     response_message=response_message,  # type: ignore
                #     response_summary=response_summary,  # type: ignore
                #     request_summary=request_summary,  # type: ignore
                # )
                
                # # Store the original response for access to summaries
                # send_response.original_response = actual_response  # type: ignore
                
                return actual_response
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