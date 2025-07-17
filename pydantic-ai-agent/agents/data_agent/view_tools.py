#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent


from typing import List
from pydantic_ai import Agent, RunContext
from scratchpad_api import API_CONFIG
from logger import log_error


def define_view_tools(agent: Agent[ChatRunContext, ResponseFromAgent]):

    # @agent.tool
    # async def activate_table_view_tool(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str], name: str) -> str:  # type: ignore
    #     """
    #     Create a filtered view for a table with subset of records for use in the context. 
        
    #     Use this tool when the user asks to filter records for a table or work with a subset of records.
    #     The table_name should be the name of the table you want to create a filtered view for.
    #     The record_ids should be a list of record IDs (wsId) include in the view.
        
    #     You should first use get_records_tool to see all the records in the table and filter them based on the user's criteria.
    #     Then extract the wsId values from the matching records to use as the record_ids.

    #     Do not use use this tool if there are no records to filter.      

    #     The name should be a short name for the view to help you identify it. Less than 50 characters.
        
    #     After the view is created, you should use the view ID when getting records with the get_records_tool.

    #     You must connect to a snapshot first using connect_snapshot_tool.
    #     However if snapshot data has already been connected, you can skip this step.
    #     """
    #     try:
    #         # Get the active snapshot
    #         chatRunContext: ChatRunContext = ctx.deps 
    #         chatSession: ChatSession = chatRunContext.session
            
    #         if not chatRunContext.snapshot:
    #             return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
    #         # Find the table by name
    #         table = None
    #         for t in chatRunContext.snapshot.tables:
    #             if t.name.lower() == table_name.lower():
    #                 table = t
    #                 break
            
    #         if not table:
    #             available_tables = [t.name for t in chatRunContext.snapshot.tables]
    #             return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
            
    #         # Set the API token for authentication
    #         # API_CONFIG.set_api_token(chatRunContext.api_token)
            
    #         # Import the CreateSnapshotTableViewDto class
    #         from scratchpad_api import CreateSnapshotTableViewDto, activate_view
            
    #         # Validate that record_ids is provided
    #         if not record_ids:
    #             return "Error: No record IDs provided. Please provide a list of record IDs to include in the view."
            
    #         # Create the DTO
    #         dto = CreateSnapshotTableViewDto(
    #             source="agent",
    #             name=name,
    #             recordIds=record_ids
    #         )
            
    #         # Call the activate_view API
    #         view_id = activate_view(
    #             chatRunContext.session.snapshot_id,
    #             table.id.wsId,
    #             dto,
    #             chatRunContext.api_token
    #         )
            
    #         return f"Successfully activated view '{name}' (ID: {view_id}) for table '{table_name}' with {len(record_ids)} records."
            
    #     except Exception as e:
    #         error_msg = f"Failed to activate view for table '{table_name}': {str(e)}"
    #         log_error("Error activating view", 
    #                 table_name=table_name,
    #                 error=str(e))
    #         print(f"❌ {error_msg}")
    #         return error_msg
    
    # @agent.tool
    # async def clear_table_view_tool(ctx: RunContext[ChatRunContext], table_name: str) -> str:  # type: ignore
    #     """
    #     Clear the active view for a table in the active snapshot and get all records from the table.
        
    #     Use this tool when the user asks to clear the active view for a table or revert to the default view.
    #     The table_name should be the name of the table you want to clear the active view for.

    #     Do not use use this tool if there is no active view for the table configured in the snapshot.

    #     You must connect to a snapshot first using connect_snapshot_tool.
    #     However if snapshot data has already been connected, you can skip this step.
    #     """
    #     try:
    #         # Get the active snapshot
    #         chatRunContext: ChatRunContext = ctx.deps 
    #         chatSession: ChatSession = chatRunContext.session
            
    #         if not chatRunContext.snapshot:
    #             return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
    #         # Find the table by name
    #         table = None
    #         for t in chatRunContext.snapshot.tables:
    #             if t.name.lower() == table_name.lower():
    #                 table = t
    #                 break
            
    #         if not table:
    #             available_tables = [t.name for t in chatRunContext.snapshot.tables]
    #             return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
            
    #         # Set the API token for authentication
    #         # API_CONFIG.set_api_token(chatRunContext.api_token)
            
    #         # Import the clear_active_view function
    #         from scratchpad_api import clear_active_view

    #         # Call the clear_active_view API
    #         clear_active_view(
    #             chatRunContext.session.snapshot_id,
    #             table.id.wsId,
    #             chatRunContext.api_token
    #         )
            
    #         return f"Successfully cleared the active view for table '{table_name}'."
            
    #     except Exception as e:
    #         error_msg = f"Failed to clear the active view for table '{table_name}': {str(e)}"
    #         log_error("Error clearing table view", 
    #                 table_name=table_name,
    #                 error=str(e))
    #         print(f"❌ {error_msg}")
    #         return error_msg

    # @agent.tool
    # async def list_table_views_tool(ctx: RunContext[ChatRunContext], table_name: str) -> str:  # type: ignore
    #     """
    #     List all saved filteredviews for a specific table in the current snapshot.
        
    #     Use this tool when the user asks to list all the views for a table.
    #     The table_name should be the name of the table you want to list views for.

    #     You must connect to a snapshot first using connect_snapshot_tool.
    #     However if snapshot data has already been connected, you can skip this step.
    #     """
    #     try:
    #         # Get the active snapshot
    #         chatRunContext: ChatRunContext = ctx.deps 
    #         chatSession: ChatSession = chatRunContext.session
            
    #         if not chatRunContext.snapshot:
    #             return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
    #         # Find the table by name
    #         table = None
    #         for t in chatRunContext.snapshot.tables:
    #             if t.name.lower() == table_name.lower():
    #                 table = t
    #                 break
            
    #         if not table:
    #             available_tables = [t.name for t in chatRunContext.snapshot.tables]
    #             return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
            
    #         # Set the API token for authentication
    #         # API_CONFIG.set_api_token(chatRunContext.api_token)
            
    #         # Import the list_views function
    #         from scratchpad_api import list_views
            
    #         # Call the list_views API
    #         views = list_views(
    #             chatRunContext.session.snapshot_id,
    #             table.id.wsId,
    #             chatRunContext.api_token
    #         )
            
    #         if not views:
    #             return f"No views found for table '{table_name}'."
            
    #         # Format the views for display
    #         view_summaries = [f"ID: {v.id}, Name: {v.name}, Updated: {v.updatedAt}, Record Count: {len(v.recordIds)}" for v in views]
    #         return f"Views for table '{table_name}':\n" + "\n".join(view_summaries)
            
    #     except Exception as e:
    #         error_msg = f"Failed to list views for table '{table_name}': {str(e)}"
    #         log_error("Error listing views", 
    #                 table_name=table_name,
    #                 error=str(e))
    #         print(f"❌ {error_msg}")
    #         return error_msg

    @agent.tool
    async def add_records_to_filter_tool(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str]) -> str:  # type: ignore
        """
        Add records to the active record filter for a table in the current snapshot.
        
        Use this tool when the user asks to filter out specific records from a table or hide records from view.
        The table_name should be the name of the table you want to add records to the filter for.
        The record_ids should be a list of record IDs (wsId) to add to the filter.
        
        You should first use get_records_tool to see all the records in the table and identify which ones to filter.
        Then extract the wsId values from the records you want to filter out to use as the record_ids.

        IMPORTANT: Only call this tool ONCE per table per conversation. Collect all records you want to filter 
        and add them in a single call rather than making multiple calls for the same table.

        Do not use this tool if there are no records to filter.

        You must connect to a snapshot first using connect_snapshot_tool.
        However if snapshot data has already been connected, you can skip this step.
        """
        try:
            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps 
            chatSession: ChatSession = chatRunContext.session
            
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
            # Find the table by name
            table = None
            for t in chatRunContext.snapshot.tables:
                if t.name.lower() == table_name.lower():
                    table = t
                    break
            
            if not table:
                available_tables = [t.name for t in chatRunContext.snapshot.tables]
                return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
            
            # Validate that record_ids is provided
            if not record_ids:
                return "Error: No record IDs provided. Please provide a list of record IDs to add to the filter."
            
            # Import the add_records_to_active_filter function
            from scratchpad_api import add_records_to_active_filter

            # Call the add_records_to_active_filter API
            add_records_to_active_filter(
                chatRunContext.session.snapshot_id,
                table.id.wsId,
                record_ids,
                chatRunContext.api_token
            )
            
            return f"Successfully added {len(record_ids)} records to the filter for table '{table_name}'."
            
        except Exception as e:
            error_msg = f"Failed to add records to filter for table '{table_name}': {str(e)}"
            log_error("Error adding records to filter", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg

    # @agent.tool
    # async def clear_record_filter_tool(ctx: RunContext[ChatRunContext], table_name: str) -> str:  # type: ignore
        """
        Clear the active record filter for a table in the current snapshot.
        
        Use this tool when the user asks to clear the record filter for a table or show all records again.
        The table_name should be the name of the table you want to clear the filter for.

        Do not use this tool if there is no active record filter for the table.

        You must connect to a snapshot first using connect_snapshot_tool.
        However if snapshot data has already been connected, you can skip this step.
        """
        try:
            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps 
            chatSession: ChatSession = chatRunContext.session
            
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
            # Find the table by name
            table = None
            for t in chatRunContext.snapshot.tables:
                if t.name.lower() == table_name.lower():
                    table = t
                    break
            
            if not table:
                available_tables = [t.name for t in chatRunContext.snapshot.tables]
                return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
            
            # Import the clear_active_record_filter function
            from scratchpad_api import clear_active_record_filter

            # Call the clear_active_record_filter API
            clear_active_record_filter(
                chatRunContext.session.snapshot_id,
                table.id.wsId,
                chatRunContext.api_token
            )
            
            return f"Successfully cleared the record filter for table '{table_name}'."
            
        except Exception as e:
            error_msg = f"Failed to clear record filter for table '{table_name}': {str(e)}"
            log_error("Error clearing record filter", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg












