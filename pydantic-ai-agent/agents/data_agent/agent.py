#!/usr/bin/env python3
"""
PydanticAI Agent for the Chat Server
"""

import os
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

# from pydantic_ai import UrlContextTool, WebSearchTool
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Dict, Optional, List

from agents.data_agent.models import ResponseFromAgent, ChatRunContext
from agents.data_agent.data_agent_prompts import get_data_agent_instructions
from utils.helpers import mask_string
from agents.data_agent.tools_config import configure_tools, get_data_tools
from agents.data_agent.data_agent_history_processor import data_agent_history_processor
from scratchpad.entities import AgentCredential
from server.user_prompt_utils import build_snapshot_context
from logging import getLogger
from config import get_settings

logger = getLogger(__name__)

settings = get_settings()


def create_agent(
    api_key: str,
    model_name: Optional[str] = None,
    capabilities: Optional[List[str]] = None,
    style_guides: Dict[str, str] = {},
    data_scope: Optional[str] = None,
    filtered_counts: Optional[Dict[str, int]] = None,
):
    """Create and return a configured agent"""
    logger.info(f"🔍 create_agent called with:")
    logger.info(f"   model_name: {model_name}")
    logger.info(f"   capabilities: {capabilities}")
    logger.info(f"   style_guides: {style_guides}")
    logger.info(f"   style_guides type: {type(style_guides)}")
    logger.info(f"   data_scope: {data_scope}")
    if style_guides:
        logger.info(f"   style_guides length: {len(style_guides)}")
        for i, g in enumerate(style_guides):
            logger.info(f"   style_guide {i}: {g}")

    try:
        # Use provided model name or fall back to environment variable
        if model_name is None:
            model_name = settings.model_name

        # Create the model using OpenRouter
        model = OpenAIModel(
            model_name,
            provider=OpenRouterProvider(api_key=api_key),
        )

        builtin_tools = []

        # if model_name.startswith("openai/"):
        #     builtin_tools.append(UrlContextTool())
        #     builtin_tools.append(WebSearchTool(search_context_size="high", max_uses=5))

        # Create dynamic instructions function that includes snapshot context
        def get_dynamic_instructions(ctx: RunContext[ChatRunContext]) -> str:
            """Generate instructions with snapshot context dynamically for each run"""
            # Get base instructions
            base_instructions = get_data_agent_instructions(
                capabilities, style_guides, data_scope
            )

            # Build snapshot context from the run context
            snapshot_context = ""
            if ctx.deps.snapshot:
                snapshot_context = build_snapshot_context(
                    snapshot=ctx.deps.snapshot,
                    preloaded_records=ctx.deps.preloaded_records,
                    filtered_counts=filtered_counts,
                    data_scope=ctx.deps.data_scope,
                    active_table_id=ctx.deps.active_table_id,
                    record_id=ctx.deps.record_id,
                    column_id=ctx.deps.column_id,
                    mentioned_table_ids=ctx.deps.mentioned_table_ids,
                )

            # Combine all instructions
            full_instructions = f"{base_instructions}\n\n{snapshot_context}"

            return full_instructions

        # Create the agent with dynamic instructions
        agent = Agent(
            name="ChatServerAgent",
            instructions=get_dynamic_instructions,
            output_type=ResponseFromAgent,
            history_processors=[data_agent_history_processor],
            model=model,
            deps_type=ChatRunContext,
            tools=get_data_tools(capabilities, style_guides, data_scope),
            builtin_tools=builtin_tools,
        )

        configure_tools(agent, capabilities, data_scope)

        logger.info(f"✅ Agent created successfully with model: {model_name}")
        return agent

    except Exception as e:
        logger.exception(e)
        raise e
