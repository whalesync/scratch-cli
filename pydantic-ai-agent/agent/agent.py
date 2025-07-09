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

from agent.models import ResponseFromAgent, ChatRunContext
from agent.tools import clear_table_view, get_records, connect_snapshot, create_records, delete_records, list_table_views, update_records, activate_table_view
from logger import log_info, log_error



def extract_response(result) -> ResponseFromAgent | None:
    """Extract response from result object, trying different attributes"""
    # Try different possible response attributes
    for attr in ['output', 'response', 'data']:
        if hasattr(result, attr):
            response = getattr(result, attr)
            if response:
                return response  # type: ignore
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

IMPORTANT: Your response should have three parts:
1. responseMessage: A well-formatted, human-readable response with careful and full explanations of what you did or think
2. responseSummary: A concise summary of key actions, decisions, or context that would be useful for processing future prompts. This should be focused and contain anything you find useful for future reference, but doesn't need to be user-readable or well-formatted.
3. requestSummary: A concise summary of what the user requested, for future reference.

When working with tables:
1. First use connect_snapshot_tool to connect to the snapshot (this provides table schema information)
2. Use get_records_tool to view existing data
3. Use create_records_tool to add new records with data you generate
4. Use update_records_tool to modify existing records
5. Use delete_records_tool to remove records by their IDs
6. Use activate_table_view_tool to create a filtered view for a table with subset of records for use in the context. 
7. Use list_table_views_tool to list all the views for a table
8. Use clear_table_view_tool to clear the active view for a table

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
3. Call delete_records_tool with the list of record IDs to delete

For creating filtered views, you should:
1. First get all the records in the table
2. Filter the records based on the user's criteria
3. Extract the wsId values from the matching records to use as the record_ids
4. Call activate_table_view_tool with the list of record IDs to create the view

For clearing active views or reverting to the default view, you should:
1. Call clear_table_view_tool to clear the active view for the table

For listing existing filtered views on a table, you should:
1. Call list_table_views_tool to list all the views for the table""",
            output_type=ResponseFromAgent,
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
        async def get_records_tool(ctx: RunContext[ChatRunContext], table_name: str, limit: int = 100, view_id: Optional[str] = None) -> str:  # type: ignore
            """
            Get all records for a table from the active snapshot.
            
            Use this tool when the user asks to see data from a table or wants to view records.
            The table_name should be the name of the table you want to get records from.
            If there is an active filtered view for the table, you can use the view_id to get records from the filtered view.
            If no view_id is provided, all records from the table will be returned.

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


        @agent.tool
        async def activate_table_view_tool(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str], name: str) -> str:  # type: ignore
            """
            Create a filtered view for a table with subset of records for use in the context. 
            
            Use this tool when the user asks to filter records for a table or work with a subset of records.
            The table_name should be the name of the table you want to create a filtered view for.
            The record_ids should be a list of record IDs (wsId) include in the view.
            
            You should first use get_records_tool to see all the records in the table and filter them based on the user's criteria.
            Then extract the wsId values from the matching records to use as the record_ids.

            Do not use use this tool if there are no records to filter.      

            The name should be a short name for the view to help you identify it. Less than 50 characters.
            
            After the view is created, you should use the view ID when getting records with the get_records_tool.

            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await activate_table_view(ctx, table_name, record_ids, name)  # type: ignore
        
        @agent.tool
        async def clear_table_view_tool(ctx: RunContext[ChatRunContext], table_name: str) -> str:  # type: ignore
            """
            Clear the active view for a table in the active snapshot and get all records from the table.
            
            Use this tool when the user asks to clear the active view for a table or revert to the default view.
            The table_name should be the name of the table you want to clear the active view for.

            Do not use use this tool if there is no active view for the table configured in the snapshot.

            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await clear_table_view(ctx, table_name)  # type: ignore

        @agent.tool
        async def list_table_views_tool(ctx: RunContext[ChatRunContext], table_name: str) -> str:  # type: ignore
            """
            List all saved filteredviews for a specific table in the current snapshot.
            
            Use this tool when the user asks to list all the views for a table.
            The table_name should be the name of the table you want to list views for.

            You must connect to a snapshot first using connect_snapshot_tool.
            However if snapshot data has already been connected, you can skip this step.
            """
            return await list_table_views(ctx, table_name)  # type: ignore

        print(f"✅ Agent created successfully with model: {model_name}")
        print(f"🔧 Agent has tools: connect_snapshot_tool, get_records_tool, create_records_tool, update_records_tool, delete_records_tool")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        raise e
