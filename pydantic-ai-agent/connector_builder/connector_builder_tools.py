#!/usr/bin/env python3
"""
Tools for the Connector Builder Agent
"""

import json
import requests
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from pydantic_ai import RunContext

from .connector_builder_utils import load_custom_connector, call_scratchpad_api
from .models import ConnectorBuilderRunContext


class ExecuteListTablesRequest(BaseModel):
    """Request to execute a listTables function"""
    function_string: str = Field(description="The JavaScript function to execute")
    api_key: str = Field(description="The API key to use for the request")


class SaveCustomConnectorRequest(BaseModel):
    """Request to save a custom connector with updated function"""
    custom_connector_id: str = Field(description="The ID of the custom connector to update")
    function_type: str = Field(description="The type of function to save (e.g., 'listTables')")
    function_code: str = Field(description="The JavaScript function code to save")


class SaveCustomConnectorWithTestResultRequest(BaseModel):
    """Request to save a custom connector with updated function and test result"""
    custom_connector_id: str = Field(description="The ID of the custom connector to update")
    function_type: str = Field(description="The type of function to save (e.g., 'listTables')")
    function_code: str = Field(description="The JavaScript function code to save")
    test_result: Any = Field(description="The test result to save (if applicable)")


def define_connector_builder_tools(agent, capabilities: Optional[list] = None):
    """Define tools for the connector builder agent"""
    
    @agent.tool
    async def execute_list_tables_tool(context: RunContext[ConnectorBuilderRunContext], request: ExecuteListTablesRequest) -> str:
        """
        Execute a listTables function to test if it works correctly.
        
        This tool calls the Scratchpad server's execute-list-tables endpoint to test
        the generated function with the provided API key.
        """
        try:
            # Get API token from context
            api_token = context.deps.api_token
            
            # Call the Scratchpad server's execute-list-tables endpoint
            response = call_scratchpad_api(
                "POST",
                "/rest/custom-connector-builder/execute-list-tables",
                {
                    "functionString": request.function_string,
                    "apiKey": request.api_key
                },
                api_token=api_token
            )
            
            # Format the response for display
            if isinstance(response, dict):
                return f"✅ Function executed successfully!\n\nResponse: {json.dumps(response, indent=2)}"
            else:
                return f"✅ Function executed successfully!\n\nResponse: {str(response)}"
                
        except Exception as e:
            return f"❌ Function execution failed: {str(e)}"
    
    @agent.tool
    async def save_custom_connector_tool(context: RunContext[ConnectorBuilderRunContext], request: SaveCustomConnectorRequest) -> str:
        """
        Save a generated function to the custom connector.
        
        This tool updates the custom connector with the new function code.
        """
        try:
            # Get API token from context
            api_token = context.deps.api_token
            
            # First, get the current custom connector data
            current_connector = load_custom_connector(request.custom_connector_id, api_token)
            
            # Prepare the update data
            update_data = {
                "name": current_connector.get("name", ""),
                "prompt": current_connector.get("prompt"),
                "apiKey": current_connector.get("apiKey"),
                "pollRecords": current_connector.get("pollRecords"),
                "fetchSchema": current_connector.get("fetchSchema"),
                "schema": current_connector.get("schema"),
                "tables": current_connector.get("tables", []),
                "getRecord": current_connector.get("getRecord"),
                "deleteRecord": current_connector.get("deleteRecord"),
                "createRecord": current_connector.get("createRecord"),
                "updateRecord": current_connector.get("updateRecord"),
                "pollRecordsResponse": current_connector.get("pollRecordsResponse"),
                "getRecordResponse": current_connector.get("getRecordResponse"),
            }
            
            # Add the new function based on function type
            if request.function_type == "listTables":
                update_data["listTables"] = request.function_code
            elif request.function_type == "fetchSchema":
                update_data["fetchSchema"] = request.function_code
            elif request.function_type == "pollRecords":
                update_data["pollRecords"] = request.function_code
            elif request.function_type == "createRecord":
                update_data["createRecord"] = request.function_code
            elif request.function_type == "updateRecord":
                update_data["updateRecord"] = request.function_code
            elif request.function_type == "deleteRecord":
                update_data["deleteRecord"] = request.function_code
            elif request.function_type == "getRecord":
                update_data["getRecord"] = request.function_code
            
            # Call the Scratchpad server's update endpoint
            response = call_scratchpad_api(
                "PUT",
                f"/custom-connectors/{request.custom_connector_id}",
                update_data,
                api_token=api_token
            )
            
            return f"✅ Successfully saved {request.function_type} function to custom connector '{current_connector.get('name', 'Unknown')}'"
                
        except Exception as e:
            return f"❌ Failed to save function: {str(e)}"
    
    @agent.tool
    async def save_custom_connector_with_test_result_tool(context: RunContext[ConnectorBuilderRunContext], request: SaveCustomConnectorWithTestResultRequest) -> str:
        """
        Save a generated function and its test result to the custom connector.
        
        This tool updates the custom connector with the new function code and test result.
        """
        try:
            # Get API token from context
            api_token = context.deps.api_token
            
            # First, get the current custom connector data
            current_connector = context.deps.custom_connector
            
            # Prepare the update data
            update_data = {
                "name": current_connector.get("name", ""),
                "prompt": current_connector.get("prompt"),
                "apiKey": current_connector.get("apiKey"),
                "pollRecords": current_connector.get("pollRecords"),
                "fetchSchema": current_connector.get("fetchSchema"),
                "schema": current_connector.get("schema"),
                "tables": current_connector.get("tables", []),
                "getRecord": current_connector.get("getRecord"),
                "deleteRecord": current_connector.get("deleteRecord"),
                "createRecord": current_connector.get("createRecord"),
                "updateRecord": current_connector.get("updateRecord"),
                "pollRecordsResponse": current_connector.get("pollRecordsResponse"),
                "getRecordResponse": current_connector.get("getRecordResponse"),
            }
            
            # Add the new function based on function type
            if request.function_type == "listTables":
                update_data["listTables"] = request.function_code
                if request.test_result:
                    update_data["tables"] = request.test_result
            elif request.function_type == "fetchSchema":
                update_data["fetchSchema"] = request.function_code
                if request.test_result:
                    update_data["schema"] = request.test_result
            elif request.function_type == "pollRecords":
                update_data["pollRecords"] = request.function_code
                if request.test_result:
                    update_data["pollRecordsResponse"] = request.test_result
            elif request.function_type == "getRecord":
                update_data["getRecord"] = request.function_code
                if request.test_result:
                    update_data["getRecordResponse"] = request.test_result
            elif request.function_type == "createRecord":
                update_data["createRecord"] = request.function_code
            elif request.function_type == "updateRecord":
                update_data["updateRecord"] = request.function_code
            elif request.function_type == "deleteRecord":
                update_data["deleteRecord"] = request.function_code
            
            # Call the Scratchpad server's update endpoint
            response = call_scratchpad_api(
                "PUT",
                f"/custom-connectors/{request.custom_connector_id}",
                update_data,
                api_token=api_token
            )
            
            if request.test_result:
                return f"✅ Successfully saved {request.function_type} function and test result to custom connector '{current_connector.get('name', 'Unknown')}'"
            else:
                return f"✅ Successfully saved {request.function_type} function to custom connector '{current_connector.get('name', 'Unknown')}'"
                
        except Exception as e:
            return f"❌ Failed to save function and test result: {str(e)}"
    
    print(f"🔧 Connector builder agent has tools: execute_list_tables_tool, save_custom_connector_tool, save_custom_connector_with_test_result_tool") 