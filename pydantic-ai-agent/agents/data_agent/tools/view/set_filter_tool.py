#!/usr/bin/env python3
"""
Set Filter Tool for the Data Agent
"""
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from agents.data_agent.model_utils import (
    get_active_table,
    unable_to_identify_active_table_error,
)
from typing import Optional, List
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from logger import log_error
from scratchpad_api import set_active_records_filter


class SetFilterInput(BaseModel):
    """
    Input for the set_filter_tool
    """

    sql_where_clause: Optional[str] = Field(
        description="SQL WHERE clause to apply as a filter. Leave empty or null to clear the filter.",
        default=None,
    )


def define_set_filter_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent],
    capabilities: Optional[List[str]] = None,
):
    """Set or clear the active record filter for the active table in the current snapshot using SQL WHERE clauses."""

    @agent.tool
    async def set_filter_tool(ctx: RunContext[ChatRunContext], input_data: SetFilterInput) -> str:  # type: ignore
        """
        Set or clear the active record filter for the active table in the current snapshot using SQL WHERE clauses.

        Use this tool when the user asks to:
        - Filter records using SQL conditions (e.g., "show only records where status = 'active'")
        - Clear the current filter (e.g., "show all records", "clear the filter")
        - Apply complex filtering logic using SQL WHERE clauses

        The sql_where_clause should be a valid SQL WHERE clause **without** the "WHERE" keyword.
        You can only provide the content for a `WHERE` clause. You **cannot** use `ORDER BY` or `LIMIT` at the top level of the clause.
        However, you **can** use `ORDER BY` and `LIMIT` within a subquery.
        When referring to the current active table in subqueries, use the fully qualified format `"{snapshot_id}"."{wsId}"`. Do not use the display name of the table.
        When filtering by record identifiers, use the `"wsId"` column, not `id`.
        Examples:
        - "status = 'active'"
        - "\"wsId\" IN ('sre_AJqpyocH4L', 'sre_00d4vQEF9u')"
        - "age > (SELECT MAX(age) FROM \"{snapshot_id}\".\"{wsId}\")"
        - "id IN (SELECT id FROM \"{snapshot_id}\".\"{wsId}\" ORDER BY age DESC LIMIT 2)"
        - "name LIKE '%john%'"
        - "priority IN ('high', 'critical')"

        To clear the filter, pass null or an empty string for sql_where_clause.

        IMPORTANT: Only call this tool ONCE per table per conversation. If you need to modify the filter,
        call this tool again with the new SQL clause rather than making multiple calls.
        """
        table_name = None
        try:
            # Extract data from input
            sql_where_clause = input_data.sql_where_clause

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps
            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."

            # Find the table by name
            table = get_active_table(chatRunContext)

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            table_name = table.name

            # Call the set_active_records_filter API
            set_active_records_filter(
                chatRunContext.session.snapshot_id,
                table.id.wsId,
                sql_where_clause,
                chatRunContext.api_token,
            )

            if sql_where_clause:
                return f"Successfully applied SQL filter to table '{table_name}': {sql_where_clause}"
            else:
                return f"Successfully cleared the filter for table '{table_name}'."

        except Exception as e:
            error_msg = f"Failed to set filter for table '{table_name}': {str(e)}"
            log_error(
                "Error setting filter",
                table_name=table_name,
                sql_where_clause=(
                    sql_where_clause if "sql_where_clause" in locals() else None
                ),
                error=str(e),
            )
            print(f"❌ {error_msg}")
            return error_msg
