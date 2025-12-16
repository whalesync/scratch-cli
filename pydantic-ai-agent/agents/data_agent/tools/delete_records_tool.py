#!/usr/bin/env python3
"""
Delete Records Tool for the Data Agent
"""
from logging import getLogger
from typing import List

from agents.data_agent.model_utils import (
    get_active_table,
    unable_to_identify_active_snapshot_error,
    unable_to_identify_active_table_error,
)
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from logger import log_error, log_info
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi
from scratchpad.entities import RecordOperation

logger = getLogger(__name__)


def define_delete_records_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Delete records from the active table in the current snapshot by their record IDs."""

    @agent.tool
    async def delete_records_tool(ctx: RunContext[ChatRunContext], record_ids: List[str]) -> str:  # type: ignore
        """
        Delete one or more records from the active table by their record IDs.

        Use this tool when the user asks to delete records from the active table.
        The record_ids should be a list of record IDs (wsId) to delete.
        """
        table_name = None
        try:
            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.workbook:
                return unable_to_identify_active_snapshot_error(chatRunContext)

            # Find the table by name
            table = get_active_table(chatRunContext)
            table_name = table.name

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            # Validate that record_ids is provided
            if not record_ids:
                return "Error: No record IDs provided. Please provide a list of record IDs to delete."

            # Create RecordOperation objects for delete operations
            delete_operations = []
            for record_id in record_ids:
                if not isinstance(record_id, str):
                    return f"Error: Record ID must be a string, got {type(record_id)}"

                # Create proper RecordOperation objects for delete
                delete_operations.append(
                    RecordOperation(
                        op="delete",
                        wsId=record_id,
                        data=None,  # No data needed for delete operations
                    )
                )

            log_info(
                "Deleting records via bulk update",
                table_name=table_name,
                table_id=table.id,
                record_count=len(delete_operations),
                workbook_id=chatRunContext.session.workbook_id,
            )

            # Call the bulk update endpoint
            ScratchpadApi.bulk_suggest_record_updates(
                user_id=chatRunContext.user_id,
                workbook_id=chatRunContext.session.workbook_id,
                table_id=table.id,
                operations=delete_operations,
            )

            logger.info(
                f"✅ Successfully deleted {len(delete_operations)} records from table '{table_name}'"
            )

            log_info(
                "Successfully deleted records",
                table_name=table_name,
                table_id=table.id,
                record_count=len(delete_operations),
                workbook_id=chatRunContext.session.workbook_id,
            )

            return f"Successfully deleted {len(delete_operations)} records from table '{table_name}'. Deleted record IDs: {record_ids}"

        except Exception as e:
            error_msg = f"Failed to delete records from table '{table_name}': {str(e)}"
            log_error("Error deleting records", table_name=table_name, error=str(e))
            logger.exception(e)
            return error_msg
