#!/usr/bin/env python3
from agents.data_agent.models import (
    ChatRunContext,
    ChatSession,
    ResponseFromAgent,
    WithTableName,
)
from agents.data_agent.model_utils import (
    find_table_by_name,
    find_record_by_wsId,
    is_in_write_focus,
    missing_table_error,
    missing_field_error,
    find_column_by_name,
    find_column_by_id,
    get_active_table,
    unable_to_identify_active_field_error,
    unable_to_identify_active_record_error,
    unable_to_identify_active_table_error,
    record_not_in_context_error,
    not_in_write_focus_error,
    unable_to_identify_active_snapshot_error,
)
from typing import Optional
from pydantic import Field, BaseModel
from pydantic_ai import Agent, RunContext
from scratchpad_api import bulk_update_records, RecordOperation, ColumnSpec, TableSpec
from logger import log_info, log_error


class SetFieldValueInput(BaseModel):
    """
    Input for the set_field_value_tool
    """

    wsId: str = Field(description="The ID of the record to edit")
    field_name: str = Field(description="The name of the field to edit")
    new_value: str = Field(description="The new data value to set in the field")


def set_field_value_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table: TableSpec,
    wsId: str,
    column: ColumnSpec,
    new_value: str,
) -> str:
    """Set a value in a field in a record in a table in the active snapshot."""
    try:
        if new_value is None:
            return "Error: The new value is empty. Please provide a non-empty value"

        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.snapshot:
            return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."

        log_info(
            "Setting value in field in record",
            table_name=table.name,
            table_id=table.id.wsId,
            wsId=wsId,
            field_name=column.name,
            new_value=new_value,
            snapshot_id=chatRunContext.session.snapshot_id,
        )

        # Get the record from the preloaded records
        record = find_record_by_wsId(chatRunContext, table.name, wsId)

        if not record:
            return record_not_in_context_error(chatRunContext, wsId)

        if not is_in_write_focus(chatRunContext, column.id.wsId, wsId):
            return not_in_write_focus_error(chatRunContext, column.id.wsId, wsId)

        if column.id.wsId in record.suggested_fields:
            current_value: str = str(record.suggested_fields[column.id.wsId])
        else:
            current_value: str = str(record.fields[column.id.wsId])

        if current_value == new_value:
            return f"Error: The new value is the same as the current value. No change needed."

        update_operations = [
            RecordOperation(op="update", wsId=wsId, data={column.id.wsId: new_value})
        ]

        bulk_update_records(
            snapshot_id=chatRunContext.session.snapshot_id,
            table_id=table.id.wsId,
            operations=update_operations,
            api_token=chatRunContext.api_token,
            view_id=chatRunContext.view_id,
        )

        print(f"✅ Successfully set the value in the field")
        print(f"📋 Table ID: {table.id.wsId}")
        print(f"✏️ wsId: {wsId}")
        print(f"✏️ Field name: {column.name}")

        log_info(
            "Successfully set the value in the field",
            table_name=table.name,
            table_id=table.id.wsId,
            wsId=wsId,
            field_name=column.name,
            new_value=new_value,
            snapshot_id=chatRunContext.session.snapshot_id,
        )

        return (
            f"Successfully set the value in the {column.name} field in record {wsId}."
        )
    except Exception as e:
        error_msg = f"Failed to set the value in the field in record in table '{table.name}': {str(e)}"
        log_error(
            "Error setting the value in the field in record",
            table_name=table.name,
            error=str(e),
        )
        print(f"❌ {error_msg}")
        return error_msg


def define_set_field_value_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent], data_scope: Optional[str] = None
):
    """Sets a value in a single field for a record in a table."""

    if data_scope == "column":
        print(f"Defining set_value_tool for column scope")

        @agent.tool
        async def set_value_tool(ctx: RunContext[ChatRunContext], new_value: str) -> str:  # type: ignore
            """
            Set a value in the current field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your update is stored in the suggested_fields field and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to set a value in the current field in the active record
            The new_value should be the data value to set in the field.

            CRITICAL: The new_value should always be a string

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
                return unable_to_identify_active_field_error(
                    table, chatRunContext.column_id
                )

            wsId = chatRunContext.record_id

            return set_field_value_tool_implementation(
                ctx, table, wsId, column, new_value
            )

    elif data_scope == "record":
        print(f"Defining set_field_value_tool for record scope")

        @agent.tool
        async def set_field_value_tool(ctx: RunContext[ChatRunContext], field_name: str, new_value: str) -> str:  # type: ignore
            """
            Set a value in a specific field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your update is stored in the suggested_fields field and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to set a value in a specific field in the active record.

            The field_name should be the name of the field to set the value in.
            The new_value should be the data value to set in the field.

            CRITICAL: The new_value should always be a string

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

            return set_field_value_tool_implementation(
                ctx, table, wsId, column, new_value
            )

    else:
        print(f"Defining set_field_value_tool for table scope")

        @agent.tool
        async def set_field_value_tool(ctx: RunContext[ChatRunContext], input_data: SetFieldValueInput) -> str:  # type: ignore
            """
            Sets a value in a single field for a record

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your update is stored in the suggested_fields field and requires user approval before being applied to the actual record data.

            Use this tool when the user asks to set a value in a single field for a record
            The wsId should be the ID of the record to set the value in.
            The field_name should be the name of the field to set the value in.
            The new_value should be the data value to set in the field.

            CRITICAL: The new_value should always be a string

            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).

            """
            # Extract data from input
            wsId = input_data.wsId
            field_name = input_data.field_name
            new_value = input_data.new_value

            # Validate that wsId is a string
            if not isinstance(wsId, str):
                return f"Error: wsId must be a string, got {type(wsId)}"

            if wsId is None or wsId == "":
                return "Error: The wsId is empty. Please provide a non-empty wsId"

            # Validate that field_name is a string
            if not isinstance(field_name, str):
                return f"Error: field_name must be a string, got {type(field_name)}"

            if field_name is None or field_name == "":
                return "Error: The field name is empty. Please provide a non-empty field name"

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

            return set_field_value_tool_implementation(
                ctx, table, wsId, column, new_value
            )
