#!/usr/bin/env python3
"""
Insert Value Tool for the Data Agent
"""
from agents.data_agent.models import (
    ChatRunContext,
    ResponseFromAgent,
)
from agents.data_agent.model_utils import (
    find_record_by_wsId,
    missing_field_error,
    find_column_by_name,
    find_column_by_id,
    get_active_table,
    unable_to_identify_active_snapshot_error,
    unable_to_identify_active_table_error,
    unable_to_identify_active_field_error,
    unable_to_identify_active_record_error,
    record_not_in_context_error,
    update_record_in_context,
)
from typing import Optional
from pydantic import Field, BaseModel
from pydantic_ai import Agent, RunContext
from logger import log_info, log_error
from scratchpad.api import ScratchpadApi
from scratchpad.entities import ColumnSpec, TableSpec, RecordOperation
from logging import getLogger

logger = getLogger(__name__)


class InsertFieldValueInput(BaseModel):
    """
    Input for the insert_value_tool
    """

    wsId: str = Field(description="The ID of the record to update")
    field_name: str = Field(description="The name of the field to insert a value into")
    value: str = Field(description="The data value to insert into the field")


def insert_value_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table: TableSpec,
    wsId: str,
    column: ColumnSpec,
    value: str,
) -> str:
    """Insert a value into a field in a record in a table at the @@ placeholder marker."""
    try:
        # Validate that value is a string
        if not isinstance(value, str):
            return f"Error: value must be a string, got {type(value)}"

        if value is None or value == "":
            return (
                "Error: The value to insert is empty. Please provide a non-empty value"
            )

        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.workbook:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        log_info(
            "Injecting value into field in record",
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
        # since our tool is inserting a value - modifying part of the data field
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

        placeholder_count = current_value.count("@@")

        if placeholder_count == 0:
            return f"Error: No values inserted. The field {column.name} in record {wsId} does not contain the @@ placeholder marker."

        updated_value = current_value.replace("@@", value)

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

        logger.info(f"✅ Successfully inserted the suggested value into the record")
        logger.info(f"📋 Table ID: {table.id}")
        logger.info(f"✏️ wsId: {wsId}")
        logger.info(f"✏️ Field name: {column.name}")

        log_info(
            "Successfully inserted the suggested value into the record",
            table_name=table.name,
            table_id=table.id,
            wsId=wsId,
            field_name=column.name,
            value=value,
            workbook_id=chatRunContext.session.workbook_id,
        )

        return f"Successfully inserted {value} into the {column.name} field in {placeholder_count} places. Record {wsId} now contains an updated suggested value containing the changes."
    except Exception as e:
        error_msg = f"Failed to insert the suggested value into the field in record in table '{table.name}': {str(e)}"
        log_error(
            "Error inserting the suggested value into the field in record",
            table_name=table.name,
            error=str(e),
        )
        logger.exception(e)
        return error_msg


def define_insert_value_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent], data_scope: Optional[str] = None
):
    """Inserts a value into the an field for a record in a table at the @@ placeholder marker."""

    if data_scope == "column":
        logger.info(f"Defining insert_value_tool for column scope")

        @agent.tool
        async def insert_value_tool(ctx: RunContext[ChatRunContext], value: str) -> str:  # type: ignore
            """
            Insert a value into the current field in the active record at the @@ placeholder marker.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

            Use this tool when the user asks to insert data to the current field in the active record
            Do not use this tool for search and replace operations.
            The value should be the data value to insert into the field.

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

            return insert_value_tool_implementation(ctx, table, wsId, column, value)

    elif data_scope == "record":
        logger.info(f"Defining insert_value_tool for record scope")

        @agent.tool
        async def insert_value_tool(ctx: RunContext[ChatRunContext], field_name: str, value: str) -> str:  # type: ignore
            """
            Insert a value into a specific field in the active record at the @@ placeholder marker.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

            Use this tool when the user asks to insert data to a specific field in the active record
            Do not use this tool for search and replace operations.

            The field_name should be the name of the field to insert a value into.
            The value should be the data value to insert into the field.

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

            column = find_column_by_name(table, field_name)
            if not column:
                return unable_to_identify_active_field_error(chatRunContext)

            wsId = chatRunContext.record_id

            return insert_value_tool_implementation(ctx, table, wsId, column, value)

    else:
        logger.info(f"Defining insert_value_tool for table scope")

        @agent.tool
        async def insert_value_tool(ctx: RunContext[ChatRunContext], input_data: InsertFieldValueInput) -> str:  # type: ignore
            """
            Inserts a value into the an field for a record in a table at the @@ placeholder marker.

            IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

            Use this tool when the user asks to insert data to a single record field
            Do not use this tool for search and replace operations.
            The wsId should be the ID of the record to update.
            The field_name should be the name of the field to insert a value into.
            The value should be the data value to insert into the field.

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

            if wsId is None or wsId == "":
                return "Error: The wsId is empty. Please provide a non-empty wsId"

            # Validate that field_name is a string
            if not isinstance(field_name, str):
                return f"Error: field_name must be a string, got {type(field_name)}"

            if field_name is None or field_name == "":
                return "Error: The field name is empty. Please provide a non-empty field name"

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.workbook:
                return unable_to_identify_active_snapshot_error(chatRunContext)

            # Find the active table
            table = get_active_table(chatRunContext)
            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            column = find_column_by_name(table, field_name)
            if not column:
                return missing_field_error(table, field_name)

            return insert_value_tool_implementation(ctx, table, wsId, column, value)
