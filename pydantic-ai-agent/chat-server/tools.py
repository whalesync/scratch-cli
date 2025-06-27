#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from pydantic_ai import RunContext
from scratchpad_api import list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error

# Data types for Snapshot
class EntityId(BaseModel):
    wsId: str
    remoteId: List[str]

class ColumnSpec(BaseModel):
    id: EntityId
    name: str
    type: str  # "text" | "number" | "json"

class TableSpec(BaseModel):
    id: EntityId
    name: str
    columns: List[ColumnSpec]

class Snapshot(BaseModel):
    id: str
    createdAt: str
    updatedAt: str
    connectorAccountId: str
    tables: List[TableSpec]

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

# Global snapshot storage (in a real app, this would be per-session)
_active_snapshot: Optional[Snapshot] = None
_current_api_token: Optional[str] = None
_current_session_data: Optional[Dict[str, Any]] = None

def get_active_snapshot() -> Optional[Snapshot]:
    """Get the currently active snapshot"""
    return _active_snapshot

def set_active_snapshot(snapshot: Snapshot) -> None:
    """Set the currently active snapshot"""
    global _active_snapshot
    _active_snapshot = snapshot

def set_api_token(api_token: str) -> None:
    """Set the current API token for tools"""
    global _current_api_token
    _current_api_token = api_token

def get_api_token() -> Optional[str]:
    """Get the current API token"""
    return _current_api_token

def set_session_data(session_data: Dict[str, Any]) -> None:
    """Set the current session data for tools"""
    global _current_session_data
    _current_session_data = session_data

def get_session_data() -> Optional[Dict[str, Any]]:
    """Get the current session data"""
    return _current_session_data

async def connect_snapshot(ctx: RunContext[Any]) -> str:
    """
    Connect to the snapshot associated with the current session.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
    
    Returns:
        A string describing the result of the operation
    """
    try:
        # Get API token and session data from global state
        api_token = get_api_token()
        session_data = get_session_data()
        
        if not api_token:
            log_error("No API token available for connect_snapshot")
            return "Error: No API token available. Cannot authenticate with the server."
        
        if not session_data:
            log_error("No session data available for connect_snapshot")
            return "Error: No session data available. Cannot determine which snapshot to connect to."
        
        snapshot_id = session_data.get('snapshot_id')
        session_id = session_data.get('session_id')
        
        if not snapshot_id:
            log_error("No snapshot ID in session data", session_id=session_id)
            return "Error: No snapshot ID associated with this session. Please create a session with a snapshot ID."
        
        # Set the API token for authentication
        API_CONFIG.set_api_token(api_token)
        
        log_info("Connecting to snapshot for session", session_id=session_id, snapshot_id=snapshot_id)
        
        # Fetch snapshot details from the server
        snapshot_data = get_snapshot(snapshot_id)
        
        # Convert to our Snapshot model
        print(f"🔍 Converting snapshot data...")
        print(f"📊 Snapshot ID: {snapshot_data.id}")
        print(f"📅 Created: {snapshot_data.createdAt}")
        print(f"📅 Updated: {snapshot_data.updatedAt}")
        print(f"🔗 Connector Account: {snapshot_data.connectorAccountId}")
        print(f"📋 Tables count: {len(snapshot_data.tables)}")
        
        # Convert tables one by one
        converted_tables = []
        for i, table in enumerate(snapshot_data.tables):
            print(f"🔍 Converting table {i+1}/{len(snapshot_data.tables)}: {table['name']}")  # type: ignore
            
            # Convert columns for this table
            converted_columns = []
            for j, col in enumerate(table['columns']):  # type: ignore
                print(f"  🔍 Converting column {j+1}/{len(table['columns'])}: {col['name']}")  # type: ignore
                print(f"    📋 Column type: {col['pgType']}")  # type: ignore
                column_spec = ColumnSpec(
                    id=EntityId(wsId=col['id']['wsId'], remoteId=col['id']['remoteId']),  # type: ignore
                    name=col['name'],  # type: ignore
                    type=col['pgType']  # type: ignore
                )
                converted_columns.append(column_spec)
            
            # Create table spec
            table_spec = TableSpec(
                id=EntityId(wsId=table['id']['wsId'], remoteId=table['id']['remoteId']),  # type: ignore
                name=table['name'],  # type: ignore
                columns=converted_columns
            )
            converted_tables.append(table_spec)
        
        # Create the snapshot
        print(f"🔍 Creating Snapshot object...")
        snapshot = Snapshot(
            id=snapshot_data.id,
            createdAt=snapshot_data.createdAt,
            updatedAt=snapshot_data.updatedAt,
            connectorAccountId=snapshot_data.connectorAccountId,
            tables=converted_tables
        )
        print(f"✅ Snapshot object created successfully")
        
        # Store the snapshot
        set_active_snapshot(snapshot)
        
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
        session_data = get_session_data()
        session_id = session_data.get('session_id') if session_data else None
        log_error("Error connecting to snapshot", 
                  session_id=session_id,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

async def get_records(ctx: RunContext[Any], table_name: str, limit: int = 100) -> str:
    """
    Get all records for a table from the active snapshot.
    
    Args:
        ctx: RunContext (not used, kept for compatibility)
        table_name: The name of the table to get records for
        limit: The maximum number of records to retrieve (default: 100)
    
    Returns:
        A string describing the result of the operation
    """
    try:
        # Get the active snapshot
        snapshot = get_active_snapshot()
        if not snapshot:
            return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
        
        # Find the table by name
        table = None
        for t in snapshot.tables:
            if t.name.lower() == table_name.lower():
                table = t
                break
        
        if not table:
            available_tables = [t.name for t in snapshot.tables]
            return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
        
        # Get API token from global state
        api_token = get_api_token()
        
        if not api_token:
            log_error("No API token available for get_records", table_name=table_name)
            return "Error: No API token available. Cannot authenticate with the server."
        
        # Set the API token for authentication
        API_CONFIG.set_api_token(api_token)
        
        log_info("Getting records from Scratchpad server", 
                 table_name=table_name,
                 table_id=table.id.wsId,
                 limit=limit, 
                 snapshot_id=snapshot.id)
        
        # Get records from the server using the table ID
        result = list_records(snapshot.id, table.id.wsId, take=limit)
        
        # Log the records to console
        print(f"📊 Records for table '{table_name}' (ID: {table.id.wsId}, limit: {limit}):")
        print(f"📋 Total records returned: {len(result.records)}")
        print(f"📄 Next cursor: {result.nextCursor}")
        
        # Log each record (truncated for readability)
        for i, record in enumerate(result.records):
            print(f"  Record {i+1}: {str(record)[:200]}...")
        
        log_info("Successfully retrieved records", 
                 table_name=table_name,
                 table_id=table.id.wsId,
                 record_count=len(result.records), 
                 snapshot_id=snapshot.id)
        
        return f"Successfully retrieved {len(result.records)} records for table '{table_name}'. Records have been logged to console. Next cursor: {result.nextCursor}"
        
    except Exception as e:
        error_msg = f"Failed to get records for table '{table_name}': {str(e)}"
        log_error("Error getting records", 
                  table_name=table_name,
                  error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

def get_tool_functions() -> List:
    """Get all tool functions that can be decorated with @agent.tool"""
    return [connect_snapshot, get_records] 