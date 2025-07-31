#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent, WithTableName
from agents.data_agent.model_utils import find_record_by_wsId, is_in_write_focus, missing_table_error, find_table_by_name, missing_field_error, find_column_by_name, unable_to_identify_active_table_error, get_active_table

from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext, Tool
from pydantic_ai._function_schema import FunctionSchema
from pydantic_core import core_schema, SchemaValidator
from scratchpad_api import RecordId, SnapshotRecord, TableSpec, list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error
from agents.data_agent.tools.update_records_tool import create_update_records_tool
import re

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

# TODO: Use table id


class AppendFieldValueInput(WithTableName):
    """
    Input for the append_field_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to append a value to")
    value: str = Field(description="The data value to append to the field")

class InsertFieldValueInput(WithTableName):
    """
    Input for the insert_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to insert a value into")
    value: str = Field(description="The data value to insert into the field")

class SearchAndReplaceInFieldInput(WithTableName):
    """
    Input for the search_and_replace_field_value_tool
    """
    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to search and replace in")
    search_value: str = Field(description="The value to search for")
    new_value: str = Field(description="The value to replace the search value with")
   
# class EditFieldValueInput(WithTableName):
#     """
#     Input for the edit_field_value tool
#     """
#     wsId: str = Field(description="The ID of the record to update")
#     field_name: str = Field(description="The name of the field to edit")
#     value: str = Field(description="The data value to set in the field")

def get_data_tools(capabilities: Optional[List[str]] = None, style_guides: Dict[str, str] = None):
    tools = []
    if capabilities is None or 'data:update' in capabilities:
        tools.append(create_update_records_tool(style_guides));
    return tools;


