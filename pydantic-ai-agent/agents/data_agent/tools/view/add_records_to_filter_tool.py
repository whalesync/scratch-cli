#!/usr/bin/env python3
"""
Add Records to Filter Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agents.data_agent.model_utils import (
    get_active_table,
    unable_to_identify_active_table_error,
)
from typing import List, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from logger import log_error
from scratchpad.api import ScratchpadApi
from logging import getLogger

logger = getLogger(__name__)


class AddRecordsToFilterInput(BaseModel):
    """
    Input for the add_records_to_filter_tool
    """

    record_ids: List[str] = Field(
        description="List of record IDs (wsId) to add to the filter"
    )


def define_add_records_to_filter_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent],
    capabilities: Optional[List[str]] = None,
):
    """Add records to the current record filter for the active table in the current snapshot."""

    @agent.tool
    async def add_records_to_filter_tool(ctx: RunContext[ChatRunContext], input_data: AddRecordsToFilterInput) -> str:  # type: ignore
        """
        Add records to the current record filter for the active table in the current snapshot.

        Use this tool when the user asks to filter out specific records from a table or hide records from view.
        The record_ids should be a list of record IDs (wsId) to add to the filter.

        CRITICAL: The record_ids must be a list of strings and cannot be empty. The list should not contain duplicate values. The list should not contain empty values.

        IMPORTANT: Only call this tool ONCE per table per conversation. Collect all records you want to filter
        and add them in a single call rather than making multiple calls for the same table.

        Do not use this tool if there are no records to filter.
        """
        table_name = None
        try:
            # Extract data from input
            record_ids = input_data.record_ids

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."

            # Find the table by name
            table = get_active_table(chatRunContext)

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            table_name = table.name

            # Validate that record_ids is provided
            if not record_ids:
                return "Error: No record IDs provided. Please provide a list of record IDs to add to the filter."

            # Call the add_records_to_active_filter API
            ScratchpadApi.add_records_to_active_filter(
                user_id=chatRunContext.user_id,
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                record_ids=record_ids,
            )

            return (
                f"Successfully filtered out {len(record_ids)} records from the table."
            )

        except Exception as e:
            error_msg = (
                f"Failed to add records to filter for table '{table_name}': {str(e)}"
            )
            log_error(
                "Error adding records to filter", table_name=table_name, error=str(e)
            )
            logger.exception(e)
            return error_msg
