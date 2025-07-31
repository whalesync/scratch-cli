#!/usr/bin/env python3
"""
Search and Replace Field Value Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent, WithTableName
from agents.data_agent.model_utils import find_table_by_name, find_record_by_wsId, is_in_write_focus, missing_table_error, missing_field_error, find_column_by_name
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from logger import log_info, log_error
import re


class SearchAndReplaceInFieldInput(WithTableName):
    """
    Input for the search_and_replace_field_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to search and replace in")
    search_value: str = Field(description="The value to search for")
    new_value: str = Field(description="The value to replace the search value with")


def define_search_and_replace_field_value_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Use this tool when the user wants to perform a search and replace for a word or phrase inside a field of a record."""
    
    @agent.tool
    async def search_and_replace_field_value_tool(ctx: RunContext[ChatRunContext], input_data: SearchAndReplaceInFieldInput) -> str:  # type: ignore
        """
        Use this tool when the user wants to perform a search and replace for a word or phrase inside a field of a record. All occurrences of the search_value will be replaced with the new_value.
        
        IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated field value the suggested_fields field of the record and require user approval before being applied to the actual record data.
        
        Use this tool when the user asks to replace a value in a field of a record
        The table_name should be the name of the table you want to update records in.
        The wsId should be the ID of the record to update.
        The field_name should be the name of the field to modify.
        The search_value should be the value to search for and cannot be empty
        The new_value should be the value to replace the search_value with.
        
        CRITICAL: The search_value must be a string and cannot be empty. The new_value must be a string and may be empty.
        
        Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
        """
        try:
            # Extract data from input
            table_name = input_data.table_name
            wsId = input_data.wsId
            field_name = input_data.field_name
            search_value = input_data.search_value
            new_value = input_data.new_value

            # Validate that wsId is a string
            if not isinstance(wsId, str):
                return f"Error: wsId must be a string, got {type(wsId)}"
            
            # Validate that field_name is a string
            if not isinstance(field_name, str):
                return f"Error: field_name must be a string, got {type(field_name)}"
            
            # Validate that value is a string
            if not isinstance(search_value, str):
                return f"Error: value must be a string, got {type(search_value)}"

            if(search_value is None or search_value == ""):
                return "Error: The search value is empty. Please provide a non-empty search value"

            # Validate that replace_value is a string
            if not isinstance(new_value, str):
                return f"Error: new_value must be a string, got {type(new_value)}"

            if(new_value is None):
                return "Error: The replace value is missing"
            
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

            if not is_in_write_focus(chatRunContext, column.id.wsId, wsId):
                return f"Error: Field '{field_name}' is not in write focus."

            from scratchpad_api import bulk_update_records, RecordOperation

            # Get the record from the preloaded records
            record = find_record_by_wsId(chatRunContext, table_name, wsId)

            if not record:
                return f"Error: Record '{wsId}' does not exist in the current context."

            # Get the field from the record
            if(column.id.wsId in record.suggested_fields):
                current_value: str = str(record.suggested_fields[column.id.wsId])
            else:
                current_value: str = str(record.fields[column.id.wsId])
            
            # Create a regex pattern that matches the search_value as a whole word
            # This ensures we match complete words, not parts of other words
            # The pattern uses word boundaries (\b) to match word boundaries
            # and escapes any special regex characters in the search_value
            escaped_search_value = re.escape(search_value)
            pattern = r'\b' + escaped_search_value + r'\b'
            
            # Replace all occurrences of the pattern with the new_value
            updated_value, replace_count = re.subn(pattern, new_value, current_value)

            if(replace_count == 0):
                return f"Error: No occurrences of {search_value} found in the {field_name} field of record {wsId}."

            update_operations = [
                RecordOperation(
                    op="update",
                    wsId=wsId,
                    data={
                        column.id.wsId: updated_value
                    }
                )
            ]

            # Call the bulk update endpoint
            bulk_update_records(
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                operations=update_operations,
                api_token=chatRunContext.api_token,
                view_id=chatRunContext.view_id
            )
            
            return f"Successfully replaced {replace_count} occurrences of {search_value} with {new_value} in the {field_name} field. Record {wsId} now contains an updated suggested value containing the changes."

        except Exception as e:
            error_msg = f"Failed to replace {search_value} with {new_value} in field {field_name} in record {wsId} in table '{table_name}': {str(e)}"
            log_error("Error replacing values in field in record", 
                    table_name=table_name,
                    error=str(e))
            print(f"❌ {error_msg} - Exception: {str(e)}")
            return error_msg 