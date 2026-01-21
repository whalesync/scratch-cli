#!/usr/bin/env python3
"""
cat tool - Display file contents
"""
from logging import getLogger
from typing import Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class CatInput(BaseModel):
    """Input for the cat tool"""

    path: str = Field(
        description="The full path to the file, e.g., '/emails/welcome.md'",
    )
    max_lines: Optional[int] = Field(
        default=None,
        description="Maximum number of lines to return. If not specified, returns entire file.",
    )


def define_cat_tool(agent: Agent, context_type: type):
    """Define the cat tool for the file agent."""

    logger.info("Defining cat tool")

    @agent.tool
    async def cat(ctx: RunContext, input_data: CatInput) -> str:
        """
        Display the contents of a file.

        Similar to the Unix `cat` command, this shows the full content of a file.
        Use the full path including the filename.

        Returns:
        - The file content
        - File metadata (path, created/updated timestamps)

        Example usage:
        - cat(path="/emails/welcome.md") - Show contents of welcome.md
        - cat(path="/templates/header.html", max_lines=50) - Show first 50 lines
        """
        path = input_data.path
        max_lines = input_data.max_lines
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            logger.info(f"cat: Reading file at path '{path}' in workbook {workbook_id}")

            # Call the API
            result = ScratchpadApi.get_file_by_path(
                user_id=user_id,
                workbook_id=workbook_id,
                path=path,
            )

            file_data = result.get("file", {})
            ref = file_data.get("ref", {})
            content = file_data.get("content") or ""
            original_content = file_data.get("originalContent")
            suggested_content = file_data.get("suggestedContent")
            created_at = file_data.get("createdAt", "unknown")
            updated_at = file_data.get("updatedAt", "unknown")

            # Build output
            lines = []
            lines.append(f"=== {ref.get('path', path)} ===")
            lines.append(f"File ID: {ref.get('id', 'unknown')}")
            lines.append(f"Created: {created_at}")
            lines.append(f"Updated: {updated_at}")

            # Show status indicators
            status_parts = []
            if original_content is not None and content != original_content:
                status_parts.append("modified")
            if suggested_content:
                status_parts.append("has suggestions")
            if status_parts:
                lines.append(f"Status: {', '.join(status_parts)}")

            lines.append("")
            lines.append("--- Content ---")

            # Handle content truncation
            content_lines = content.split("\n") if content else ["(empty file)"]

            if max_lines and len(content_lines) > max_lines:
                lines.extend(content_lines[:max_lines])
                lines.append("")
                lines.append(
                    f"... ({len(content_lines) - max_lines} more lines, use max_lines=None to see all)"
                )
            else:
                lines.extend(content_lines)

            return "\n".join(lines)

        except ScratchpadApiError as e:
            error_msg = f"Error reading file '{path}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in cat: {str(e)}"
            logger.exception(error_msg)
            return error_msg
