#!/usr/bin/env python3
"""
PydanticAI Agent for the Chat Server
"""

import os
import asyncio
import traceback
import time
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol
from dotenv import load_dotenv

from models import ChatResponse
from tools import get_records, connect_snapshot, get_active_snapshot, set_api_token, set_session_data
from logger import log_info, log_error

load_dotenv()

def extract_response(result):
    """Extract response from result object, trying different attributes"""
    # Try different possible response attributes
    for attr in ['output', 'response', 'data']:
        if hasattr(result, attr):
            response = getattr(result, attr)
            if response:
                return response
    return None

def create_agent():
    """Create and return a configured agent"""
    try:
        # OpenRouter API key from environment
        api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable not found")
        
        # Model name from environment
        model_name = os.getenv("MODEL_NAME", "openai/gpt-4o-mini")
        
        # Create the model using OpenRouter
        model = OpenAIModel(
            model_name,
            provider=OpenRouterProvider(api_key=api_key),
        )
        
        # Create the agent
        agent = Agent(
            name="ChatServerAgent",
            instructions="""You are a helpful AI assistant that can work with data from Scratchpad snapshots. 



Always be helpful and provide clear explanations of what you're doing.""",
            output_type=ChatResponse,
            model=model
        )
        
        # Add tools using @agent.tool decorator
        @agent.tool
        async def connect_snapshot_tool(ctx: RunContext) -> str:  # type: ignore
            """
            Connect to the snapshot associated with the current session.
            
            Use this tool when the user wants to work with data from the snapshot associated with their session.
            The snapshot ID is automatically determined from the session.
            """
            return await connect_snapshot(ctx)  # type: ignore
        
        @agent.tool
        async def get_records_tool(ctx: RunContext, table_name: str, limit: int = 100) -> str:  # type: ignore
            """
            Get all records for a table from the active snapshot.
            
            Use this tool when the user asks to see data from a table or wants to view records.
            The table_name should be the name of the table you want to get records from.
            You must connect to a snapshot first using connect_snapshot.
            """
            return await get_records(ctx, table_name, limit)  # type: ignore
        
        print(f"✅ Agent created successfully with model: {model_name}")
        print(f"🔧 Agent has tools: connect_snapshot_tool, get_records_tool")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        return None 
