#!/usr/bin/env python3
"""
grep tool - Search file contents for a pattern
"""
from logging import getLogger
from typing import Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class GrepInput(BaseModel):
    """Input for the grep tool"""

    pattern: str = Field(
        description="Text pattern to search for in file contents. Case-insensitive.",
    )
    path: str = Field(
        description="Path prefix to search within. Use '/' to search the entire workbook, or a specific folder path.",
    )


def define_grep_tool(agent: Agent, context_type: type):
    """Define the grep tool for the file agent."""

    logger.info("Defining grep tool")

    @agent.tool
    async def grep(ctx: RunContext, input_data: GrepInput) -> str:
        """
        Search file contents for a text pattern.

        Similar to the Unix `grep` command, this searches inside files for matching text.
        The search is case-insensitive.

        Returns files containing the pattern along with matching line excerpts.

        Example usage:
        - grep(pattern="TODO", path="/") - Find all files containing "TODO"
        - grep(pattern="error", path="/logs") - Search for "error" in the logs folder
        - grep(pattern="<title>", path="/") - Find files containing HTML title tags
        """
        pattern = input_data.pattern
        path = input_data.path
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            search_desc = f"'{pattern}'"
            if path:
                search_desc += f" in '{path}'"

            logger.info(f"grep: Searching for {search_desc} in workbook {workbook_id}")

            # Call the API
            result = ScratchpadApi.grep_files(
                user_id=user_id,
                workbook_id=workbook_id,
                pattern=pattern,
                path=path,
            )

            matches = result.get("matches", [])

            if not matches:
                return f"No files found containing {search_desc}."

            # Calculate total matches
            total_matches = sum(m.get("matchCount", 0) for m in matches)

            # Format output
            lines = [
                f"Found {total_matches} match(es) in {len(matches)} file(s) for {search_desc}:",
                "",
            ]

            for match in matches:
                file_info = match.get("file", {})
                file_path = file_info.get("path", "unknown")
                file_id = file_info.get("id", "unknown")
                match_count = match.get("matchCount", 0)
                excerpts = match.get("excerpts", [])

                lines.append(
                    f"=== {file_path} (ID: {file_id}, {match_count} matches) ==="
                )
                for excerpt in excerpts:
                    lines.append(f"  {excerpt}")
                lines.append("")

            return "\n".join(lines)

        except ScratchpadApiError as e:
            error_msg = f"Error searching for '{pattern}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in grep: {str(e)}"
            logger.exception(error_msg)
            return error_msg
