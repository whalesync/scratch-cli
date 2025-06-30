#!/usr/bin/env python3
"""
PydanticAI Agent for the Chat Server
"""

import os
import traceback
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol, List

from models import ChatResponse, ChatRunContext
from tools import get_records, connect_snapshot, create_records, delete_records, update_records
from logger import log_info, log_error



def extract_response(result):
    """Extract response from result object, trying different attributes"""
    # Try different possible response attributes
    for attr in ['output', 'response', 'data']:
        if hasattr(result, attr):
            response = getattr(result, attr)
            if response:
                return response
    return None

def create_agent():
    """Create and return a configured agent"""
    try:
        # OpenRouter API key from environment
        api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable not found")
        
        # Model name from environment
        model_name = os.getenv("MODEL_NAME", "openai/gpt-4o-mini")
        
        # Create the model using OpenRouter
        model = OpenAIModel(
            model_name,
            provider=OpenRouterProvider(api_key=api_key),
        )
        
        # Create the agent
        agent = Agent(
            name="ChatServerAgent",
            instructions="""You are a helpful AI assistant that can work with data from Scratchpad snapshots. 
Always be helpful and provide clear explanations of what you're doing.

When working with tables:
1. First use connect_snapshot_tool to connect to the snapshot (this provides table schema information)
2. Use get_records_tool to view existing data
3. Use create_records_tool to add new records with data you generate
4. Use update_records_tool to modify existing records
5. Use delete_records_tool to remove records by their IDs

For creating records, you should:
1. Connect to the snapshot first to get table schema information
2. Generate appropriate data for each column based on the schema
3. Call create_records_tool with the generated data

For updating records, you should:
1. First get the records to see which ones match the update criteria
2. Identify the record IDs (wsId) that should be updated
3. Generate the new data for each record
4. Call update_records_tool with a list of dictionaries, each containing 'wsId' and 'data' keys

For deleting records, you should:
1. First get the records to see which ones match the deletion criteria
2. Identify the record IDs (wsId) that should be deleted
3. Call delete_records_tool with the list of record IDs to delete""",
            output_type=ChatResponse,
            model=model,
            deps_type=ChatRunContext
        )
        
        # Add tools using @agent.tool decorator
        @agent.tool
        async def connect_snapshot_tool(ctx: RunContext[ChatRunContext]) -> str:  # type: ignore
            """
            Connect to the snapshot associated with the current session.
            
            Use this tool when the user wants to work with data from the snapshot associated with their session.
            The snapshot ID is automatically determined from the session.
            This will provide you with table schema information including column names and types.
            """
            return await connect_snapshot(ctx)  # type: ignore
        
        @agent.tool
        async def get_records_tool(ctx: RunContext[ChatRunContext], table_name: str, limit: int = 100) -> str:  # type: ignore
            """
            Get all records for a table from the active snapshot.
            
            Use this tool when the user asks to see data from a table or wants to view records.
            The table_name should be the name of the table you want to get records from.
            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await get_records(ctx, table_name, limit)  # type: ignore
        
        @agent.tool
        async def create_records_tool(ctx: RunContext[ChatRunContext], table_name: str, record_data_list: List[Dict[str, Any]]) -> str:  # type: ignore
            """
            Create new records for a table in the active snapshot using data provided by the LLM.
            
            Use this tool when the user asks to create new records or add data to a table.
            The table_name should be the name of the table you want to create records for.
            The record_data_list should be a list of dictionaries, where each dictionary contains
            field names as keys and appropriate values based on the column types.
            
            You must connect to a snapshot first using connect_snapshot_tool to get table schema information.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await create_records(ctx, table_name, record_data_list)  # type: ignore
        
        @agent.tool
        async def update_records_tool(ctx: RunContext[ChatRunContext], table_name: str, record_updates: List[Dict[str, Any]]) -> str:  # type: ignore
            """
            Update existing records in a table in the active snapshot.
            
            Use this tool when the user asks to modify or edit existing records in a table.
            The table_name should be the name of the table you want to update records in.
            The record_updates should be a list of dictionaries, where each dictionary contains:
            - 'wsId': the record ID to update
            - 'data': a dictionary of field names and new values to set
            
            Example: [{'wsId': 'record_id_1', 'data': {'status': 'active', 'priority': 'high'}}]
            
            You should first use get_records_tool to see the current records and identify which ones to update
            based on the user's criteria. Then create the update data for each matching record.
            
            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await update_records(ctx, table_name, record_updates)  # type: ignore
        
        @agent.tool
        async def delete_records_tool(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str]) -> str:  # type: ignore
            """
            Delete records from a table in the active snapshot by their IDs.
            
            Use this tool when the user asks to delete records from a table.
            The table_name should be the name of the table you want to delete records from.
            The record_ids should be a list of record IDs (wsId) to delete.
            
            You should first use get_records_tool to see the current records and identify which ones to delete
            based on the user's criteria. Then extract the wsId values from the matching records.
            
            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await delete_records(ctx, table_name, record_ids)  # type: ignore
        
        print(f"✅ Agent created successfully with model: {model_name}")
        print(f"🔧 Agent has tools: connect_snapshot_tool, get_records_tool, create_records_tool, update_records_tool, delete_records_tool")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        raise e
