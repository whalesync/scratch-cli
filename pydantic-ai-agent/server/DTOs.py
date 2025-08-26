from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from session import ChatSession
from agents.data_agent.models import ChatSession, FocusedCell


class Capability(BaseModel):
    """Capability with code, enabledByDefault flag, and description"""

    code: str = Field(description="The capability code")
    enabledByDefault: bool = Field(
        description="Whether this capability is enabled by default"
    )
    description: str = Field(
        description="One-sentence description of what this capability does"
    )


class Guideline(BaseModel):
    """Guideline with name and content for overriding system prompt sections"""

    name: str = Field(
        description="The name of the system prompt section to override (e.g., 'BASE_INSTRUCTIONS')"
    )
    content: str = Field(
        description="The content to use instead of the default section"
    )


class CancelMessageRequestDTO(BaseModel):
    """Request to cancel a message"""

    run_id: str = Field(description="ID of the run to cancel")


class SendMessageRequestDTO(BaseModel):
    """Request to send a message"""

    message: str
    agent_jwt: Optional[str] = Field(
        default=None, description="Agent JWT token for authentication"
    )
    api_token: Optional[str] = Field(
        default=None,
        description="DEPRECATED:API token for Scratchpad server authentication",
    )
    style_guides: Optional[List[Guideline]] = Field(
        default=None,
        description="List of style guides with name and content to override system prompt sections",
    )
    capabilities: Optional[List[str]] = Field(
        default=None, description="List of selected capabilities for this message"
    )
    model: Optional[str] = Field(
        default="openai/gpt-4o-mini", description="Model to use for AI generation"
    )
    view_id: Optional[str] = Field(
        default=None, description="ID of the currently selected view"
    )
    read_focus: Optional[List[FocusedCell]] = Field(
        default=None, description="List of read-focused cells"
    )
    write_focus: Optional[List[FocusedCell]] = Field(
        default=None, description="List of write-focused cells"
    )
    active_table_id: Optional[str] = Field(
        default=None, description="ID of the currently active table"
    )
    data_scope: Optional[str] = Field(
        default="table", description="Data scope for the message"
    )
    record_id: Optional[str] = Field(
        default=None, description="ID of the record to scope the data to"
    )
    column_id: Optional[str] = Field(
        default=None, description="ID of the column to scope the data to"
    )


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
    snapshot_id: Optional[str] = Field(
        default=None, description="Associated snapshot ID"
    )


class CreateSessionResponseDTO(BaseModel):
    """Response from creating a session"""

    session: ChatSessionSummary
    available_capabilities: List[Capability] = Field(
        description="List of available capabilities for this session"
    )


class SessionListResponseDTO(BaseModel):
    """Response containing list of sessions"""

    sessions: List[ChatSessionSummary]


class SessionResponse(BaseModel):
    """Response containing a single session"""

    session: ChatSession
