#!/usr/bin/env python3
"""
Insert Value Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent, WithTableName
from agents.data_agent.model_utils import find_table_by_name, find_record_by_wsId, is_in_write_focus, missing_table_error, missing_field_error, find_column_by_name
from typing import Optional
from pydantic import Field
from pydantic_ai import Agent, RunContext
from logger import log_info, log_error
from scratchpad_api import bulk_update_records, RecordOperation

class InsertFieldValueInput(WithTableName):
    """
    Input for the insert_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to insert a value into")
    value: str = Field(description="The data value to insert into the field")


def define_insert_value_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Inserts a value into the an field for a record in a table at the @@ placeholder marker."""
    
    @agent.tool
    async def insert_value_tool(ctx: RunContext[ChatRunContext], input_data: InsertFieldValueInput) -> str:  # type: ignore
        """
        Inserts a value into the an field for a record in a table at the @@ placeholder marker.
        
        IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.
        
        Use this tool when the user asks to insert data to a single record field
        Do not use this tool for search and replace operations.
        The table_name should be the name of the table you want to update records in.
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

            if(wsId is None or wsId == ""):
                return "Error: The wsId is empty. Please provide a non-empty wsId"
            
            # Validate that field_name is a string
            if not isinstance(field_name, str):
                return f"Error: field_name must be a string, got {type(field_name)}"

            if(field_name is None or field_name == ""):
                return "Error: The field name is empty. Please provide a non-empty field name"
            
            # Validate that value is a string
            if not isinstance(value, str):
                return f"Error: value must be a string, got {type(value)}"

            if(value is None or value == ""):
                return "Error: The value to insert is empty. Please provide a non-empty value"
            
            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps 
            chatSession: ChatSession = chatRunContext.session
            
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
            
            # Find the table by name
            table = find_table_by_name(chatRunContext, table_name)
            
            if not table:
                return missing_table_error(table_name)

            column = find_column_by_name(table, field_name)
            
            if not column:
                return missing_field_error(table, field_name)

            log_info("Injecting value into field in record", 
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

            placeholder_count = current_value.count('@@')

            if(placeholder_count == 0):
                return f"Error: No values inserted. The field {field_name} in record {wsId} does not contain the @@ placeholder marker."

            updated_value = current_value.replace('@@', value)

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
            
            return f"Successfully inserted {value} into the {field_name} field in {placeholder_count} places. Record {wsId} now contains an updated suggested value containing the changes."
        except Exception as e:
            error_msg = f"Failed to insert the suggested value into the field in record in table '{table_name}': {str(e)}"
            log_error("Error inserting the suggested value into the field in record", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg}")
            return error_msg 