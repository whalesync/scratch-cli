#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agents.data_agent.data_agent_utils import format_records_for_display

from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad_api import list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

# TODO: Use table id
class WithTableName(BaseModel):
    """Input for the update_records tool"""
    table_name: str = Field(description="The name of the table")


class UpdateRecordsInput(WithTableName):
    """Input for the update_records tool"""
    record_updates: List[Dict[str, Any]] = Field(description="List of record updates, each containing 'wsId' and 'data' keys")

class AppendFieldValueInput(WithTableName):
    """Input for the append_field_value tool"""
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to append a value to")
    value: str = Field(description="The data value to append to the field")

def define_data_tools(agent: Agent[ChatRunContext, ResponseFromAgent], capabilities: Optional[List[str]] = None):
    
    if capabilities is None or 'data:create' in capabilities:
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

    if capabilities is None or 'data:update' in capabilities:
        @agent.tool
        async def update_records_tool(ctx: RunContext[ChatRunContext], input_data: UpdateRecordsInput) -> str:  # type: ignore
            """
            Update existing records in a table in the active snapshot.
            
            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.
            
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
            
            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            
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
        async def append_field_value_tool(ctx: RunContext[ChatRunContext], input_data: AppendFieldValueInput) -> str:  # type: ignore
            """
            Append a value to a field in a record in a table in the active snapshot.
            
            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.
            
            Use this tool when the user asks to append data to a single record field
            The table_name should be the name of the table you want to update a record in.
            The wsId should be the ID of the record to update.
            The field_name should be the name of the field to append a value to.
            The value should be the data value to append to the field.
            
            CRITICAL: The value should always be a string and should not be empty.
            
            You should first use get_records_tool to see the current records and identify which one to update
            based on the user's criteria. Then determine the record id and field name to append the value to.
            
            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            
            """
            try:
                # Extract data from input
                table_name = input_data.table_name
                wsId = input_data.wsId
                field_name = input_data.field_name
                value = input_data.value

                # Validate that wsId is a string
                if not isinstance(wsId, str):
                    return f"Error: wsId must be a string, got {type(wsId)}"
                
                # Validate that field_name is a string
                if not isinstance(field_name, str):
                    return f"Error: field_name must be a string, got {type(field_name)}"
                
                # Validate that value is a string
                if not isinstance(value, str):
                    return f"Error: value must be a string, got {type(value)}"
                
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
                
            
                
                log_info("Appending value to field in record", 
                        table_name=table_name,
                        table_id=table.id.wsId,
                        wsId=wsId,
                        field_name=field_name,
                        value=value,
                        snapshot_id=chatRunContext.session.snapshot_id)
                
                # Import the bulk update function
                from scratchpad_api import append_value, AppendFieldValueDto
                
                # Call the bulk update endpoint
                append_value(
                    snapshot_id=chatRunContext.session.snapshot_id,
                    table_id=table.id.wsId,
                    dto=AppendFieldValueDto(
                        wsId=wsId,
                        columnId=field_name,
                        value=value
                    ),
                    api_token=chatRunContext.api_token,
                    view_id=chatRunContext.view_id
                )
                
                print(f"✅ Successfully appended value to field in record")
                print(f"📋 Table ID: {table.id.wsId}")
                print(f"✏️ wsId: {wsId}")
                print(f"✏️ Field name: {field_name}")
                print(f"✏️ Value: {value}")
                
                log_info("Successfully appended value to field in record", 
                        table_name=table_name,
                        table_id=table.id.wsId,
                        wsId=wsId,
                        field_name=field_name,
                        value=value,
                        snapshot_id=chatRunContext.session.snapshot_id)
                
                return f"Successfully appended the value to the field in record"      
            except Exception as e:
                error_msg = f"Failed to append value to field in record in table '{table_name}': {str(e)}"
                log_error("Error appending value to field in record", 
                        table_name=table_name,
                        error=str(e))
                print(f"❌ {error_msg}")
                return error_msg

        @agent.tool
        async def inject_field_value_tool(ctx: RunContext[ChatRunContext], input_data: AppendFieldValueInput) -> str:  # type: ignore
            """
            Inserts a value inside of an existing field for a record in a table.
            
            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.
            
            Use this tool when the user asks to insert or inject data to a single record field without replacing the existing value.
            The table_name should be the name of the table you want to update records in.
            The wsId should be the ID of the record to update.
            The field_name should be the name of the field to append a value to.
            The value should be the data value to append to the field.
            
            CRITICAL: The value should always be a string and should not be empty.
            
            You should first use get_records_tool to see the current records and identify which one to update
            based on the user's criteria. Then determine the record id and field name to insert the new value into.
            
            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            
            """
            try:
                # Extract data from input
                table_name = input_data.table_name
                wsId = input_data.wsId
                field_name = input_data.field_name
                value = input_data.value

                # Validate that wsId is a string
                if not isinstance(wsId, str):
                    return f"Error: wsId must be a string, got {type(wsId)}"
                
                # Validate that field_name is a string
                if not isinstance(field_name, str):
                    return f"Error: field_name must be a string, got {type(field_name)}"
                
                # Validate that value is a string
                if not isinstance(value, str):
                    return f"Error: value must be a string, got {type(value)}"
                
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
                                                
                log_info("Injecting value into field in record", 
                        table_name=table_name,
                        table_id=table.id.wsId,
                        wsId=wsId,
                        field_name=field_name,
                        value=value,
                        snapshot_id=chatRunContext.session.snapshot_id)
                
                # Import the inject value  function
                from scratchpad_api import inject_value, InjectFieldValueDto
                
                # Call the inject value endpoint
                inject_value(
                    snapshot_id=chatRunContext.session.snapshot_id,
                    table_id=table.id.wsId,
                    dto=InjectFieldValueDto(
                        wsId=wsId,
                        columnId=field_name,
                        value=value,
                        targetKey='@@'
                    ),
                    api_token=chatRunContext.api_token,
                    view_id=chatRunContext.view_id
                )
                
                print(f"✅ Successfully inserted the suggested value into the record")
                print(f"📋 Table ID: {table.id.wsId}")
                print(f"✏️ wsId: {wsId}")
                print(f"✏️ Field name: {field_name}")
                
                
                log_info("Successfully inserted the suggested value into the record", 
                        table_name=table_name,
                        table_id=table.id.wsId,
                        wsId=wsId,
                        field_name=field_name,
                        value=value,
                        snapshot_id=chatRunContext.session.snapshot_id)
                
                return f"Successfully inserted the suggested value into the field in record"      
            except Exception as e:
                error_msg = f"Failed to insert the suggested value into the field in record in table '{table_name}': {str(e)}"
                log_error("Error inserting the suggested value into the field in record", 
                        table_name=table_name,
                        error=str(e))
                print(f"❌ {error_msg}")
                return error_msg


    if capabilities is None or 'data:delete' in capabilities:
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











