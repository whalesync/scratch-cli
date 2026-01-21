#!/usr/bin/env python3
"""
ls tool - List files and folders at a given path
"""
from logging import getLogger
from typing import Union

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from scratchpad.api import ScratchpadApi, ScratchpadApiError

logger = getLogger(__name__)


class LsInput(BaseModel):
    """Input for the ls tool"""

    path: str = Field(
        default="/",
        description="The path to list. Use '/' for root, '/folder-name' for subfolders.",
    )


def define_ls_tool(agent: Agent, context_type: type):
    """Define the ls tool for the file agent."""

    logger.info("Defining ls tool")

    @agent.tool
    async def ls(ctx: RunContext, input_data: LsInput) -> str:
        """
        List files and folders at a given path.

        Similar to the Unix `ls` command, this shows the contents of a directory.
        Use '/' for the root directory, or '/folder-name' for subdirectories.

        Returns a formatted list showing:
        - [D] for directories/folders
        - [F] for files
        - The name and path of each item

        Example usage:
        - ls(path="/") - List root directory
        - ls(path="/emails") - List contents of the 'emails' folder
        """
        path = input_data.path
        deps = ctx.deps

        try:
            # Get workbook_id and user_id from context
            workbook_id = deps.session.workbook_id
            user_id = deps.user_id

            logger.info(f"ls: Listing files at path '{path}' in workbook {workbook_id}")

            # Call the API
            result = ScratchpadApi.list_files_by_path(
                user_id=user_id,
                workbook_id=workbook_id,
                path=path,
            )

            items = result.get("items", [])

            if not items:
                return f"Directory '{path}' is empty or does not exist."

            # Format output like ls
            lines = [f"Contents of {path}:", ""]

            # Sort: folders first, then files, alphabetically
            folders = sorted(
                [i for i in items if i.get("type") == "folder"],
                key=lambda x: x.get("name", "").lower(),
            )
            files = sorted(
                [i for i in items if i.get("type") == "file"],
                key=lambda x: x.get("name", "").lower(),
            )

            for folder in folders:
                name = folder.get("name", "unknown")
                folder_id = folder.get("id", "unknown")
                folder_path = folder.get("path", "unknown")
                lines.append(f"[D] {name}/ (ID: {folder_id}, Path: {folder_path})")

            for file in files:
                name = file.get("name", "unknown")
                file_id = file.get("id", "unknown")
                file_path = file.get("path", "unknown")
                lines.append(f"[F] {name} (ID: {file_id}, Path: {file_path})")

            lines.append("")
            lines.append(f"Total: {len(folders)} folders, {len(files)} files")

            return "\n".join(lines)

        except ScratchpadApiError as e:
            error_msg = f"Error listing directory '{path}': {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Unexpected error in ls: {str(e)}"
            logger.exception(error_msg)
            return error_msg
