#!/usr/bin/env python3
"""
Upload Content Tool for the Data Agent
"""
import logging

from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolReturn
from scratchpad.api import ScratchpadApi

logger = logging.getLogger(__name__)


class UploadContentInput(BaseModel):
    """Input for the upload_content_tool"""

    upload_id: str = Field(description="The ID of the upload to get content from")


def define_upload_content_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Use this tool when the user mentions an upload (using @[filename](upload_id) format) to get the content of that upload."""

    @agent.tool
    async def upload_content_tool(ctx: RunContext[ChatRunContext], input_data: UploadContentInput) -> ToolReturn:  # type: ignore
        """
        Get the content of an uploaded markdown file by its upload ID.
        Use this tool when the user mentions an upload using the @[filename](upload_id) format.
        """
        try:
            upload_id = input_data.upload_id
            chatRunContext = ctx.deps

            # Use ScratchpadApi to get upload content
            data = ScratchpadApi.get_upload_content(
                user_id=chatRunContext.user_id, upload_id=upload_id
            )

            # Extract PAGE_CONTENT from the response
            content = data.get("PAGE_CONTENT", "")

            if not content:
                return ToolReturn(
                    return_value=f"Error: No PAGE_CONTENT found for upload '{upload_id}'"
                )

            logger.info(f"✅ Successfully retrieved upload content for '{upload_id}'")
            return ToolReturn(
                return_value=f"Upload content for '{upload_id}':\n\n{content}"
            )

        except Exception as e:
            logger.error(f"Error in upload_content_tool: {e}")
            return ToolReturn(return_value=f"Error retrieving upload content: {str(e)}")
