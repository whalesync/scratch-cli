#!/usr/bin/env python3
from logging import getLogger
from typing import Optional, Union

from agents.data_agent.data_agent_utils import format_records_for_prompt
from agents.data_agent.model_utils import unable_to_identify_active_snapshot_error
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from logger import log_error, log_info
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolReturn
from scratchpad.api import ScratchpadApi

logger = getLogger(__name__)


class FetchAdditionalRecordsInput(BaseModel):
    """
    Input for the fetch_additional_records tool
    """

    table_id: str = Field(
        description="The ID (wsId) of the table to fetch additional records from"
    )
    limit: Optional[int] = Field(
        default=50,
        description="The maximum number of records to retrieve (default: 50, max: 200)",
    )
    cursor: Optional[str] = Field(
        default=None,
        description="The cursor (record ID) to start fetching from. Use the nextCursor from previous fetch to paginate. Leave empty for first page.",
    )


def fetch_additional_records_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table_id: str,
    limit: int = 50,
    cursor: Optional[str] = None,
) -> Union[str, ToolReturn]:
    """Fetch additional records from a table in the active snapshot."""
    try:
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.workbook:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        # Validate limit
        if limit < 1:
            return "Error: limit must be at least 1"
        if limit > 200:
            return "Error: limit cannot exceed 200 records. If you need more records, make multiple calls with different cursor values."

        # Find the table by ID
        table = None
        for t in chatRunContext.workbook.tables:
            if t.id == table_id:
                table = t
                break

        if not table:
            return f"Error: Table with ID '{table_id}' not found in the current snapshot. Available tables: {', '.join([t.id for t in chatRunContext.workbook.tables])}"

        log_info(
            "Fetching additional records",
            table_name=table.name,
            table_id=table.id,
            limit=limit,
            cursor=cursor,
            workbook_id=chatRunContext.session.workbook_id,
        )

        # Fetch records using the API
        records_result = ScratchpadApi.list_records_for_ai(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            cursor=cursor,
            take=limit,
        )

        # Convert records to the format expected by the context
        fetched_records = [
            {
                "id": {
                    "wsId": record.id.wsId,
                    "remoteId": record.id.remoteId,
                },
                "fields": record.fields,
                "suggested_fields": record.suggested_fields,
                "edited_fields": record.edited_fields,
                "dirty": record.dirty,
            }
            for record in records_result.records
        ]

        # Update the preloaded records in the context
        if table.name not in chatRunContext.preloaded_records:
            chatRunContext.preloaded_records[table.name] = []

        # Add newly fetched records to the context (avoid duplicates)
        existing_ids = {
            r.get("id", {}).get("wsId")
            for r in chatRunContext.preloaded_records[table.name]
        }
        new_records = [
            r
            for r in fetched_records
            if r.get("id", {}).get("wsId") not in existing_ids
        ]

        chatRunContext.preloaded_records[table.name].extend(new_records)

        logger.info(
            f"✅ Successfully fetched {len(fetched_records)} records from table '{table.name}'"
        )
        logger.info(f"📋 Table ID: {table.id}")
        logger.info(f"📊 Limit: {limit}, Cursor: {cursor}")

        log_info(
            "Successfully fetched additional records",
            table_name=table.name,
            table_id=table.id,
            records_fetched=len(fetched_records),
            new_records_added=len(new_records),
            next_cursor=records_result.nextCursor,
            workbook_id=chatRunContext.session.workbook_id,
        )

        if len(fetched_records) == 0:
            return f"No additional records found in table '{table.name}' (ID: {table_id}) starting from cursor {cursor} with limit {limit}."

        # Format records for display
        # Determine columns to exclude based on table context
        columns_to_exclude = []

        records_summary = format_records_for_prompt(
            fetched_records,
            limit=limit,
            truncate_record_content=True,
            columns_to_exclude=columns_to_exclude,
        )

        # Build summary for history cleanup
        summary = f"Fetched {len(fetched_records)} records from table '{table.name}' (ID: {table_id})"
        if cursor:
            summary += f", starting from cursor: {cursor}"
        if records_result.nextCursor:
            summary += f", next cursor available: {records_result.nextCursor}"
        else:
            summary += ", reached end of table"

        # Create structured response as JSON string with data field that can be cleaned up
        import json

        response_data = {
            "summary": summary,
            "table_id": table_id,
            "table_name": table.name,
            "cursor": cursor or "None (first page)",
            "next_cursor": records_result.nextCursor,
            "limit": limit,
            "records_fetched": len(fetched_records),
            "data": records_summary,
        }

        return ToolReturn(
            return_value=json.dumps(response_data, indent=2),
            metadata={
                "is_data_fetch": True,
                "tool_type": "fetch_additional_records",
            },
        )

    except Exception as e:
        error_msg = (
            f"Failed to fetch additional records from table '{table_id}': {str(e)}"
        )
        log_error(
            "Error fetching additional records",
            table_id=table_id,
            error=str(e),
        )
        logger.exception(e)
        return error_msg


def define_fetch_additional_records_tool(
    agent: Agent[ChatRunContext, ResponseFromAgent],
):
    """Define the fetch_additional_records tool for the agent."""

    logger.info("Defining fetch_additional_records_tool")

    @agent.tool
    async def fetch_additional_records_tool(
        ctx: RunContext[ChatRunContext], input_data: FetchAdditionalRecordsInput
    ) -> Union[str, ToolReturn]:  # type: ignore
        """
        Fetch additional records from a table in the active snapshot.

        Use this tool when you need more records than were initially provided in the snapshot context.
        This is useful when:
        - The user asks about records that aren't in the initial data
        - You need to see more data to complete a task
        - You need to paginate through a large table
        - You see a note that only sample records were loaded for a non-active table

        The tool will fetch records and add them to your context, so you can reference them in subsequent operations.

        Parameters:
        - table_id: The ID (wsId) of the table to fetch records from (required)
        - limit: Maximum number of records to fetch (default: 50, max: 200)
        - cursor: Cursor (record ID) to start fetching from. Leave empty for first page, use nextCursor from previous response to get next page.

        Example usage:
        - To fetch first 50 records from "users" table: table_id="users", limit=50
        - To fetch next page: table_id="users", limit=50, cursor="user_123" (use nextCursor from previous response)
        - To fetch records from a non-active table: table_id="orders", limit=10

        Returns a formatted list of the fetched records and a nextCursor if more pages are available.
        """
        # Extract data from input
        table_id = input_data.table_id
        limit = input_data.limit or 50
        cursor = input_data.cursor

        return fetch_additional_records_tool_implementation(
            ctx, table_id, limit, cursor
        )
