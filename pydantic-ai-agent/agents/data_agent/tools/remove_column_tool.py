from agents.data_agent.models import (
    ChatRunContext,
    ResponseFromAgent,
)
from agents.data_agent.model_utils import (
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
from scratchpad.api import ScratchpadApi
from scratchpad.entities import ColumnSpec, TableSpec, RecordOperation

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolReturn
from logger import log_info, log_error
from logging import getLogger
import requests


logger = getLogger(__name__)


def define_remove_column_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Use this tool when the user wants to remove a scratch column from the active table."""

    @agent.tool
    async def remove_column_tool(ctx: RunContext[ChatRunContext], column_id: str) -> ToolReturn:  # type: ignore
        """
        Remove a scratch column from the active table.

        Use this tool when the user wants to remove a scratch column from the table.
        The column_id should be the wsID of the table
        Do not call this tool with an empty column_id.
        column_id should be for a scratch column in the table.
        """
        try:
            chatRunContext: ChatRunContext = ctx.deps

            if not column_id:
                return "Error: column_id cannot be empty"

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."

            # Find the active table
            table = get_active_table(chatRunContext)

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            log_info(
                "Removing scratch column from table",
                table_name=table.name,
                table_id=table.id.wsId,
                column_id=column_id,
                snapshot_id=chatRunContext.session.snapshot_id,
            )

            column = find_column_by_id(table, column_id)
            if not column:
                return f"Error: column_id {column_id} not found in table {table.name}. The column_id must be a scratch column in the table."

            if column.metadata is None or not column.metadata.get("scratch"):
                return f"Error: column_id {column_id} is not a scratch column in the table {table.name}. The column_id must be a scratch column in the table."

            ScratchpadApi.remove_scratch_column(
                user_id=chatRunContext.user_id,
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                column_id=column_id,
            )

            # Return the success message
            return f"Successfully removed the column {column.name} from the table {table.name}"

        except Exception as e:
            error_msg = f"Unexpected error removing column from table"
            log_error(
                error_msg,
                table_name=table.name,
                table_id=table.id.wsId,
                column_id=column_id,
                snapshot_id=chatRunContext.session.snapshot_id,
                error=str(e),
            )
            logger.exception(error_msg)
            return f"Error: Unexpected error occurred removing column from table. You may retry the request."
