#!/usr/bin/env python3
"""
DTOs for the Connector Builder Server
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ConnectorBuilderRequestDTO(BaseModel):
    """Request to the connector builder agent"""

    message: str = Field(description="The user's message/request")
    custom_connector_id: str = Field(
        description="The ID of the custom connector to work with"
    )
    api_token: Optional[str] = Field(
        default=None, description="API token for Scratch server authentication"
    )
    style_guides: Optional[List[Dict[str, str]]] = Field(
        default=None, description="List of style guides"
    )
    capabilities: Optional[List[str]] = Field(
        default=None, description="List of selected capabilities"
    )
    model: Optional[str] = Field(
        default="openai/gpt-4o-mini", description="Model to use for AI generation"
    )


class ConnectorBuilderSessionMessageRequestDTO(BaseModel):
    """Request to send a message to a connector builder session"""

    message: str = Field(description="The user's message/request")
    api_token: Optional[str] = Field(
        default=None, description="API token for Scratch server authentication"
    )
    style_guides: Optional[List[Dict[str, str]]] = Field(
        default=None, description="List of style guides"
    )
    capabilities: Optional[List[str]] = Field(
        default=None, description="List of selected capabilities"
    )
    model: Optional[str] = Field(
        default="openai/gpt-4o-mini", description="Model to use for AI generation"
    )


class ConnectorBuilderResponseDTO(BaseModel):
    """Response from the connector builder agent"""

    response_message: str = Field(
        description="The response message to show to the user"
    )
    response_summary: str = Field(description="A brief summary of what the agent did")
    request_summary: str = Field(
        description="A brief summary of what the user requested"
    )
    generated_function: Optional[str] = Field(
        default=None, description="The generated function code if applicable"
    )
    function_type: Optional[str] = Field(
        default=None, description="The type of function generated"
    )


class ConnectorBuilderSessionDTO(BaseModel):
    """Connector builder session information"""

    id: str = Field(description="Session ID")
    name: str = Field(description="Session name")
    custom_connector_id: str = Field(
        description="The custom connector ID this session is associated with"
    )
    chat_history: List[Dict[str, Any]] = Field(
        description="Chat history for this session"
    )
    created_at: str = Field(description="Session creation timestamp")
    last_activity: str = Field(description="Last activity timestamp")


class ConnectorBuilderSessionSummaryDTO(BaseModel):
    """Connector builder session summary for listing"""

    id: str = Field(description="Session ID")
    name: str = Field(description="Session name")
    created_at: str = Field(description="Session creation timestamp")
    last_activity: str = Field(description="Last activity timestamp")


class ConnectorBuilderCapabilityDTO(BaseModel):
    """Capability information"""

    code: str = Field(description="Capability code")
    enabledByDefault: bool = Field(
        description="Whether this capability is enabled by default"
    )
    description: str = Field(description="Capability description")


class CreateConnectorBuilderSessionResponseDTO(BaseModel):
    """Response when creating a new connector builder session"""

    session: ConnectorBuilderSessionSummaryDTO = Field(
        description="Session information"
    )
    available_capabilities: List[ConnectorBuilderCapabilityDTO] = Field(
        description="Available capabilities for this session"
    )
