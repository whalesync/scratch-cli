#!/usr/bin/env python3
"""
Append Field Value Tool for the Data Agent
"""
from logging import getLogger
from typing import Optional

from agents.data_agent.model_utils import (
    find_column_by_id,
    find_column_by_name,
    get_active_table,
    missing_field_error,
    record_not_in_context_error,
    unable_to_identify_active_field_error,
    unable_to_identify_active_record_error,
    unable_to_identify_active_snapshot_error,
    unable_to_identify_active_table_error,
    update_record_in_context,
)
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from logger import log_error, log_info
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi
from scratchpad.entities import ColumnSpec, RecordOperation, TableSpec

logger = getLogger(__name__)


class AppendFieldValueInput(BaseModel):
    """
    Input for the append_field_value_tool
    """

    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to append a value to")
    value: str = Field(description="The data value to append to the field")


def append_field_value_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table: TableSpec,
    wsId: str,
    column: ColumnSpec,
    value: str,
) -> str:
    """Append a value to a field in a record in a table in the active snapshot."""
    try:
        if value is None or value == "":
            return (
                "Error: The value to append is empty. Please provide a non-empty value"
            )

        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.workbook:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        log_info(
            "Attempt to append value to field in record",
            table_name=table.name,
            table_id=table.id,
            wsId=wsId,
            field_name=column.name,
            value=value,
            workbook_id=chatRunContext.session.workbook_id,
        )

        # Get the record from the preloaded records
        # record = find_record_by_wsId(chatRunContext, table.name, wsId)

        # Get a fresh copy of the record. Tools can run concurrently, and this is a safer
        # way to get the record, not guaranteed to be up to date but should be good enough
        # since our tool is just appending a value.
        record = ScratchpadApi.get_record(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            record_id=wsId,
        )

        if not record:
            return record_not_in_context_error(chatRunContext, wsId)

        if column.id.wsId in record.suggested_fields:
            current_value: str = str(record.suggested_fields[column.id.wsId])
        else:
            current_value: str = str(record.fields[column.id.wsId])

        updated_value = current_value + " " + value

        update_operations = [
            RecordOperation(
                op="update", wsId=wsId, data={column.id.wsId: updated_value}
            )
        ]

        ScratchpadApi.bulk_suggest_record_updates(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            operations=update_operations,
        )

        updated_record = ScratchpadApi.get_record(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            record_id=wsId,
        )

        if updated_record:
            update_record_in_context(chatRunContext, table.id, updated_record)

        log_info(
            "Successfully appended value to field in record",
            table_name=table.name,
            table_id=table.id,
            wsId=wsId,
            field_name=column.name,
            value=value,
            workbook_id=chatRunContext.session.workbook_id,
        )

        return f"Successfully appended the value to the {column.name} field in record {wsId} in table {table.name}"
    except Exception as e:
        error_msg = f"Failed to append value to the {column.name} field in record {wsId} in table {table.name}: {str(e)}"
        log_error(
            "Error appending value to field in record",
            table_name=table.name,
            error=str(e),
        )
        logger.exception(e)
        return error_msg


def define_append_field_value_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent], data_scope: Optional[str] = None
):
    """Append a value to a field in a record in a table in the active snapshot."""

    if data_scope == "column":
        logger.info(f"Defining append_value_tool for column scope")

        @agent.tool
        async def append_value_tool(ctx: RunContext[ChatRunContext], value: str) -> str:  # type: ignore
            """
            Append a value to the current field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated value is stored in the suggested_fields field of the record and require user approval before being applied to the actual record data.

            Use this tool when the user asks to append data to a single record field
            The value should be the data value to append to the field.

            CRITICAL: The value should always be a string and should not be empty.

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

            return append_field_value_tool_implementation(
                ctx, table, wsId, column, value
            )

    elif data_scope == "record":
        logger.info(f"Defining append_field_value_tool for record scope")

        @agent.tool
        async def append_field_value_tool(ctx: RunContext[ChatRunContext], field_name: str, value: str) -> str:  # type: ignore
            """
            Append a value to a specific field in the active record.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated value is stored in the suggested_fields field of the record and require user approval before being applied to the actual record data.

            Use this tool when the user asks to append data to a specific field in the active record.

            The field_name should be the name of the field to append a value to.
            The value should be the data value to append to the field.

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

            return append_field_value_tool_implementation(
                ctx, table, wsId, column, value
            )

    else:
        logger.info(f"Defining append_field_value_tool for table scope")

        @agent.tool
        async def append_field_value_tool(ctx: RunContext[ChatRunContext], input_data: AppendFieldValueInput) -> str:  # type: ignore
            """
            Append a value to a field in a record in a table in the active snapshot.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. The updated value is stored in the suggested_fields field of the record and require user approval before being applied to the actual record data.

            Use this tool when the user asks to append data to a specific field in a specific record.
            The field_name should be the name of the field to append a value to.
            The value should be the data value to append to the field.
            The wsId should be the ID of the record to update.

            CRITICAL: The value should always be a string and should not be empty.

            Note: When reading records later, you'll see both the original values (in the main fields) and any pending suggestions (in the suggested_fields field).

            """
            # Extract data from input
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

            if value is None or value == "":
                return "Error: The value to append is empty. Please provide a non-empty value"

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.workbook:
                return unable_to_identify_active_snapshot_error(chatRunContext)

            table = get_active_table(chatRunContext)
            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            column = find_column_by_name(table, field_name)

            if not column:
                return missing_field_error(table, field_name)

            return append_field_value_tool_implementation(
                ctx, table, wsId, column, value
            )
