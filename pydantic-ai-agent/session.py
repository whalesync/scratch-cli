
from pydantic import BaseModel, Field
from datetime import datetime
from scratchpad_api import ScratchpadSnapshot
from typing import List, Optional


class RequestAndResponseSummary(BaseModel):
    """Summary of request and response for agent context"""
    response_summary: str = Field(description="A concise summary of key actions, decisions, or context that would be useful for processing future prompts. Should be focused and contain anything the model finds useful for future reference, and does not need to be formated for human readability.")
    request_summary: str = Field(description="A concise summary of what the user requested, for future reference")

class ChatMessage(BaseModel):
    """Individual chat message"""
    message: str
    role: str  # "user" or "assistant"
    timestamp: datetime


class ChatSession(BaseModel):
    """Chat session with history and memory"""
    id: str
    name: str
    chat_history: List[ChatMessage] = Field(default=[], description="Chat messages for user display (keep last 10)")
    summary_history: List[RequestAndResponseSummary] = Field(default=[], description="Summaries for agent context (keep all)")
    last_activity: datetime
    created_at: datetime
    snapshot_id: str = Field(description="Associated snapshot ID")
    message_history: List[ChatMessage] = Field(default=[], description="Message history for agent context (keep all)")
    
