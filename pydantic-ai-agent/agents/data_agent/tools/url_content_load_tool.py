from logging import getLogger

import requests
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from logger import log_error, log_info
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ToolReturn

logger = getLogger(__name__)

MAX_CONTENT_LENGTH = 10000


def define_url_content_load_tool(agent: Agent[ChatRunContext, ResponseFromAgent]):
    """Use this tool when the user wants to load the content of a URL."""

    @agent.tool
    async def url_content_load_tool(ctx: RunContext[ChatRunContext], url: str) -> ToolReturn:  # type: ignore
        """
        Load the content of a URL and return it as a string.

        Use this tool when the user wants to load the content of a URL.
        The url should be a valid URL and cannot be empty.
        This tool does not support authentication or cookies.
        The loaded content is truncated to 10000 characters.
        """
        chatRunContext: ChatRunContext = ctx.deps

        if not url:
            return "Error: URL cannot be empty"

        try:
            # Make an HTTP request to the URL with a 10 second timeout

            log_info(
                "Loading context data from a URL",
                url=url,
            )

            response = requests.get(url, timeout=10.0)

            # Check if the request returns a non-200 status code
            if response.status_code != 200:
                return f"Error: HTTP request failed with status code {response.status_code}"

            # Return the content of the response

            raw_content = response.text

            # Limit content to 8k characters
            truncated_content = raw_content[:MAX_CONTENT_LENGTH]

            return ToolReturn(
                return_value=f"Content successfully loaded from {url}",
                content=[
                    truncated_content,
                ],
                metadata={
                    "url": url,
                    "content_length": len(raw_content),
                    "truncated": len(truncated_content) > len(raw_content),
                    "content_type": response.headers.get("Content-Type", "unknown"),
                },
            )

        except requests.Timeout:
            return "Error: Request timed out after 10 seconds"
        except Exception as e:
            error_msg = f"Unexpected error loading URL content"
            log_error(
                error_msg,
                url=url,
                error=str(e),
            )
            logger.exception(error_msg)
            return f"Error: Unexpected error occurred loading content. You may retry the request."
