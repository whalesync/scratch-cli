#!/usr/bin/env python3
"""
Simple PydanticAI Agent - Hello World Example (OpenRouter + Google Gemini)
"""

import os
import asyncio
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

# Load environment variables
load_dotenv()

# Define structured output models
class GreetingResponse(BaseModel):
    """Response model for greeting interactions"""
    message: str = Field(description="A friendly greeting message")
    mood: str = Field(description="The agent's current mood (happy, excited, calm, etc.)")
    suggestions: List[str] = Field(description="Suggestions for what the user could ask next")

class MathResponse(BaseModel):
    """Response model for math calculations"""
    result: float = Field(description="The calculated result")
    operation: str = Field(description="The mathematical operation performed")
    explanation: str = Field(description="Brief explanation of the calculation")

class WeatherResponse(BaseModel):
    """Response model for weather information"""
    temperature: str = Field(description="Current temperature")
    condition: str = Field(description="Weather condition (sunny, rainy, etc.)")
    recommendation: str = Field(description="What to wear or do based on the weather")

async def main():
    """Main function to run the agent"""
    
    # OpenRouter API key
    api_key = "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"
    
    if not api_key:
        print("❌ Error: OpenRouter API key not found")
        return
    
    print(f"✅ OpenRouter API Key found: {api_key[:20]}...")
    
    # Create the model using OpenRouter
    try:
        model = OpenAIModel(
            'google/gemini-2.5-flash-lite-preview-06-17',
            provider=OpenRouterProvider(api_key=api_key),
        )
        print("✅ Model created successfully")
    except Exception as e:
        print(f"❌ Error creating model: {e}")
        return
    
    # Create the agent
    agent = Agent(
        name="HelloWorldAgent",
        description="A friendly AI agent that can greet users, do math, and talk about weather",
        instructions="""
        You are a helpful and friendly AI agent. You can:
        1. Greet users warmly and provide suggestions for conversation
        2. Perform simple mathematical calculations
        3. Provide weather information (simulated)
        
        Always be polite and enthusiastic in your responses.
        """,
        models=[GreetingResponse, MathResponse, WeatherResponse],
        model=model
    )
    
    print("🤖 HelloWorldAgent is ready! (Using Google Gemini via OpenRouter)")
    print("Type 'quit' to exit")
    print("-" * 50)
    
    # Simple chat loop
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                print("👋 Goodbye! Thanks for chatting!")
                break
            
            if not user_input:
                continue
            
            # Determine the type of interaction and get structured response
            if any(word in user_input.lower() for word in ['hello', 'hi', 'hey', 'greet']):
                result = await agent.run(
                    f"Greet the user and respond to: {user_input}",
                    model="GreetingResponse"
                )
                if hasattr(result, 'output') and result.output:
                    response = result.output
                    print(f"🤖 {response.message}")
                    print(f"😊 Mood: {response.mood}")
                    print("💡 Suggestions:")
                    for suggestion in response.suggestions:
                        print(f"   • {suggestion}")
                else:
                    print("🤖 No structured response received")
                    
            elif any(word in user_input.lower() for word in ['calculate', 'math', '+', '-', '*', '/']):
                result = await agent.run(
                    f"Perform this calculation: {user_input}",
                    model="MathResponse"
                )
                if hasattr(result, 'output') and result.output:
                    response = result.output
                    print(f"🧮 {response.operation}")
                    print(f"📊 Result: {response.result}")
                    print(f"💭 {response.explanation}")
                else:
                    print("🤖 No structured response received")
                
            elif any(word in user_input.lower() for word in ['weather', 'temperature', 'forecast']):
                result = await agent.run(
                    f"Provide weather information for: {user_input}",
                    model="WeatherResponse"
                )
                if hasattr(result, 'output') and result.output:
                    response = result.output
                    print(f"🌤️  Temperature: {response.temperature}")
                    print(f"🌦️  Condition: {response.condition}")
                    print(f"👕 {response.recommendation}")
                else:
                    print("🤖 No structured response received")
                
            else:
                # Default to greeting for unknown inputs
                result = await agent.run(
                    f"Respond to this general message: {user_input}",
                    model="GreetingResponse"
                )
                if hasattr(result, 'output') and result.output:
                    response = result.output
                    print(f"🤖 {response.message}")
                    print(f"😊 Mood: {response.mood}")
                else:
                    print("🤖 No structured response received")
            
            print("-" * 50)
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye! Thanks for chatting!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
            print("Please try again.")

if __name__ == "__main__":
    asyncio.run(main()) 