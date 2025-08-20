#!/usr/bin/env python3
"""
Search and Replace Field Value Tool for the Data Agent
"""
from agents.data_agent.models import (
    ChatRunContext,
    ResponseFromAgent,
)
from agents.data_agent.model_utils import (
    find_record_by_wsId,
    is_in_write_focus,
    missing_field_error,
    find_column_by_name,
    find_column_by_id,
    get_active_table,
    unable_to_identify_active_snapshot_error,
    unable_to_identify_active_table_error,
    unable_to_identify_active_field_error,
    unable_to_identify_active_record_error,
    record_not_in_context_error,
    not_in_write_focus_error,
    update_record_in_context,
)
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from logger import log_info, log_error
import re
from scratchpad_api import (
    bulk_update_records,
    RecordOperation,
    ColumnSpec,
    TableSpec,
    get_record,
)
from logging import getLogger

logger = getLogger(__name__)


class SearchAndReplaceInFieldInput(BaseModel):
    """
    Input for the search_and_replace_field_value_tool
    """

    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(
        description="The name of the field to search and replace in"
    )
    search_value: str = Field(description="The value to search for")
    new_value: str = Field(description="The value to replace the search value with")


def search_and_replace_field_value_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table: TableSpec,
    wsId: str,
    column: ColumnSpec,
    search_value: str,
    new_value: str,
) -> str:
    """Search and replace a value in a field in a record in a table in the active snapshot."""
    try:
        # Validate that search_value is a string
        if not isinstance(search_value, str):
            return f"Error: search_value must be a string, got {type(search_value)}"

        if search_value is None or search_value == "":
            return "Error: The search value is empty. Please provide a non-empty search value"

        # Validate that new_value is a string
        if not isinstance(new_value, str):
            return f"Error: new_value must be a string, got {type(new_value)}"

        if new_value is None:
            return "Error: The replace value is missing"

        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.snapshot:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        if not is_in_write_focus(chatRunContext, column.id.wsId, wsId):
            return not_in_write_focus_error(chatRunContext, column.id.wsId, wsId)

        # Get the record from the preloaded records
        record = find_record_by_wsId(chatRunContext, table.name, wsId)

        if not record:
            return record_not_in_context_error(chatRunContext, wsId)

        # Get the field from the record
        if column.id.wsId in record.suggested_fields:
            current_value: str = str(record.suggested_fields[column.id.wsId])
        else:
            current_value: str = str(record.fields[column.id.wsId])

        # Create a regex pattern that matches the search_value as a whole word
        # This ensures we match complete words, not parts of other words
        # The pattern uses word boundaries (\b) to match word boundaries
        # and escapes any special regex characters in the search_value
        escaped_search_value = re.escape(search_value)
        pattern = r"\b" + escaped_search_value + r"\b"

        # Replace all occurrences of the pattern with the new_value
        updated_value, replace_count = re.subn(pattern, new_value, current_value)

        if replace_count == 0:
            return f"Error: No occurrences of {search_value} found in the {column.name} field of record {wsId}."

        update_operations = [
            RecordOperation(
                op="update", wsId=wsId, data={column.id.wsId: updated_value}
            )
        ]

        # Call the bulk update endpoint
        bulk_update_records(
            snapshot_id=chatRunContext.session.snapshot_id,
            table_id=table.id.wsId,
            operations=update_operations,
            api_token=chatRunContext.api_token,
            view_id=chatRunContext.view_id,
        )

        updated_record = get_record(
            snapshot_id=chatRunContext.session.snapshot_id,
            table_id=table.id.wsId,
            record_id=wsId,
            api_token=chatRunContext.api_token,
        )

        if updated_record:
            update_record_in_context(chatRunContext, table.id.wsId, updated_record)

        return f"Successfully replaced {replace_count} occurrences of {search_value} with {new_value} in the {column.name} field. Record {wsId} now contains an updated suggested value containing the changes."

    except Exception as e:
        error_msg = f"Failed to replace {search_value} with {new_value} in field {column.name} in record {wsId} in table '{table.name}': {str(e)}"
        log_error(
            "Error replacing values in field in record",
            table_name=table.name,
            error=str(e),
        )
        logger.exception(e)
        return error_msg


