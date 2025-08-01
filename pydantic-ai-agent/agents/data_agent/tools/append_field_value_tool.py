#!/usr/bin/env python3
"""
Append Field Value Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent, WithTableName
from agents.data_agent.model_utils import find_table_by_name, find_record_by_wsId, is_in_write_focus, missing_table_error, missing_field_error, find_column_by_name
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from logger import log_info, log_error
from scratchpad_api import bulk_update_records, RecordOperation


class AppendFieldValueInput(WithTableName):
    """
    Input for the append_field_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to append a value to")
    value: str = Field(description="The data value to append to the field")


def define_append_field_value_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Append a value to a field in a record in a table in the active snapshot."""
    
    @agent.tool
    async def append_field_value_tool(ctx: RunContext[ChatRunContext], input_data: AppendFieldValueInput) -> str:  # type: ignore
        """
        Append a value to a field in a record in a table in the active snapshot.
        
        IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated value is stored in the suggested_fields field of the record and require user approval before being applied to the actual record data.
        
        Use this tool when the user asks to append data to a single record field
        The table_name should be the name of the table you want to update a record in.
        The wsId should be the ID of the record to update.
        The field_name should be the name of the field to append a value to.
        The value should be the data value to append to the field.
        
        CRITICAL: The value should always be a string and should not be empty.
                  
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
            
            if(value is None or value == ""):
                return "Error: The value to append is empty. Please provide a non-empty value"
            
            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps 
            chatSession: ChatSession = chatRunContext.session
            
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
            table = find_table_by_name(chatRunContext, table_name)
            if not table:
                return missing_table_error(table_name)

            column = find_column_by_name(table, field_name)
            
            if not column:
                return missing_field_error(table, field_name)

            log_info("Appending value to field in record", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    wsId=wsId,
                    field_name=field_name,
                    value=value,
                    snapshot_id=chatRunContext.session.snapshot_id)
            
                        
            # Get the record from the preloaded records
            record = find_record_by_wsId(chatRunContext, table_name, wsId)

            if not record:
                return f"Error: Record '{wsId}' does not exist in the current context."

            if not is_in_write_focus(chatRunContext, column.id.wsId, wsId):
                return f"Error: Field '{field_name}' is not in write focus."

            if(column.id.wsId in record.suggested_fields):
                current_value: str = str(record.suggested_fields[column.id.wsId])
            else:
                current_value: str = str(record.fields[column.id.wsId])
            
            log_info("Appending value to field in record", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    wsId=wsId,
                    field_name=field_name,
                    value=value,
                    snapshot_id=chatRunContext.session.snapshot_id)
            

            updated_value = current_value + ' ' + value

            update_operations = [   
                RecordOperation(
                    op="update",
                    wsId=wsId,
                    data={
                        column.id.wsId: updated_value
                    }
                )
            ]

            bulk_update_records(
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                operations=update_operations,
                api_token=chatRunContext.api_token,
                view_id=chatRunContext.view_id
            )
            
            log_info("Successfully appended value to field in record", 
                    table_name=table_name,
                    table_id=table.id.wsId,
                    wsId=wsId,
                    field_name=field_name,
                    value=value,
                    snapshot_id=chatRunContext.session.snapshot_id)
            
            return f"Successfully appended the value to the {input_data.field_name} field in record {input_data.wsId} in table {input_data.table_name}"
        except Exception as e:
            error_msg = f"Failed to append value to the {input_data.field_name} field in record {input_data.wsId} in table {input_data.table_name}: {str(e)}"
            log_error("Error appending value to field in record", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg 