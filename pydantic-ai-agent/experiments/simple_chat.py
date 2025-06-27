#!/usr/bin/env python3
"""
Simple PydanticAI Agent - Basic Chat Example (OpenRouter + Google Gemini) with Manual Memory and Logfire Integration
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

# Load environment variables
load_dotenv()

# Logfire imports and initialization
try:
    import logfire
    
    # Initialize Logfire
    LOGFIRE_TOKEN = os.getenv("LOGFIRE_TOKEN")
    if LOGFIRE_TOKEN:
        logfire.configure(token=LOGFIRE_TOKEN, service_name="pydantic-ai-simple-chat")
        print("✅ Logfire initialized with token")
    else:
        # Try to configure without token (for local development)
        try:
            logfire.configure(service_name="pydantic-ai-simple-chat", send_to_logfire=False)
            print("⚠️  Logfire initialized in local mode (no token)")
        except Exception as e:
            print(f"⚠️  Logfire initialization failed: {e}")
            print("📝 Falling back to standard Python logging")
            raise ImportError("Logfire not properly configured")
    
    # Enable Logfire's AI instrumentation for automatic LLM logging
    logfire.instrument_pydantic_ai()
    print("🔍 Logfire AI instrumentation enabled - will capture LLM interactions automatically")
            
    # Create a simple wrapper for consistent logging interface
    class LoggerProtocol(Protocol):
        def info(self, message: str, **kwargs: Any) -> None: ...
        def error(self, message: str, **kwargs: Any) -> None: ...
        def warning(self, message: str, **kwargs: Any) -> None: ...
        def debug(self, message: str, **kwargs: Any) -> None: ...
    
    class LogfireWrapper:
        def info(self, message: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> None:
            if data is None:
                data = kwargs
            logfire.log("info", message, attributes=data)
        
        def error(self, message: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> None:
            if data is None:
                data = kwargs
            logfire.log("error", message, attributes=data)
        
        def warning(self, message: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> None:
            if data is None:
                data = kwargs
            logfire.log("warning", message, attributes=data)
        
        def debug(self, message: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> None:
            if data is None:
                data = kwargs
            logfire.log("debug", message, attributes=data)
    
    logger: LoggerProtocol = LogfireWrapper()
            
except ImportError:
    # Fallback to standard Python logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)  # type: ignore
    print("📝 Using standard Python logging (Logfire not available)")

# Simple response model
class ChatResponse(BaseModel):
    """Simple chat response model"""
    message: str = Field(description="The agent's response message")
    emotion: str = Field(description="The emotion conveyed (happy, sad, excited, etc.)")

def extract_response(result):
    """Extract response from result object, trying different attributes"""
    # Try different possible response attributes
    for attr in ['output', 'response', 'data']:
        if hasattr(result, attr):
            response = getattr(result, attr)
            if response:
                return response
    return None

async def main():
    """Simple chat with structured output and manual memory"""
    
    logger.info("Starting SimpleChatAgent")
    
    # OpenRouter API key
    api_key = "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"
    
    if not api_key:
        logger.error("OpenRouter API key not found")
        print("❌ Error: OpenRouter API key not found")
        return
    
    logger.info("OpenRouter API key found", api_key_prefix=api_key[:20])
    print(f"✅ OpenRouter API Key found: {api_key[:20]}...")
    
    # Create the model using OpenRouter
    try:
        model = OpenAIModel(
            'google/gemini-2.5-flash-lite-preview-06-17',
            provider=OpenRouterProvider(api_key=api_key),
        )
        logger.info("Model created successfully", model_name="google/gemini-2.5-flash-lite-preview-06-17")
        print("✅ Model created successfully")
    except Exception as e:
        logger.error("Error creating model", error=str(e), error_type=type(e).__name__)
        print(f"❌ Error creating model: {e}")
        traceback.print_exc()
        return
    
    # Create a simple agent
    try:
        agent = Agent(
            name="SimpleChatAgent",
            instructions="You are a friendly AI assistant. Respond to user messages in a helpful and engaging way. Always respond with a message and an emotion. Remember important information that users tell you and use it in future conversations.",
            output_type=ChatResponse,
            model=model
        )
        logger.info("Agent created successfully", agent_name="SimpleChatAgent")
        print("✅ Agent created successfully")
    except Exception as e:
        logger.error("Error creating agent", error=str(e), error_type=type(e).__name__)
        print(f"❌ Error creating agent: {e}")
        traceback.print_exc()
        return
    
    logger.info("SimpleChatAgent is ready", model="google/gemini-2.5-flash-lite-preview-06-17")
    print("🤖 SimpleChatAgent is ready! (Using Google Gemini via OpenRouter with Manual Memory)")
    print("Type 'quit' to exit")
    print("-" * 50)
    
    # Manual memory system
    conversation_history = []
    important_facts = []
    message_count = 0
    
    # Chat loop
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                logger.info("User requested to quit", total_messages=message_count)
                print("👋 Goodbye!")
                break
            
            if not user_input:
                continue
            
            message_count += 1
            logger.info("Processing user input", 
                       message_id=message_count,
                       input_length=len(user_input),
                       conversation_history_length=len(conversation_history),
                       important_facts_count=len(important_facts))
            
            print(f"🔄 Processing: {user_input}")
            
            # Add user input to history
            conversation_history.append(f"User: {user_input}")
            
            # Build context from memory
            context = ""
            if important_facts:
                context = f"\n\nIMPORTANT FACTS TO REMEMBER:\n" + "\n".join(important_facts)
            
            if conversation_history:
                # Include last few messages for context
                recent_history = conversation_history[-6:]  # Last 6 messages
                context += f"\n\nRECENT CONVERSATION:\n" + "\n".join(recent_history)
            
            # Create the full prompt with memory
            full_prompt = f"Respond to: {user_input}. Provide your response with a message and an emotion.{context}"
            
            logger.debug("Sending prompt to agent", 
                        message_id=message_count,
                        prompt_length=len(full_prompt),
                        context_length=len(context))
            
            # Get structured response
            try:
                agent_start_time = time.time()
                
                # Create a span to capture the agent's thinking process
                with logfire.span("agent.thinking", 
                                 message_id=message_count,
                                 user_input=user_input,
                                 context_length=len(context),
                                 memory_facts_count=len(important_facts)) as span:
                    
                    result = await agent.run(full_prompt)
                    
                    # Log the agent's internal state using the main logger
                    logfire.log("info", "agent.response_received", 
                               attributes={
                                   "message_id": message_count,
                                   "result_type": type(result).__name__,
                                   "has_output": hasattr(result, 'output') and result.output is not None
                               })
                
                agent_duration = time.time() - agent_start_time
                
                logger.info("Agent response received", 
                           message_id=message_count,
                           agent_duration_seconds=agent_duration,
                           result_type=type(result).__name__)
                
                # Debug: Print the result structure
                print(f"🔍 Result type: {type(result)}")
                print(f"🔍 Result dir: {[attr for attr in dir(result) if not attr.startswith('_')]}")
                print(f"🔍 Result: {result}")
                
                # Extract response using helper function
                response = extract_response(result)
                
                if response:
                    if isinstance(response, ChatResponse):
                        print(f"🤖 {response.message}")
                        print(f"😊 Emotion: {response.emotion}")
                        
                        # Add agent response to history
                        conversation_history.append(f"Agent: {response.message}")
                        
                        # Log detailed response data to Logfire
                        logfire.log("info", "agent.structured_response", 
                                   attributes={
                                       "message_id": message_count,
                                       "response_message": response.message,
                                       "response_emotion": response.emotion,
                                       "response_length": len(response.message),
                                       "agent_duration_seconds": agent_duration
                                   })
                        
                        logger.info("Structured chat response", 
                                   message_id=message_count,
                                   message_length=len(response.message),
                                   emotion=response.emotion)
                        
                        # Check if user mentioned remembering something
                        if "remember" in user_input.lower() or "=" in user_input:
                            # Extract potential facts (simple heuristic)
                            if "=" in user_input:
                                fact = user_input.strip()
                                if fact not in important_facts:
                                    important_facts.append(fact)
                                    print(f"💾 Stored fact: {fact}")
                                    
                                    # Log memory operation to Logfire
                                    logfire.log("info", "agent.memory.stored_fact", 
                                               attributes={
                                                   "message_id": message_count,
                                                   "fact": fact,
                                                   "total_facts": len(important_facts),
                                                   "user_input": user_input
                                               })
                                    
                                    logger.info("New fact stored", 
                                               message_id=message_count,
                                               fact=fact,
                                               total_facts=len(important_facts))
                    else:
                        print(f"🤖 Raw response: {response}")
                        conversation_history.append(f"Agent: {response}")
                        logger.info("Raw response", 
                                   message_id=message_count,
                                   response_type=type(response).__name__)
                else:
                    print("🤖 No structured response received")
                    print(f"Raw result: {result}")
                    logger.warning("No structured response received", 
                                  message_id=message_count,
                                  result_type=type(result).__name__)
                
                # Show memory status
                print(f"💾 Memory: {len(important_facts)} facts, {len(conversation_history)} messages")
                if important_facts:
                    print(f"💾 Facts: {important_facts}")
                
                logger.info("Message processing completed", 
                           message_id=message_count,
                           total_facts=len(important_facts),
                           total_messages=len(conversation_history))
                
                print("-" * 50)
                
            except Exception as e:
                logger.error("Error during agent.run()", 
                            message_id=message_count,
                            error=str(e),
                            error_type=type(e).__name__)
                print(f"❌ Error during agent.run(): {e}")
                print(f"Error type: {type(e)}")
                traceback.print_exc()
                print("-" * 50)
            
        except KeyboardInterrupt:
            logger.info("User interrupted with Ctrl+C", total_messages=message_count)
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            logger.error("Error in main loop", 
                        message_id=message_count,
                        error=str(e),
                        error_type=type(e).__name__)
            print(f"❌ Error in main loop: {e}")
            traceback.print_exc()
    
    logger.info("SimpleChatAgent session ended", 
               total_messages=message_count,
               final_facts_count=len(important_facts),
               final_history_length=len(conversation_history))

if __name__ == "__main__":
    asyncio.run(main()) 