#!/usr/bin/env python3
"""
Agent functionality for the chat server
"""

import os
import asyncio
import traceback
import time
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from typing import Any, Dict, Union, Optional, Protocol

from models import ChatResponse

# Load environment variables
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
            instructions="You are a friendly AI assistant. Respond to user messages in a helpful and engaging way. Always respond with a message and an emotion. Remember important information that users tell you and use it in future conversations.",
            output_type=ChatResponse,
            model=model
        )
        
        print(f"✅ Agent created successfully with model: {model_name}")
        return agent
        
    except Exception as e:
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        return None 