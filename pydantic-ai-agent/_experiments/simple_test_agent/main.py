import os
import re
from collections import Counter
from pathlib import Path
from typing import List
from pydantic_ai import Agent, Tool
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.messages import ModelMessage, ModelResponse, SystemPromptPart, ToolReturnPart
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider
from dotenv import load_dotenv
from data_agent_prompts import get_data_agent_instructions
from update_records_tool import create_update_records_tool
from user_prompt import user_prompt_snapshot
import logfire as logfire_module

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
model = OpenAIModel(
    'openai/gpt-4o-mini',
    # 'google/gemini-2.5-pro',
    provider=OpenRouterProvider(api_key=api_key),
)
logfire_token = os.getenv("LOGFIRE_TOKEN")
logfire_module.configure(
    token=logfire_token, 
    service_name="pydantic-ai-chat-server",
    scrubbing=False
)
logfire_module.instrument_pydantic_ai()

def send_message(message: str) -> str:
    """
    Sends a message
    """
    print(f"Sending message: {message}")
    return "Message sent."


# Use the local_model defined in step 1
obsidian_agent = Agent(
    model=model,
    tools=[
        Tool(send_message),   
        create_update_records_tool(),
    ],
    system_prompt=get_data_agent_instructions(),
)

def main():
    message_history: list[ModelMessage] = []

    while True:
        try:
            prompt = input("\n>-> ")

            if prompt.lower() in ["exit", "quit"]:
                break
            if not prompt:
                continue
            result = obsidian_agent.run_sync(
                "RESPOND TO " + prompt + "\n" + user_prompt_snapshot,
                message_history=message_history
            )
            message_history = result.all_messages()

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    main()
