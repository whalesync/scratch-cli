#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agents.data_agent.data_agent_utils import (
    convert_scratchpad_snapshot_to_ai_snapshot, 
    SnapshotForAi, 
    ColumnSpecForAi, 
    TableSpec, 
    TableContext, 
    EntityId,
    format_records_for_display
)

from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad_api import list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

class UpdateRecordsInput(BaseModel):
    """Input for the update_records tool"""
    table_name: str = Field(description="The name of the table to update records in")
    record_updates: List[Dict[str, Any]] = Field(description="List of record updates, each containing 'wsId' and 'data' keys")



def define_data_tools(agent: Agent[ChatRunContext, ResponseFromAgent]):
    
    @agent.tool
    async def update_records_tool(ctx: RunContext[ChatRunContext], input_data: UpdateRecordsInput) -> str:  # type: ignore
        """
        Update existing records in a table in the active snapshot.
        
        IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the __suggested_values field and require user approval before being applied to the actual record data.
        
        Use this tool when the user asks to modify or edit existing records in a table.
        The table_name should be the name of the table you want to update records in.
        The record_updates should be a list of dictionaries, where each dictionary contains:
        - 'wsId': the record ID to update
        - 'data': a dictionary of field names and new values to set
        
        CRITICAL: Pass record_updates as a proper list object, NOT as a JSON string.
        Example: [{'wsId': 'record_id_1', 'data': {'status': 'active', 'priority': 'high'}}]
        NOT: "[{'wsId': 'record_id_1', 'data': {'status': 'active', 'priority': 'high'}}]"
        
        You should first use get_records_tool to see the current records and identify which ones to update
        based on the user's criteria. Then create the update data for each matching record.
        
        Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the __suggested_values field).
        
        You must connect to a snapshot first using connect_snapshot_tool.
        However if snapshot data has already been connected, you can skip this step.
        """
        try:
            # Extract data from input
            table_name = input_data.table_name
            record_updates = input_data.record_updates
            
            # Handle case where record_updates is passed as a JSON string
            if isinstance(record_updates, str):
                import json
                try:
                    record_updates = json.loads(record_updates)
                except json.JSONDecodeError as e:
                    return f"Error: Invalid JSON string for record_updates: {e}"
            # Validate that record_updates is now a list
            if not isinstance(record_updates, list):
                return f"Error: record_updates must be a list, got {type(record_updates)}"
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
            
            # Set the API token for authentication
            # API_CONFIG.set_api_token(chatRunContext.api_token)
            
            # Import the RecordOperation class
            from scratchpad_api import RecordOperation
            
            # Validate that record_updates is provided
            if not record_updates:
                return "Error: No record updates provided. Please provide a list of record updates."
            
            # Create RecordOperation objects for update operations
            update_operations = []
            for i, update in enumerate(record_updates):
                if not isinstance(update, dict):
                    return f"Error: Record update at index {i} must be a dictionary, got {type(update)}"
                
                if 'wsId' not in update:
                    return f"Error: Record update at index {i} must contain 'wsId' key"
                
                if 'data' not in update:
                    return f"Error: Record update at index {i} must contain 'data' key"
                
                wsId = update['wsId']
                data = update['data']
                
                if not isinstance(wsId, str):
                    return f"Error: wsId in record update at index {i} must be a string, got {type(wsId)}"
                
                if not isinstance(data, dict):
                    return f"Error: data in record update at index {i} must be a dictionary, got {type(data)}"
                
                # Create proper RecordOperation objects for update
                update_operations.append(RecordOperation(
                    op="update",
                    wsId=wsId,
                    data=data
                ))
            
            log_info("Updating records via bulk update", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(update_operations),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            # Import the bulk update function
            from scratchpad_api import bulk_update_records
            
            # Call the bulk update endpoint
            bulk_update_records(
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                operations=update_operations,
                api_token=chatRunContext.api_token,
                view_id=chatRunContext.view_id
            )
            
            print(f"✅ Successfully updated {len(update_operations)} records in table '{table_name}'")
            print(f"📋 Table ID: {table.id.wsId}")
            print(f"✏️ Updated records:")
            for i, operation in enumerate(update_operations):
                print(f"  Record {i+1}: ID={operation.wsId}, Data={operation.data}")
            
            log_info("Successfully updated records", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(update_operations),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            return f"Successfully updated {len(update_operations)} records in table '{table_name}'. Updated record IDs: {[op.wsId for op in update_operations]}"      
        except Exception as e:
            error_msg = f"Failed to update records in table '{table_name}': {str(e)}"
            log_error("Error updating records", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg

    @agent.tool
    async def connect_snapshot_tool(ctx: RunContext[ChatRunContext]) -> str:  # type: ignore
        """
        Connect to the snapshot associated with the current session.
        
        Use this tool when the user wants to work with data from the snapshot associated with their session.
        The snapshot ID is automatically determined from the session.
        This will provide you with table schema information including column names and types.
        """
        try:
            # Get API token and session data from global state
            chatRunContext: ChatRunContext = ctx.deps 
            api_token = chatRunContext.api_token
            chatSession = chatRunContext.session
            # session_data = get_session_data()
            
            if not api_token:
                log_error("No API token available for connect_snapshot")
                return "Error: No API token available. Cannot authenticate with the server."
            
            # if not session_data:
            #     log_error("No session data available for connect_snapshot")
            #     return "Error: No session data available. Cannot determine which snapshot to connect to."
            
            snapshot_id = chatSession.snapshot_id
            session_id = chatSession.id
            
                
            # API token is now passed directly to each function call
            
            log_info("Connecting to snapshot for session", session_id=session_id, snapshot_id=snapshot_id)
            
            # Fetch snapshot details from the server
            snapshot_data = get_snapshot(snapshot_id, api_token)
            
            # Convert to our Snapshot model using the utility function
            snapshot = convert_scratchpad_snapshot_to_ai_snapshot(snapshot_data, chatSession)
            # Type assertion to handle the type mismatch between local Snapshot and scratchpad_api.Snapshot
            chatRunContext.snapshot = snapshot  # type: ignore
            # Store the snapshot
            # set_active_snapshot(snapshot)
            
            # Log the connection
            print(f"📊 Connected to snapshot: {snapshot_id}")
            print(f"📋 Found {len(snapshot.tables)} tables:")
            for table in snapshot.tables:
                print(f"  - {table.name} (ID: {table.id.wsId})")
                print(f"    Columns: {[col.name for col in table.columns]}")
            
            log_info("Successfully connected to snapshot", 
                    session_id=session_id,
                    snapshot_id=snapshot_id, 
                    table_count=len(snapshot.tables),
                    snapshot=snapshot)
            
            return f"Successfully connected to snapshot {snapshot_id}. Found {len(snapshot.tables)} table(s): {[table.name for table in snapshot.tables]}"
            
        except Exception as e:
            error_msg = f"Failed to connect to snapshot: {str(e)}"
            # session_data = get_session_data()
            # session_id = session_data.get('session_id') if session_data else None
            log_error("Error connecting to snapshot", 
                    session_id=session_id,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg

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
        try:
            # Get the active snapshot

            chatRunContext: ChatRunContext = ctx.deps 
            chatSession: ChatSession = chatRunContext.session  # ✅ your typed instance
            # chatSession = ctx.deps;
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
            
            # Get API token from global state
            # api_token = get_api_token()
            
            # if not api_token:
            #     log_error("No API token available for get_records", table_name=table_name)
            #     return "Error: No API token available. Cannot authenticate with the server."
            
            # Set the API token for authentication
            # API_CONFIG.set_api_token(chatRunContext.api_token)
            
            log_info("Getting records from Scratchpad server", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    limit=limit,
                    view_id=chatRunContext.view_id,
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            # Get records from the server using the table ID and view ID if available
            if chatRunContext.view_id:
                print(f"👁️ Using view ID: {chatRunContext.view_id}")
            else:
                print(f"ℹ️ No view ID provided, getting all records")
            result = list_records(chatRunContext.session.snapshot_id, table.id.wsId, chatRunContext.api_token, take=limit, view_id=chatRunContext.view_id)
            
            # Log the records to console
            print(f"📊 Records for table '{table_name}' (ID: {table.id.wsId}, limit: {limit}):")
            print(f"📋 Total records returned: {len(result.records)}")
            print(f"📄 Next cursor: {result.nextCursor}")
            print(f"🔍 DEBUG: result type: {type(result)}")
            print(f"🔍 DEBUG: result.records type: {type(result.records)}")
            if result.records:
                print(f"🔍 DEBUG: First record type: {type(result.records[0])}")
            
            # Log each record (truncated for readability)
            for i, record in enumerate(result.records):
                print(f"  Record {i+1} (type: {type(record)}): {str(record)[:200]}...")
            
            log_info("Successfully retrieved records", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(result.records), 
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            # Convert records to the same format as pre-loaded data
            records_dict = [
                {
                    'id': {'wsId': record.id.wsId, 'remoteId': record.id.remoteId},
                    'fields': record.fields,
                    'suggested_fields': record.suggested_fields,
                    'edited_fields': record.edited_fields,
                    'dirty': record.dirty
                }
                for record in result.records
            ]
            
            # Format records using the shared function
            records_summary = format_records_for_display(records_dict, limit)
            
            return f"Successfully retrieved {len(result.records)} records for table '{table_name}':\n\n{records_summary}\n\nNext cursor: {result.nextCursor}"
            
        except Exception as e:
            error_msg = f"Failed to get records for table '{table_name}': {str(e)}"
            log_error("Error getting records", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg
    
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
            
            # Set the API token for authentication
            # API_CONFIG.set_api_token(chatRunContext.api_token)
            
            # Import the RecordOperation class
            from scratchpad_api import RecordOperation
            
            # Validate that record_data_list is provided
            if not record_data_list:
                return "Error: No record data provided. Please provide a list of record data dictionaries."
            
            # Create RecordOperation objects from the provided data
            sample_records = []
            for i, record_data in enumerate(record_data_list):
                if not isinstance(record_data, dict):
                    return f"Error: Record data at index {i} must be a dictionary, got {type(record_data)}"
                
                # Create proper RecordOperation objects
                sample_records.append(RecordOperation(
                    op="create",
                    wsId=f"temp_id_{i+1}",  # Temporary ID for create operations
                    data=record_data
                ))
            
            log_info("Creating records via bulk update", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(sample_records),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            # Import the bulk update function
            from scratchpad_api import bulk_update_records
            
            # Call the bulk update endpoint
            bulk_update_records(
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                operations=sample_records,
                api_token=chatRunContext.api_token,
                view_id=chatRunContext.view_id
            )
            
            print(f"✅ Successfully created {len(sample_records)} records for table '{table_name}'")
            print(f"📋 Table ID: {table.id.wsId}")
            print(f"📊 Records created:")
            for i, record in enumerate(sample_records):
                print(f"  Record {i+1}: {record.data}")
            
            log_info("Successfully created records", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(sample_records),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            return f"Successfully created {len(sample_records)} records for table '{table_name}'. Records have been logged to console."
            
        except Exception as e:
            error_msg = f"Failed to create records for table '{table_name}': {str(e)}"
            log_error("Error creating records", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg
    
    
    
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
            
            # Set the API token for authentication
            # API_CONFIG.set_api_token(chatRunContext.api_token)
            
            # Import the RecordOperation class
            from scratchpad_api import RecordOperation
            
            # Validate that record_ids is provided
            if not record_ids:
                return "Error: No record IDs provided. Please provide a list of record IDs to delete."
            
            # Create RecordOperation objects for delete operations
            delete_operations = []
            for record_id in record_ids:
                if not isinstance(record_id, str):
                    return f"Error: Record ID must be a string, got {type(record_id)}"
                
                # Create proper RecordOperation objects for delete
                delete_operations.append(RecordOperation(
                    op="delete",
                    wsId=record_id,
                    data=None  # No data needed for delete operations
                ))
            
            log_info("Deleting records via bulk update", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(delete_operations),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            # Import the bulk update function
            from scratchpad_api import bulk_update_records
            
            # Call the bulk update endpoint
            bulk_update_records(
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                operations=delete_operations,
                api_token=chatRunContext.api_token,
                view_id=chatRunContext.view_id
            )
            
            print(f"✅ Successfully deleted {len(delete_operations)} records from table '{table_name}'")
            print(f"📋 Table ID: {table.id.wsId}")
            print(f"🗑️ Deleted record IDs: {record_ids}")
            
            log_info("Successfully deleted records", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    record_count=len(delete_operations),
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            return f"Successfully deleted {len(delete_operations)} records from table '{table_name}'. Deleted record IDs: {record_ids}"
            
        except Exception as e:
            error_msg = f"Failed to delete records from table '{table_name}': {str(e)}"
            log_error("Error deleting records", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg











