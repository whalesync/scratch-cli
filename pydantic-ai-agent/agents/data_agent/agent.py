#!/usr/bin/env python3
"""
PydanticAI Agent for the Chat Server
"""

import os
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol, List

from agents.data_agent.models import ResponseFromAgent, ChatRunContext
from agents.data_agent.data_agent_prompts import get_data_agent_instructions
from logger import log_info, log_error
from utils.helpers import mask_string
from utils.response_extractor import extract_response
from agents.data_agent.tools_config import configure_tools, get_data_tools
from agents.data_agent.data_agent_history_processor import data_agent_history_processor
from scratchpad_api import AgentCredential
from logging import getLogger

logger = getLogger(__name__)


def create_agent(
    model_name: Optional[str] = None,
    capabilities: Optional[List[str]] = None,
    style_guides: Dict[str, str] = {},
    data_scope: Optional[str] = None,
    open_router_credentials: Optional[AgentCredential] = None,
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
        # OpenRouter API key from environment
        api_key = os.getenv("OPENROUTER_API_KEY")

        if open_router_credentials and open_router_credentials.apiKey:
            logger.info(
                f"🔑 Using personal openrouter credentials: {mask_string(open_router_credentials.apiKey, 8, '*', 15)}"
            )
            api_key = open_router_credentials.apiKey

        if not api_key:
            raise ValueError(
                "Unable to find an OpenRouter API key for agent processing"
            )

        # Use provided model name or fall back to environment variable
        if model_name is None:
            model_name = os.getenv("MODEL_NAME", "openai/gpt-4o-mini")

        # Create the model using OpenRouter
        model = OpenAIModel(
            model_name,
            provider=OpenRouterProvider(api_key=api_key),
        )
        # Create the agent
        agent = Agent(
            name="ChatServerAgent",
            instructions=get_data_agent_instructions(
                capabilities, style_guides, data_scope
            ),
            output_type=ResponseFromAgent,
            history_processors=[data_agent_history_processor],
            model=model,
            deps_type=ChatRunContext,
            tools=get_data_tools(capabilities, style_guides, data_scope),
        )

        configure_tools(agent, capabilities, data_scope)

        logger.info(f"✅ Agent created successfully with model: {model_name}")
        return agent

    except Exception as e:
        logger.exception(e)
        raise e