def define_search_and_replace_field_value_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent], data_scope: Optional[str] = None
):
    """Use this tool when the user wants to perform a search and replace for a word or phrase inside a field of a record."""

    if data_scope == "column":
        logger.info(f"Defining search_and_replace_value_tool for column scope")

        @agent.tool
        async def search_and_replace_value_tool(ctx: RunContext[ChatRunContext], search_value: str, new_value: str) -> str:  # type: ignore
            """
            Search and replace a value in the current field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated field value is stored in the suggested_fields field of the record and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to search and replace a value in the current field in the active record.
            The search_value should be the value to search for and cannot be empty.
            The new_value should be the value to replace the search_value with.

            CRITICAL: The search_value must be a string and cannot be empty. The new_value must be a string and may be empty.

            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            """
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.record_id:
                return unable_to_identify_active_record_error(chatRunContext)

            # get the record and column from the context
            table = get_active_table(chatRunContext)
            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            column = find_column_by_id(table, chatRunContext.column_id)
            if not column:
                return unable_to_identify_active_field_error(chatRunContext)

            wsId = chatRunContext.record_id

            return search_and_replace_field_value_tool_implementation(
                ctx, table, wsId, column, search_value, new_value
            )

    elif data_scope == "record":
        logger.info(f"Defining search_and_replace_field_value_tool for record scope")

        @agent.tool
        async def search_and_replace_field_value_tool(ctx: RunContext[ChatRunContext], field_name: str, search_value: str, new_value: str) -> str:  # type: ignore
            """
            Search and replace a value in a specific field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated field value is stored in the suggested_fields field of the record and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to search and replace a value in a specific field in the active record.

            The field_name should be the name of the field to search and replace in.
            The search_value should be the value to search for and cannot be empty.
            The new_value should be the value to replace the search_value with.

            CRITICAL: The search_value must be a string and cannot be empty. The new_value must be a string and may be empty.

            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            """
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.record_id:
                return unable_to_identify_active_record_error(chatRunContext)

            # get the record and column from the context
            table = get_active_table(chatRunContext)
            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            column = find_column_by_name(table, field_name)
            if not column:
                return unable_to_identify_active_field_error(chatRunContext)

            wsId = chatRunContext.record_id

            return search_and_replace_field_value_tool_implementation(
                ctx, table, wsId, column, search_value, new_value
            )

    else:
        logger.info(f"Defining search_and_replace_field_value_tool for table scope")

        @agent.tool
        async def search_and_replace_field_value_tool(ctx: RunContext[ChatRunContext], input_data: SearchAndReplaceInFieldInput) -> str:  # type: ignore
            """
            Use this tool when the user wants to perform a search and replace for a word or phrase inside a field of a record. All occurrences of the search_value will be replaced with the new_value.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated field value is stored in the suggested_fields field of the record and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to replace a value in a field of a record
            The wsId should be the ID of the record to update.
            The field_name should be the name of the field to modify.
            The search_value should be the value to search for and cannot be empty
            The new_value should be the value to replace the search_value with.

            CRITICAL: The search_value must be a string and cannot be empty. The new_value must be a string and may be empty.

            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).
            """
            # Extract data from input
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

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.snapshot:
                return unable_to_identify_active_snapshot_error(chatRunContext)

            # Find the active table
            table = get_active_table(chatRunContext)
            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            column = find_column_by_name(table, field_name)
            if not column:
                return missing_field_error(table, field_name)

            return search_and_replace_field_value_tool_implementation(
                ctx, table, wsId, column, search_value, new_value
            )
