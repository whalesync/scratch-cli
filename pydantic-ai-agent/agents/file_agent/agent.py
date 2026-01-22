#!/usr/bin/env python3
"""
File Agent - AI agent for file-based workbooks

This agent provides Unix-like file system commands (ls, cat, find, grep)
for navigating and searching files within a workbook.
"""

from logging import getLogger
from pathlib import Path
from typing import Optional

from agents.file_agent.models import FileAgentResponse, FileAgentRunContext
from agents.file_agent.tools_config import configure_tools
from config import get_settings
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

logger = getLogger(__name__)

settings = get_settings()

# Load system prompt from file
_system_prompt_path = Path(__file__).parent / "prompts" / "system_prompt.md"
with open(_system_prompt_path, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read()


def create_file_agent(
    api_key: str,
    model_name: Optional[str] = None,
):
    """
    Create and return a configured file agent.

    Args:
        api_key: OpenRouter API key
        model_name: Model to use (defaults to settings.model_name)

    Returns:
        Configured Agent instance
    """
    logger.info("Creating file agent")
    logger.info(f"  model_name: {model_name}")

    try:
        # Use provided model name or fall back to environment variable
        if model_name is None:
            model_name = settings.model_name

        # Create the model using OpenRouter
        model = OpenAIModel(
            model_name,
            provider=OpenRouterProvider(api_key=api_key),
        )

        # Create the agent
        agent = Agent(
            name="FileAgent",
            instructions=SYSTEM_PROMPT,
            output_type=FileAgentResponse,
            model=model,
            deps_type=FileAgentRunContext,
        )

        # Inject file context
        @agent.system_prompt
        def inject_file_context(ctx: RunContext[FileAgentRunContext]) -> str:
            prompt_parts = []

            if ctx.deps.active_file_path:
                prompt_parts.append(
                    f"Active File (User's primary focus): {ctx.deps.active_file_path}"
                )

            if ctx.deps.open_file_paths:
                open_files_list = "\n- ".join(ctx.deps.open_file_paths)
                prompt_parts.append(
                    f"Open Files (Relevant context):\n- {open_files_list}"
                )

            if prompt_parts:
                return "\n\n## Current User Context\n\n" + "\n\n".join(prompt_parts)
            return ""

        # Configure tools
        configure_tools(agent)

        logger.info(f"File agent created successfully with model: {model_name}")
        return agent

    except Exception as e:
        logger.exception(f"Failed to create file agent: {e}")
        raise e
