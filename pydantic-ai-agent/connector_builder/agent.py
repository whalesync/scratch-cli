#!/usr/bin/env python3
"""
PydanticAI Agent for the Connector Builder
"""

import os
import traceback
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol, List

from .models import ResponseFromConnectorBuilderAgent, ConnectorBuilderRunContext
from .connector_builder_prompts import get_connector_builder_instructions
from logger import log_info, log_error
from utils.response_extractor import extract_response
from .connector_builder_tools import define_connector_builder_tools


def create_connector_builder_agent(model_name: Optional[str] = None, capabilities: Optional[List[str]] = None, style_guides: Optional[List[Dict[str, str]]] = None):
    """Create and return a configured connector builder agent"""
    print(f"🔍 create_connector_builder_agent called with:")
    print(f"   model_name: {model_name}")
    print(f"   capabilities: {capabilities}")
    print(f"   style_guides: {style_guides}")
    
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
            name="ConnectorBuilderAgent",
            instructions=get_connector_builder_instructions(capabilities, style_guides),
            output_type=ResponseFromConnectorBuilderAgent,
            # history_processors=[connector_builder_history_processors],
            model=model,
            deps_type=ConnectorBuilderRunContext
        )
        
        # Define tools with access to the run context
        define_connector_builder_tools(agent, capabilities)
        
        print(f"✅ Connector builder agent created successfully with model: {model_name}")
        print(f"🔧 Agent has tools: execute_list_tables_tool, save_custom_connector_tool, save_custom_connector_with_test_result_tool")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating connector builder agent: {e}")
        traceback.print_exc()
        raise e 