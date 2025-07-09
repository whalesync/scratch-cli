from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from session import ChatSession


class SendMessageRequestDTO(BaseModel):
    """Request to send a message"""
    message: str
    api_token: str = Field(description="API token for Scratchpad server authentication")
    style_guides: Optional[List[str]] = Field(default=None, description="List of style guide content to include in the prompt")

class SendMessageResponseDTO(BaseModel):
    """Response from sending a message"""
    response_message: str
    response_summary: str
    request_summary: str


class ChatSessionSummary(BaseModel):
    """Chat session summary for client responses"""
    id: str
    name: str
    last_activity: datetime
    created_at: datetime


class CreateSessionRequestDTO(BaseModel):
    """Request to create a new session"""
    name: str
    snapshot_id: Optional[str] = Field(default=None, description="Associated snapshot ID")

class CreateSessionResponseDTO(BaseModel):
    """Response from creating a session"""
    session: ChatSessionSummary

class SessionListResponseDTO(BaseModel):
    """Response containing list of sessions"""
    sessions: List[ChatSessionSummary]



class SessionResponse(BaseModel):
    """Response containing a single session"""
    session: ChatSession 


