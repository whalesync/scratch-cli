from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

from pydantic_ai.messages import ModelMessage


class RequestAndResponseSummary(BaseModel):
    """Summary of request and response for agent context"""

    response_summary: str = Field(
        description="A concise summary of key actions, decisions, or context that would be useful for processing future prompts. Should be focused and contain anything the model finds useful for future reference, and does not need to be formated for human readability."
    )
    request_summary: str = Field(
        description="A concise summary of what the user requested, for future reference"
    )
    timestamp: datetime = Field(description="When this summary was created")


class ChatMessage(BaseModel):
    """Individual chat message"""

    message: str
    role: str  # "user" or "assistant"
    timestamp: datetime

    # Token usage (only for assistant messages)
    model: Optional[str] = Field(
        default=None, description="Model used for this message"
    )
    request_tokens: Optional[int] = Field(
        default=None, description="Tokens in the request"
    )
    response_tokens: Optional[int] = Field(
        default=None, description="Tokens in the response"
    )
    total_tokens: Optional[int] = Field(
        default=None, description="Total tokens for this message"
    )


class ChatSession(BaseModel):
    """Chat session with history and memory"""

    id: str
    name: str
    user_id: str
    chat_history: List[ChatMessage] = Field(
        default=[], description="Chat messages for user display (keep last 10)"
    )
    summary_history: List[RequestAndResponseSummary] = Field(
        default=[], description="Summaries for agent context (keep all)"
    )
    last_activity: datetime
    created_at: datetime
    workbook_id: str = Field(description="Associated workbook ID")
    message_history: List[ModelMessage] = Field(
        default=[], description="Message history for agent context (keep all)"
    )
