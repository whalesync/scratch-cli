#!/usr/bin/env python3
"""
Models for the Connector Builder Agent
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime


class ConnectorBuilderRunContext(BaseModel):
    """Context for the connector builder agent"""

    custom_connector_id: str = Field(
        description="The ID of the custom connector to work with"
    )
    api_token: Optional[str] = Field(
        default=None, description="API token for Scratchpaper server authentication"
    )
    custom_connector: Optional[Dict[str, Any]] = Field(
        default=None, description="The loaded custom connector data"
    )


class ResponseFromConnectorBuilderAgent(BaseModel):
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
        default=None, description="The type of function generated (e.g., 'listTables')"
    )


class ExecuteListTablesRequest(BaseModel):
    """Request to execute a listTables function"""

    function_string: str = Field(description="The JavaScript function to execute")
    api_key: str = Field(description="The API key to use for the request")


class SaveCustomConnectorRequest(BaseModel):
    """Request to save a custom connector with updated function"""

    custom_connector_id: str = Field(
        description="The ID of the custom connector to update"
    )
    function_type: str = Field(
        description="The type of function to save (e.g., 'listTables')"
    )
    function_code: str = Field(description="The JavaScript function code to save")


class SaveCustomConnectorWithTestResultRequest(BaseModel):
    """Request to save a custom connector with updated function and test result"""

    custom_connector_id: str = Field(
        description="The ID of the custom connector to update"
    )
    function_type: str = Field(
        description="The type of function to save (e.g., 'listTables')"
    )
    function_code: str = Field(description="The JavaScript function code to save")
    test_result: Any = Field(description="The test result to save (if applicable)")
