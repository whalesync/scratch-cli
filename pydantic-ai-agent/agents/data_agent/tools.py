#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ChatSession
from agents.data_agent.data_agent_utils import (
    convert_scratchpad_snapshot_to_ai_snapshot, 
    SnapshotForAi, 
    ColumnSpecForAi, 
    TableSpec, 
    TableContext, 
    EntityId
)

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from pydantic_ai import RunContext
from scratchpad_api import list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

async def connect_snapshot(ctx: RunContext[ChatRunContext]) -> str:
    """
    Connect to the snapshot associated with the current session.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
    
    Returns:
        A string describing the result of the operation
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
                 table_count=len(snapshot.tables))
        
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

async def create_records(ctx: RunContext[ChatRunContext], table_name: str, record_data_list: List[Dict[str, Any]]) -> str:
    """
    Create new records for a table in the active snapshot using data provided by the LLM.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to create records for
        record_data_list: List of dictionaries containing the field data for each record to create
    
    Returns:
        A string describing the result of the operation
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
            api_token=chatRunContext.api_token
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

async def get_records(ctx: RunContext[ChatRunContext], table_name: str, limit: int = 100, view_id: Optional[str] = None) -> str:
    """
    Get all records for a table from the active snapshot. If a view_id is provided, get records just from a filtered view
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to get records for
        limit: The maximum number of records to retrieve (default: 100)
        view_id: The ID of the view to get records from (default: None)
    
    Returns:
        A string describing the result of the operation
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
                 snapshot_id=chatRunContext.session.snapshot_id)
        
        # Get records from the server using the table ID
        result = list_records(chatRunContext.session.snapshot_id, table.id.wsId, chatRunContext.api_token, take=limit)
        
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
        
        # Format records for the agent to understand
        records_summary = []
        for i, record in enumerate(result.records):
            record_data = {
                "id": {"wsId": record.id.wsId, "remoteId": record.id.remoteId},
                "dirty": record.dirty,
            }
            
            # Add the actual field data
            for key, value in record.fields.items():
                # Truncate long values for readability
                if isinstance(value, str) and len(value) > 100:
                    record_data[key] = value[:100] + "..."
                else:
                    record_data[key] = value
            
            # Add metadata if present
            if record.edited_fields:
                record_data["edited_fields"] = record.edited_fields
            if record.suggested_fields:
                record_data["suggested_fields"] = record.suggested_fields
                
            records_summary.append(record_data)
        
        return f"Successfully retrieved {len(result.records)} records for table '{table_name}':\n\n{records_summary}\n\nNext cursor: {result.nextCursor}"
        
    except Exception as e:
        error_msg = f"Failed to get records for table '{table_name}': {str(e)}"
        log_error("Error getting records", 
                  table_name=table_name,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

async def delete_records(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str]) -> str:
    """
    Delete records from a table in the active snapshot by their IDs.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to delete records from
        record_ids: List of record IDs (wsId) to delete
    
    Returns:
        A string describing the result of the operation
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
            api_token=chatRunContext.api_token
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

async def update_records(ctx: RunContext[ChatRunContext], table_name: str, record_updates: List[Dict[str, Any]]) -> str:
    """
    Update records in a table in the active snapshot.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to update records in
        record_updates: List of dictionaries, each containing 'wsId' and 'data' keys
                       Example: [{'wsId': 'record_id_1', 'data': {'field1': 'new_value'}}]
    
    Returns:
        A string describing the result of the operation
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
            api_token=chatRunContext.api_token
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

async def activate_table_view(ctx: RunContext[ChatRunContext], table_name: str, record_ids: List[str], name: str) -> str:
    """
    Create a filtered view for a table with subset of records for use in the context. 
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to activate the view for
        record_ids: List of record wsIDs to include in the view
        name: The name of the view to create and activate
    
    Returns:
        An ID that uniquely identifies the view
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
        
        # Import the CreateSnapshotTableViewDto class
        from scratchpad_api import CreateSnapshotTableViewDto, activate_view
        
        # Validate that record_ids is provided
        if not record_ids:
            return "Error: No record IDs provided. Please provide a list of record IDs to include in the view."
        
        # Create the DTO
        dto = CreateSnapshotTableViewDto(
            source="agent",
            name=name,
            recordIds=record_ids
        )
        
        # Call the activate_view API
        view_id = activate_view(
            chatRunContext.session.snapshot_id,
            table.id.wsId,
            dto,
            chatRunContext.api_token
        )
        
        return f"Successfully activated view '{name}' (ID: {view_id}) for table '{table_name}' with {len(record_ids)} records."
        
    except Exception as e:
        error_msg = f"Failed to activate view for table '{table_name}': {str(e)}"
        log_error("Error activating view", 
                  table_name=table_name,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

async def list_table_views(ctx: RunContext[ChatRunContext], table_name: str) -> str:
    """
    List all views for a specific table in the current snapshot.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to list views for
    
    Returns:
        A string summary of the views or an error message
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
        
        # Import the list_views function
        from scratchpad_api import list_views
        
        # Call the list_views API
        views = list_views(
            chatRunContext.session.snapshot_id,
            table.id.wsId,
            chatRunContext.api_token
        )
        
        if not views:
            return f"No views found for table '{table_name}'."
        
        # Format the views for display
        view_summaries = [f"ID: {v.id}, Name: {v.name}, Updated: {v.updatedAt}, Record Count: {len(v.recordIds)}" for v in views]
        return f"Views for table '{table_name}':\n" + "\n".join(view_summaries)
        
    except Exception as e:
        error_msg = f"Failed to list views for table '{table_name}': {str(e)}"
        log_error("Error listing views", 
                  table_name=table_name,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

async def clear_table_view(ctx: RunContext[ChatRunContext], table_name: str) -> str:
    """
    Clear the current active view from a table in the active snapshot, reverting to the default (unfiltered) view.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to clear the view from
    
    Returns:
        A string describing the result of the operation
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
        
        # Import the clear_active_view function
        from scratchpad_api import clear_active_view

        # Call the clear_active_view API
        clear_active_view(
            chatRunContext.session.snapshot_id,
            table.id.wsId,
            chatRunContext.api_token
        )
        
        return f"Successfully cleared the active view for table '{table_name}'."
        
    except Exception as e:
        error_msg = f"Failed to clear the active view for table '{table_name}': {str(e)}"
        log_error("Error clearing table view", 
                  table_name=table_name,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

