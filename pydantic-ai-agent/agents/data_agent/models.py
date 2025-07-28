#!/usr/bin/env python3
"""
Data models for the chat server
"""

from pydantic import BaseModel, Field
from datetime import datetime
from scratchpad_api import ScratchpadSnapshot
from typing import List, Optional, Dict, Any
from session import ChatSession
from agents.data_agent.data_agent_utils import SnapshotForAi


class FocusedCell(BaseModel):
    """A focused cell in the grid"""
    recordWsId: str = Field(description="Record ID of the focused cell")
    columnWsId: str = Field(description="Column ID of the focused cell")


class ResponseFromAgent(BaseModel):
    """Simple chat response model"""
    response_message: str = Field(description="The agent's response message - should be well-formatted, human-readable with careful and full explanations of what the model did or thinks")
    response_summary: str = Field(description="A concise summary of key actions, decisions, or context that would be useful for processing future prompts. Should be focused and contain anything the model finds useful for future reference, and does not need to be formated for human readability.")
    request_summary: str = Field(description="A concise summary of what the user requested, for future reference")


class ChatRunContext(BaseModel):
    session: ChatSession
    api_token: str
    snapshot: Optional[SnapshotForAi] = Field(default=None, description="Associated snapshot")
    view_id: Optional[str] = Field(default=None, description="ID of the currently selected view")
    preloaded_records: Optional[Dict[str, Any]] = Field(default=None, description="Preloaded records for the session")
    read_focus: Optional[List[FocusedCell]] = Field(default=None, description="List of read-focused cells")
    write_focus: Optional[List[FocusedCell]] = Field(default=None, description="List of write-focused cells")


class WithTableName(BaseModel):
    """Input for the update_records tool"""
    table_name: str = Field(description="The name of the table")

common_field_descriptions = {
    "table_name": "The name of the table",
    "record_updates": "List of record updates, each containing 'wsId' and 'data' keys",
    "wsId": "The ID of the record to update",
    "data": "Field names and their new values"
}