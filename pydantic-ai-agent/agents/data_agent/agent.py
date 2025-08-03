#!/usr/bin/env python3
"""
PydanticAI Agent for the Chat Server
"""

import os
import traceback
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol, List

from agents.data_agent.models import ResponseFromAgent, ChatRunContext
from agents.data_agent.data_agent_prompts import get_data_agent_instructions
from logger import log_info, log_error
from utils.response_extractor import extract_response
from agents.data_agent.tools_config import configure_tools, get_data_tools
from agents.data_agent.data_agent_history_processor import data_agent_history_processor


def create_agent(model_name: Optional[str] = None, capabilities: Optional[List[str]] = None, style_guides: Dict[str, str] = {}, data_scope: Optional[str] = None):
    """Create and return a configured agent"""
    print(f"🔍 create_agent called with:")
    print(f"   model_name: {model_name}")
    print(f"   capabilities: {capabilities}")
    print(f"   style_guides: {style_guides}")
    print(f"   style_guides type: {type(style_guides)}")
    print(f"   data_scope: {data_scope}")
    if style_guides:
        print(f"   style_guides length: {len(style_guides)}")
        for i, g in enumerate(style_guides):
            print(f"   style_guide {i}: {g}")
    
    try:
        # OpenRouter API key from environment
        api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable not found")
        
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
            instructions=get_data_agent_instructions(capabilities, style_guides, data_scope),
            output_type=ResponseFromAgent,
            history_processors=[data_agent_history_processor],
            model=model,
            deps_type=ChatRunContext,
            tools=get_data_tools(capabilities, style_guides, data_scope) + [] # TODO: add view tools
        )
        
        configure_tools(agent, capabilities, data_scope);
 
        print(f"✅ Agent created successfully with model: {model_name}")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        raise e
