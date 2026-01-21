from datetime import datetime
from typing import List, Optional

from agents.data_agent.models import ChatSession
from pydantic import BaseModel, Field
from session import ChatSession


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


class StopAgentMessageRequestDTO(BaseModel):
    """Request to stop an agent task"""

    task_id: str = Field(description="ID of the agent task to stop")
    hard_kill: bool = Field(
        description="Whether to hard kill the agent task", default=False
    )


class SendMessageRequestDTO(BaseModel):
    """Request to send a message"""

    message: str
    agent_jwt: Optional[str] = Field(
        default=None, description="Agent JWT token for authentication"
    )
    api_token: Optional[str] = Field(
        default=None,
        description="DEPRECATED:API token for Scratch server authentication",
    )
    credential_id: Optional[str] = Field(
        default=None, description="ID of the credentials to use for the agent"
    )
    prompt_assets: Optional[List[Guideline]] = Field(
        default=None,
        description="List of prompt assets with name and content to override system prompt sections",
    )
    capabilities: List[str] = Field(
        default=None, description="List of selected capabilities for this message"
    )
    model: Optional[str] = Field(
        default="anthropic/claude-haiku-4.5",
        description="Model to use for AI generation",
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
    max_records_in_prompt: Optional[int] = Field(
        default=50,
        description="Maximum number of records to include in the snapshot context prompt",
    )
    mentioned_table_ids: Optional[List[str]] = Field(
        default=None,
        description="IDs of tables mentioned in the user message",
    )
    model_context_length: Optional[int] = Field(
        default=None,
        description="Maximum context length (tokens) supported by the model",
    )


class SendMessageResponseDTO(BaseModel):
    """Response from sending a message"""

    response_message: str
    response_summary: str
    request_summary: str


class FileAgentSendMessageRequestDTO(BaseModel):
    """Request to send a message to the file agent"""

    message: str
    agent_jwt: Optional[str] = Field(
        default=None, description="Agent JWT token for authentication"
    )
    credential_id: Optional[str] = Field(
        default=None, description="ID of the credentials to use for the agent"
    )
    model: Optional[str] = Field(
        default="anthropic/claude-haiku-4.5",
        description="Model to use for AI generation",
    )
    model_context_length: Optional[int] = Field(
        default=None,
        description="Maximum context length (tokens) supported by the model",
    )
    active_folder_path: Optional[str] = Field(
        default="/", description="Current working directory path"
    )
    active_file_path: Optional[str] = Field(
        default=None, description="Currently selected file path"
    )


class ChatSessionSummary(BaseModel):
    """Chat session summary for client responses"""

    id: str
    name: str
    last_activity: datetime
    created_at: datetime


class CreateSessionRequestDTO(BaseModel):
    """Request to create a new session"""

    name: str
    workbook_id: Optional[str] = Field(
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
