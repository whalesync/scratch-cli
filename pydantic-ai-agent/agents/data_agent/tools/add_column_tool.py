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


def define_add_column_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Use this tool when the user wants to add a scratch column to the active table."""

    @agent.tool
    async def add_column_tool(ctx: RunContext[ChatRunContext], column_name: str, data_type: str) -> ToolReturn:  # type: ignore
        """
        Create a new scratch column in the active table.

        Use this tool when the user wants to add a scratch column to the table.
        The column_name should be a valid display name for the column and cannot be empty.
        The data_type should be one of the following values: text, numeric, boolean, timestamp.
        Do not call this tool with an empty column_name or data_type.
        column_name should not be the same as any of the existing columns in the table.
        column_name should not start with any special characters or underscores.
        """
        try:
            chatRunContext: ChatRunContext = ctx.deps

            if not column_name:
                return "Error: column_name cannot be empty"

            if column_name.startswith(("_", "-", ".", " ")):
                return "Error: column_name cannot start with any special characters or underscores"

            if not data_type:
                return "Error: data_type cannot be empty"

            if data_type not in ["text", "numeric", "boolean"]:
                return "Error: data_type must be one of the following values: text, numeric, boolean, timestamp"

            # Get the active snapshot
            chatRunContext: ChatRunContext = ctx.deps

            if not chatRunContext.snapshot:
                return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."

            # Find the active table
            table = get_active_table(chatRunContext)

            if not table:
                return unable_to_identify_active_table_error(chatRunContext)

            log_info(
                "Adding scratch column to table",
                data_type=data_type,
                table_name=table.name,
                table_id=table.id.wsId,
                column_name=column_name,
                snapshot_id=chatRunContext.session.snapshot_id,
            )

            if column_name in [c.name for c in table.columns]:
                return f"Error: column_name {column_name} already exists in the table"

            ScratchpadApi.add_scratch_column(
                user_id=chatRunContext.user_id,
                snapshot_id=chatRunContext.session.snapshot_id,
                table_id=table.id.wsId,
                column_name=column_name,
                data_type=data_type,
            )

            # Return the success message
            return (
                f"Successfully added the column {column_name} to the table {table.name}"
            )

        except Exception as e:
            error_msg = f"Unexpected error adding column to table"
            log_error(
                error_msg,
                table_name=table.name,
                table_id=table.id.wsId,
                column_name=column_name,
                data_type=data_type,
                snapshot_id=chatRunContext.session.snapshot_id,
                error=str(e),
            )
            logger.exception(error_msg)
            return f"Error: Unexpected error occurred adding column to table. You may retry the request."
