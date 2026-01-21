#!/usr/bin/env python3
"""
write tool - Write content to a file
"""
from logging import getLogger

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class WriteInput(BaseModel):
    """Input for the write tool"""

    path: str = Field(
        description="The full path for the file, e.g., '/emails/welcome.md'. Creates parent folders if needed.",
    )
    content: str = Field(
        description="The content to write to the file. Overwrites existing content if file exists.",
    )


def define_write_tool(agent: Agent, context_type: type):
    """Define the write tool for the file agent."""

    logger.info("Defining write tool")

    @agent.tool
    async def write(ctx: RunContext, input_data: WriteInput) -> str:
        """
        Write content to a file.

        Similar to `echo "content" > file` or `cat > file`, this creates or overwrites a file.
        - If the file doesn't exist, it will be created
        - If the file exists, its content will be replaced

        Use the full path including the filename.

        Example usage:
        - write(path="/notes/todo.md", content="# TODO\\n- Item 1\\n- Item 2")
        - write(path="/templates/header.html", content="<header>...</header>")

        Returns confirmation of the write operation.
        """
        path = input_data.path
        content = input_data.content
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            logger.info(
                f"write: Writing {len(content)} chars to '{path}' in workbook {workbook_id}"
            )

            # Call the API
            result = ScratchpadApi.write_file(
                user_id=user_id,
                workbook_id=workbook_id,
                path=path,
                content=content,
            )

            file_ref = result
            file_path = file_ref.get("path", path)
            file_id = file_ref.get("id", "unknown")

            # Determine if this was a create or update
            lines = content.split("\n")
            line_count = len(lines)
            char_count = len(content)

            return f"Successfully wrote to {file_path} (ID: {file_id}) ({char_count} characters, {line_count} lines)"

        except ScratchpadApiError as e:
            error_msg = f"Error writing to '{path}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in write: {str(e)}"
            logger.exception(error_msg)
            return error_msg
