#!/usr/bin/env python3
"""
Data models for the file agent
"""

from typing import List, Optional

from pydantic import BaseModel, Field
from session import ChatSession


class FileAgentUsageStats(BaseModel):
    """Usage stats for the agent"""

    requests: int = Field(description="The number of requests made to the agent")
    request_tokens: int = Field(description="The number of tokens in the requests")
    response_tokens: int = Field(description="The number of tokens in the responses")
    total_tokens: int = Field(
        description="The total number of tokens in the requests and responses"
    )


class FileAgentResponse(BaseModel):
    """Response from the file agent"""

    response_message: str = Field(
        description="The agent's response message - should be well-formatted and human-readable"
    )
    response_summary: str = Field(
        description="A concise summary of key actions or findings for future reference"
    )
    request_summary: str = Field(
        description="A concise summary of what the user requested"
    )
    usage_stats: Optional[FileAgentUsageStats] = Field(
        default=None, description="Usage stats for the agent"
    )


class FileAgentRunContext(BaseModel):
    """Runtime context for the file agent.

    The workbook_id is accessed via session.workbook_id to maintain
    compatibility with the existing ChatSession model.
    """

    run_id: str = Field(description="ID of the chat run")
    session: ChatSession = Field(description="Chat session containing workbook_id")
    user_id: str = Field(description="ID of the user")
    active_folder_path: Optional[str] = Field(
        default="/", description="Current working directory path"
    )
    active_file_path: Optional[str] = Field(
        default=None, description="Currently selected file path"
    )
    open_file_paths: Optional[List[str]] = Field(
        default=None, description="List of currently open file paths"
    )
