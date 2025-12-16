#!/usr/bin/env python3
from logging import getLogger
from typing import List, Union

from agents.data_agent.data_agent_utils import format_records_for_prompt
from agents.data_agent.model_utils import unable_to_identify_active_snapshot_error
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from logger import log_error, log_info
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolReturn
from scratchpad.api import ScratchpadApi

logger = getLogger(__name__)


class FetchRecordsByIdsInput(BaseModel):
    """
    Input for the fetch_records_by_ids tool
    """

    table_id: str = Field(
        description="The ID (wsId) of the table to fetch records from"
    )
    record_ids: List[str] = Field(
        description="List of record IDs (wsIds) to fetch from the table"
    )


def fetch_records_by_ids_tool_implementation(
    ctx: RunContext[ChatRunContext],
    table_id: str,
    record_ids: List[str],
) -> Union[str, ToolReturn]:
    """Fetch specific records by their IDs from a table in the active snapshot."""
    try:
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.workbook:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        # Validate record_ids
        if not record_ids or len(record_ids) == 0:
            return "Error: record_ids list cannot be empty. Please provide at least one record ID."

        if len(record_ids) > 100:
            return "Error: Cannot fetch more than 100 records at once. Please split your request into multiple calls."

        # Find the table by ID
        table = None
        for t in chatRunContext.workbook.tables:
            if t.id.wsId == table_id:
                table = t
                break

        if not table:
            return f"Error: Table with ID '{table_id}' not found in the current snapshot. Available tables: {', '.join([t.id.wsId for t in chatRunContext.workbook.tables])}"

        log_info(
            "Fetching records by IDs",
            table_name=table.name,
            table_id=table.id,
            record_count=len(record_ids),
            workbook_id=chatRunContext.session.workbook_id,
        )

        # Fetch records using the API
        fetched_snapshot_records = ScratchpadApi.get_records_by_ids(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            record_ids=record_ids,
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
            for record in fetched_snapshot_records
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
        logger.info(
            f"📊 Requested IDs: {len(record_ids)}, Found: {len(fetched_records)}"
        )

        log_info(
            "Successfully fetched records by IDs",
            table_name=table.name,
            table_id=table.id,
            requested_count=len(record_ids),
            found_count=len(fetched_records),
            new_records_added=len(new_records),
            workbook_id=chatRunContext.session.workbook_id,
        )

        if len(fetched_records) == 0:
            return f"No records found with the provided IDs in table '{table.name}' (ID: {table_id}). Requested IDs: {', '.join(record_ids)}"

        # Check if some records were not found
        found_ids = {r.get("id", {}).get("wsId") for r in fetched_records}
        missing_ids = [rid for rid in record_ids if rid not in found_ids]

        # Format records for display
        # Determine columns to exclude based on table context
        columns_to_exclude = []

        records_summary = format_records_for_prompt(
            fetched_records,
            limit=len(fetched_records),
            truncate_record_content=True,
            columns_to_exclude=columns_to_exclude,
        )

        # Build summary for history cleanup
        found_ids = {r.get("id", {}).get("wsId") for r in fetched_records}
        summary = f"Fetched {len(fetched_records)} records by ID from table '{table.name}' (ID: {table_id})"
        if found_ids:
            # Truncate ID list if too many
            id_list = list(found_ids)
            if len(id_list) <= 5:
                summary += f": {', '.join(id_list)}"
            else:
                summary += f": {', '.join(id_list[:5])}... ({len(id_list)} total)"
        if missing_ids:
            summary += f", {len(missing_ids)} IDs not found"

        # Create structured response as JSON string with data field that can be cleaned up
        import json

        response_data = {
            "summary": summary,
            "table_id": table_id,
            "table_name": table.name,
            "requested_count": len(record_ids),
            "found_count": len(fetched_records),
            "missing_count": len(missing_ids),
            "found_ids": list(found_ids),
            "missing_ids": missing_ids,
            "data": records_summary,
        }

        return ToolReturn(
            return_value=json.dumps(response_data, indent=2),
            metadata={
                "is_data_fetch": True,
                "tool_type": "fetch_records_by_ids",
            },
        )

    except Exception as e:
        error_msg = f"Failed to fetch records by IDs from table '{table_id}': {str(e)}"
        log_error(
            "Error fetching records by IDs",
            table_id=table_id,
            error=str(e),
        )
        logger.exception(e)
        return error_msg


def define_fetch_records_by_ids_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Define the fetch_records_by_ids tool for the agent."""

    logger.info("Defining fetch_records_by_ids_tool")

    @agent.tool
    async def fetch_records_by_ids_tool(
        ctx: RunContext[ChatRunContext], input_data: FetchRecordsByIdsInput
    ) -> Union[str, ToolReturn]:  # type: ignore
        """
        Fetch specific records by their IDs from a table in the active snapshot.

        Use this tool when the user mentions specific record IDs and you need to fetch those exact records.
        This is useful when:
        - The user references specific records by ID (e.g., "show me records user_123, user_456")
        - You need to fetch a subset of records that you already know the IDs for
        - You want to get the latest data for specific records

        The tool will fetch the records from the snapshot database and add them to your context.

        Parameters:
        - table_id: The ID (wsId) of the table to fetch records from (required)
        - record_ids: List of record IDs (wsIds) to fetch (required, max 100 IDs per call)

        Example usage:
        - To fetch specific users: table_id="users", record_ids=["user_123", "user_456"]
        - To fetch a single record: table_id="orders", record_ids=["order_789"]
        - To fetch multiple records: table_id="products", record_ids=["prod_1", "prod_2", "prod_3"]

        Returns a formatted list of the fetched records, with a note if any requested IDs were not found.
        """
        # Extract data from input
        table_id = input_data.table_id
        record_ids = input_data.record_ids

        return fetch_records_by_ids_tool_implementation(ctx, table_id, record_ids)
