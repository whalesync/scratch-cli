#!/usr/bin/env python3
"""
find tool - Search for files by name pattern
"""
from logging import getLogger
from typing import Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class FindInput(BaseModel):
    """Input for the find tool"""

    pattern: str = Field(
        description="Glob pattern for file name. Use * for any characters, ? for single character. Examples: '*.md', 'test*', 'file?.txt'",
    )
    path: str = Field(
        description="Path prefix to search within. Use '/' to search the entire workbook, or a specific folder path.",
    )
    recursive: bool = Field(
        default=True,
        description="If true, search in all subfolders. If false, search only in the specified folder.",
    )


def define_find_tool(agent: Agent, context_type: type):
    """Define the find tool for the file agent."""

    logger.info("Defining find tool")

    @agent.tool
    async def find(ctx: RunContext, input_data: FindInput) -> str:
        """
        Find files matching a name pattern.

        Similar to the Unix `find` command, this searches for files by name.
        Supports glob patterns:
        - * matches any characters (e.g., "*.md" matches all markdown files)
        - ? matches a single character (e.g., "file?.txt" matches file1.txt, fileA.txt)

        Optionally restrict the search to a specific folder path.

        Example usage:
        - find(pattern="*.md", path="/") - Find all markdown files in the entire workbook
        - find(pattern="test*", path="/") - Find files starting with "test"
        - find(pattern="*.html", path="/templates") - Find HTML files in templates folder
        """
        pattern = input_data.pattern
        path = input_data.path
        recursive = input_data.recursive
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            search_desc = f"pattern '{pattern}'"
            if path:
                search_desc += f" in '{path}'"

            search_desc += f" ({'recursive' if recursive else 'non-recursive'})"

            logger.info(f"find: Searching for {search_desc} in workbook {workbook_id}")

            # Call the API
            result = ScratchpadApi.find_files(
                user_id=user_id,
                workbook_id=workbook_id,
                pattern=pattern,
                path=path,
                recursive=recursive,
            )

            items = result.get("items", [])

            if not items:
                return f"No files found matching {search_desc}."

            # Format output
            lines = [f"Found {len(items)} file(s) matching {search_desc}:", ""]

            for item in items:
                file_path = item.get("path", "unknown")
                name = item.get("name", "unknown")
                file_id = item.get("id", "unknown")
                dirty = item.get("dirty", False)

                status = " [modified]" if dirty else ""
                lines.append(f"  {file_path} (ID: {file_id}){status}")

            return "\n".join(lines)

        except ScratchpadApiError as e:
            error_msg = f"Error finding files with pattern '{pattern}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in find: {str(e)}"
            logger.exception(error_msg)
            return error_msg