def define_data_tools(agent: Agent[ChatRunContext, ResponseFromAgent], capabilities: Optional[List[str]] = None):
    
    if capabilities is None or 'data:create' in capabilities:
        @agent.tool
        async def create_records_tool(ctx: RunContext[ChatRunContext], table_name: str, record_data_list: List[Dict[str, Any]]) -> str:  # type: ignore
            """
            Create new records for a table in the active snapshot using data provided by the LLM.
            
            Use this tool when the user asks to create new records or add data to a table.
            The table_name should be the name of the table you want to create records for.
            The record_data_list should be a list of dictionaries, where each dictionary contains field names as keys and appropriate values based on the column types.
            The record_data_list must contain at least one entry.
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
                    return "Error: No record_data_list provided. You must provide a list of record data dictionaries that includes at least one element."
                
                if len(record_data_list) == 0:
                    return "Error: The record_data_list is empty. You must provide a list of record data dictionaries that includes at least one element."
                
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

    if capabilities is None or 'data:field-tools' in capabilities:
   
        
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
                
                # Import the inject value  function
                from scratchpad_api import bulk_update_records, RecordOperation
                
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
                
                # Import the inject value  function
                from scratchpad_api import bulk_update_records, RecordOperation
                
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

                if(current_value.find('@@') == -1):
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
                
                return f"Successfully inserted {value} into the {field_name} field. Record {wsId} now contains an updated suggested value containing the changes."
            except Exception as e:
                error_msg = f"Failed to insert the suggested value into the field in record in table '{table_name}': {str(e)}"
                log_error("Error inserting the suggested value into the field in record", 
                        table_name=table_name,
                        error=str(e))
                print(f"❌ {error_msg}")
                return error_msg

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

        # @agent.tool
        # async def edit_field_value_tool(ctx: RunContext[ChatRunContext], input_data: EditFieldValueInput) -> str:  # type: ignore
        #     """
        #     Update the value of one field of a record in a table. 
            
        #     IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.
            
        #     Use this tool when the user wants to update the value of a single field in a single record.
        #     The table_name should be the name of the table you want to update records in.
        #     The wsId should be the ID of the record to update.
        #     The field_name should be the name of the field to edit.
        #     The field_name should be the name of the field that currently has write focus
        #     The value should be the value to set in the field.
            
        #     CRITICAL: The value should always be a string and should not be empty.
            
        #     Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
        #     """
        #     try:
        #         # Extract data from input
        #         table_name = input_data.table_name
        #         recordWsId = input_data.wsId
        #         field_name = input_data.field_name
        #         value = input_data.value

        #         # Validate that wsId is a string
        #         if not isinstance(recordWsId, str):
        #             return f"Error: wsId must be a string, got {type(recordWsId)}"
                
        #         # Validate that field_name is a string
        #         if not isinstance(field_name, str):
        #             return f"Error: field_name must be a string, got {type(field_name)}"
                
        #         # Validate that value is a string
        #         if not isinstance(value, str):
        #             return f"Error: value must be a string, got {type(value)}"
                
        #         # Get the active snapshot
        #         chatRunContext: ChatRunContext = ctx.deps 
        #         chatSession: ChatSession = chatRunContext.session
                
        #         if not chatRunContext.snapshot:
        #             return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
                
        #         # Find the table by name
        #         table: TableSpec | None = None
        #         for t in chatRunContext.snapshot.tables:
        #             if t.name.lower() == table_name.lower():
        #                 table = t
        #                 break
                
        #         if not table:
        #             available_tables = [t.name for t in chatRunContext.snapshot.tables]
        #             return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"

        #         print(f"🔍 Table: {table}")

        #         field_id = None
        #         for column in table.columns:
        #             if column.name.lower() == field_name.lower():
        #                 field_id = column.id.wsId
        #                 break
                
        #         if not field_id:
        #             available_columns = [c.name for c in table.columns]
        #             return f"Error: Field '{field_name}' not found. Available columns: {available_columns}"

        #         print(f"🔍 Field ID: {field_id}")

        #         if not is_in_write_focus(chatRunContext, field_id, recordWsId):
        #             return f"Error: Field '{field_name}' is not in write focus."

        #         from scratchpad_api import bulk_update_records, RecordOperation

        #           # Get the record from the preloaded records
        #         record = find_record_by_wsId(chatRunContext, table.id.wsId, recordWsId)

        #         if not record:
        #             return f"Error: Record '{recordWsId}' does not exist in the current context."

        #         print(f"🔍 Record: {record}")

        #         update_operations = [
        #             RecordOperation(
        #                 op="update",
        #                 wsId=recordWsId,
        #                 data={
        #                     field_id: value
        #                 }
        #             )
        #         ]

        #         # Call the bulk update endpoint
        #         bulk_update_records(
        #             snapshot_id=chatRunContext.session.snapshot_id,
        #             table_id=table.id.wsId,
        #             operations=update_operations,
        #             api_token=chatRunContext.api_token,
        #             view_id=chatRunContext.view_id
        #         )
                
        #         print(f"✅ Successfully updated {len(update_operations)} in table '{table_name}'")
        #         print(f"📋 Table ID: {table.id.wsId}")
        #         print(f"✏️ Updated records:")
        #         for i, operation in enumerate(update_operations):
        #             print(f"  Record {i+1}: ID={operation.wsId}, Data={operation.data}")
                
        #         return f"Successfully edited the value of the field {field_name} in record {recordWsId} in table '{table_name}'"    

        #     except Exception as e:
        #         error_msg = f"Failed to edit the value of the field {field_name} in record {recordWsId} in table '{table_name}': {str(e)}"
        #         log_error("Error editing the value of the field in record", 
        #                 table_name=table_name,
        #                 error=str(e))
        #         print(f"❌ {error_msg}")
        #         return error_msg




    if capabilities is None or 'data:delete' in capabilities:
        @agent.tool
        async def delete_records_tool(ctx: RunContext[ChatRunContext], record_ids: List[str]) -> str:  # type: ignore
            """
            Delete records from the active table in the current snapshot by their record IDs.
            
            Use this tool when the user asks to delete records from the active table.
            The record_ids should be a list of record IDs (wsId) to delete.
            """
            table_name = None
            try:
                # Get the active snapshot
                chatRunContext: ChatRunContext = ctx.deps 
                chatSession: ChatSession = chatRunContext.session
                
                if not chatRunContext.snapshot:
                    return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."
                
                # Find the table by name
                table = get_active_table(chatRunContext)
                table_name = table.name
                
                if not table:
                    return unable_to_identify_active_table_error(chatRunContext)
                
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

