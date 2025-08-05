#!/usr/bin/env python3
"""
Clear Record Filter Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agents.data_agent.model_utils import (
    get_active_table,
    unable_to_identify_active_table_error,
)
from typing import Optional, List
from pydantic_ai import Agent, RunContext
from logger import log_error
from scratchpad_api import clear_active_record_filter


def define_clear_record_filter_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent],
    capabilities: Optional[List[str]] = None,
):
    """Clear the active record filter for the active table in the current snapshot."""

    @agent.tool
    async def clear_record_filter_tool(ctx: RunContext[ChatRunContext]) -> str:  # type: ignore
        """
        Clear the active record filter for the active table in the current snapshot.

        Use this tool when the user asks to clear the record filter for a table or show all records again.

        Do not use this tool if there is no active record filter for the table.
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

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            table_name = table.name

            # Call the clear_active_record_filter API
            clear_active_record_filter(
                chatRunContext.session.snapshot_id,
                table.id.wsId,
                chatRunContext.api_token,
            )

            return f"Successfully cleared the record filter for table '{table_name}'."

        except Exception as e:
            error_msg = (
                f"Failed to clear record filter for table '{table_name}': {str(e)}"
            )
            log_error(
                "Error clearing record filter", table_name=table_name, error=str(e)
            )
            print(f"❌ {error_msg}")
            return error_msg
