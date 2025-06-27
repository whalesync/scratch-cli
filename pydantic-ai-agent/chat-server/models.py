#!/usr/bin/env python3
"""
Data models for the chat server
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class ChatResponse(BaseModel):
    """Simple chat response model"""
    message: str = Field(description="The agent's response message")
    emotion: str = Field(description="The emotion conveyed (happy, sad, excited, etc.)")

class ChatMessage(BaseModel):
    """Individual chat message"""
    message: str
    role: str  # "user" or "assistant"
    timestamp: datetime

class ChatSession(BaseModel):
    """Chat session with history and memory"""
    id: str
    name: str
    history: List[ChatMessage] = []
    important_facts: List[str] = []
    last_activity: datetime
    created_at: datetime
    snapshot_id: Optional[str] = Field(default=None, description="Associated snapshot ID")

class SendMessageRequest(BaseModel):
    """Request to send a message"""
    message: str
    api_token: Optional[str] = Field(default=None, description="API token for Scratchpad server authentication")

class SendMessageResponse(BaseModel):
    """Response from sending a message"""
    message: str
    emotion: str
    session_id: str

class CreateSessionRequest(BaseModel):
    """Request to create a new session"""
    name: str
    snapshot_id: Optional[str] = Field(default=None, description="Associated snapshot ID")

class CreateSessionResponse(BaseModel):
    """Response from creating a session"""
    session_id: str
    name: str

class SessionListResponse(BaseModel):
    """Response containing list of sessions"""
    sessions: List[ChatSession]

class SessionResponse(BaseModel):
    """Response containing a single session"""
    session: ChatSession 