#!/usr/bin/env python3
"""
FastAPI Chat Server for PydanticAI Agent with Session Management
"""

import os
import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Load environment variables
load_dotenv()

# Import the agent components
from simple_chat import Agent, ChatResponse, extract_response
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

# Initialize FastAPI app
app = FastAPI(title="PydanticAI Chat Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class ChatMessage(BaseModel):
    message: str = Field(description="The message content")
    role: str = Field(description="The role (user or assistant)")
    timestamp: datetime = Field(default_factory=datetime.now)

class ChatSession(BaseModel):
    id: str
    history: List[ChatMessage] = []
    important_facts: List[str] = []
    created_at: datetime = Field(default_factory=datetime.now)
    last_activity: datetime = Field(default_factory=datetime.now)

class SendMessageRequest(BaseModel):
    message: str

class SendMessageResponse(BaseModel):
    message: str
    emotion: str
    session_id: str

# Global session storage
sessions: Dict[str, ChatSession] = {}

# Initialize the agent
agent: Optional[Any] = None

def initialize_agent():
    """Initialize the PydanticAI agent"""
    global agent
    
    try:
        # OpenRouter API key
        api_key = "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"
        
        if not api_key:
            raise ValueError("OpenRouter API key not found")
        
        # Create the model using OpenRouter
        model = OpenAIModel(
            'google/gemini-2.5-flash-lite-preview-06-17',
            provider=OpenRouterProvider(api_key=api_key),
        )
        
        # Create the agent
        agent = Agent(
            name="ChatServerAgent",
            instructions="You are a friendly AI assistant. Respond to user messages in a helpful and engaging way. Always respond with a message and an emotion. Remember important information that users tell you and use it in future conversations.",
            output_type=ChatResponse,
            model=model
        )
        
        print("✅ Agent initialized successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error initializing agent: {e}")
        return False

async def process_message_with_agent(session: ChatSession, user_message: str) -> SendMessageResponse:
    """Process a message with the agent and return the response"""
    global agent
    
    if not agent:
        raise HTTPException(status_code=500, detail="Agent not initialized")
    
    try:
        # Build context from session history and important facts
        context = ""
        if session.important_facts:
            context = f"\n\nIMPORTANT FACTS TO REMEMBER:\n" + "\n".join(session.important_facts)
        
        if session.history:
            # Include last few messages for context
            recent_history = session.history[-6:]  # Last 6 messages
            context += f"\n\nRECENT CONVERSATION:\n"
            for msg in recent_history:
                context += f"{msg.role.capitalize()}: {msg.message}\n"
        
        # Create the full prompt with memory
        full_prompt = f"Respond to: {user_message}. Provide your response with a message and an emotion.{context}"
        
        # Get structured response from agent
        result = await agent.run(full_prompt)
        response = extract_response(result)
        
        if response and isinstance(response, ChatResponse):
            return SendMessageResponse(
                message=response.message,
                emotion=response.emotion,
                session_id=session.id
            )
        else:
            raise HTTPException(status_code=500, detail="Invalid response from agent")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

def cleanup_inactive_sessions(max_age_hours: int = 24):
    """Clean up inactive sessions"""
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    to_delete = []
    
    for session_id, session in sessions.items():
        if session.last_activity < cutoff:
            to_delete.append(session_id)
    
    for session_id in to_delete:
        del sessions[session_id]
    
    if to_delete:
        print(f"🧹 Cleaned up {len(to_delete)} inactive sessions")

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize the agent on startup"""
    if not initialize_agent():
        raise RuntimeError("Failed to initialize agent")

@app.post("/sessions", response_model=Dict[str, str])
async def create_session(session_id: Optional[str] = None):
    """Create a new chat session"""
    if not session_id:
        session_id = f"session_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    
    if session_id in sessions:
        raise HTTPException(status_code=400, detail="Session already exists")
    
    session = ChatSession(id=session_id)
    sessions[session_id] = session
    
    print(f"📝 Created new session: {session_id}")
    return {"session_id": session_id}

@app.get("/sessions/{session_id}", response_model=ChatSession)
async def get_session(session_id: str):
    """Get session information"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    session.last_activity = datetime.now()
    return session

@app.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(session_id: str, request: SendMessageRequest):
    """Send a message to the agent"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    session.last_activity = datetime.now()
    
    # Add user message to history
    user_message = ChatMessage(
        message=request.message,
        role="user",
        timestamp=datetime.now()
    )
    session.history.append(user_message)
    
    # Process with agent
    response = await process_message_with_agent(session, request.message)
    
    # Add assistant response to history
    assistant_message = ChatMessage(
        message=response.message,
        role="assistant",
        timestamp=datetime.now()
    )
    session.history.append(assistant_message)
    
    # Check if user mentioned remembering something
    if "remember" in request.message.lower() or "=" in request.message:
        # Extract potential facts (simple heuristic)
        if "=" in request.message:
            fact = request.message.strip()
            if fact not in session.important_facts:
                session.important_facts.append(fact)
                print(f"💾 Stored fact for session {session_id}: {fact}")
    
    # Update session
    sessions[session_id] = session
    
    return response

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del sessions[session_id]
    print(f"🗑️ Deleted session: {session_id}")
    return {"success": True}

@app.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    return {"sessions": list(sessions.keys())}

@app.post("/cleanup")
async def cleanup_sessions():
    """Manually trigger session cleanup"""
    cleanup_inactive_sessions()
    return {"message": "Cleanup completed"}

# WebSocket support for real-time chat
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, session_id)
    
    # Create session if it doesn't exist
    if session_id not in sessions:
        sessions[session_id] = ChatSession(id=session_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message":
                user_message = message_data.get("message", "")
                
                # Process with agent
                response = await process_message_with_agent(sessions[session_id], user_message)
                
                # Send response back to client
                await manager.send_personal_message(
                    json.dumps({
                        "type": "response",
                        "message": response.message,
                        "emotion": response.emotion,
                        "timestamp": datetime.now().isoformat()
                    }),
                    session_id
                )
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)

if __name__ == "__main__":
    # Run cleanup every hour
    import threading
    import time as time_module
    
    def cleanup_loop():
        while True:
            time_module.sleep(3600)  # 1 hour
            cleanup_inactive_sessions()
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    
    # Start the server
    uvicorn.run(app, host="0.0.0.0", port=8000) 