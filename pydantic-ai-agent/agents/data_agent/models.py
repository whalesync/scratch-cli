#!/usr/bin/env python3
"""
Data models for the chat server
"""

from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from scratchpad.entities import ColumnSpec, SnapshotRecord, RecordId, TableSpec
from typing import List, Optional, Dict, Any
from session import ChatSession
from agents.data_agent.data_agent_utils import SnapshotForAi


class UsageStats(BaseModel):
    """Usage stats for the agent"""

    requests: int = Field(description="The number of requests made to the agent")
    request_tokens: int = Field(description="The number of tokens in the requests")
    response_tokens: int = Field(description="The number of tokens in the responses")
    total_tokens: int = Field(
        description="The total number of tokens in the requests and responses"
    )


class ResponseFromAgent(BaseModel):
    """Simple chat response model"""

    response_message: str = Field(
        description="The agent's response message - should be well-formatted, human-readable with careful and full explanations of what the model did or thinks"
    )
    response_summary: str = Field(
        description="A concise summary of key actions, decisions, or context that would be useful for processing future prompts. Should be focused and contain anything the model finds useful for future reference, and does not need to be formated for human readability."
    )
    request_summary: str = Field(
        description="A concise summary of what the user requested, for future reference"
    )
    usage_stats: Optional[UsageStats] = Field(description="Usage stats for the agent")


class ChatRunContext(BaseModel):
    run_id: str = Field(description="ID of the chat run")
    session: ChatSession
    user_id: str
    snapshot: Optional[SnapshotForAi] = Field(
        default=None, description="Associated snapshot"
    )
    view_id: Optional[str] = Field(
        default=None, description="ID of the currently selected view"
    )
    preloaded_records: Optional[Dict[str, Any]] = Field(
        default=None, description="Preloaded records for the session"
    )
    active_table_id: Optional[str] = Field(
        default=None, description="ID of the table that has active focus in the context"
    )
    data_scope: Optional[str] = Field(
        default=None, description="Data scope for the message"
    )
    record_id: Optional[str] = Field(
        default=None, description="ID of the record to scope the data to"
    )
    column_id: Optional[str] = Field(
        default=None, description="ID of the column to scope the data to"
    )
    mentioned_table_ids: Optional[List[str]] = Field(
        default=None, description="IDs of tables mentioned in the user message"
    )


class WithTableName(BaseModel):
    """Input for the update_records tool"""

    table_name: str = Field(description="The name of the table")


common_field_descriptions = {
    "table_name": "The name of the table",
    "record_updates": "List of record updates, each containing 'wsId' and 'data' keys",
    "wsId": "The ID of the record to update",
    "data": "Field names and their new values",
    "field": "The name of a field in a table",
}
