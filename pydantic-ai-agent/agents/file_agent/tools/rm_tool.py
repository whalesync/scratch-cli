#!/usr/bin/env python3
"""
rm tool - Delete a file
"""
from logging import getLogger

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class RmInput(BaseModel):
    """Input for the rm tool"""

    path: str = Field(
        description="The full path to the file to delete, e.g., '/emails/old-draft.md'",
    )


def define_rm_tool(agent: Agent, context_type: type):
    """Define the rm tool for the file agent."""

    logger.info("Defining rm tool")

    @agent.tool
    async def rm(ctx: RunContext, input_data: RmInput) -> str:
        """
        Delete a file.

        Similar to the Unix `rm` command, this removes a file from the workbook.
        Use the full path including the filename.

        WARNING: This operation cannot be undone. The file will be permanently deleted.

        Example usage:
        - rm(path="/drafts/old-email.md") - Delete a specific file
        - rm(path="/temp/test.txt") - Remove a temporary file

        Returns confirmation of the deletion.
        """
        path = input_data.path
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            logger.info(f"rm: Deleting file at '{path}' in workbook {workbook_id}")

            # Call the API
            ScratchpadApi.delete_file(
                user_id=user_id,
                workbook_id=workbook_id,
                path=path,
            )

            return f"Successfully deleted {path}"

        except ScratchpadApiError as e:
            error_msg = f"Error deleting '{path}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in rm: {str(e)}"
            logger.exception(error_msg)
            return error_msg
