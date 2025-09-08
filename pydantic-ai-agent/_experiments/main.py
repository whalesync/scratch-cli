import os
import asyncio
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from dotenv import load_dotenv

load_dotenv()  # Load variables from .env file

# --- OpenAI Configuration ---
api_key = os.getenv("OPENROUTER_API_KEY")
# Trim whitespace from API key to prevent authentication issues
if api_key:
    api_key = api_key.strip()

model = OpenAIModel(
    "google/gemini-2.5-flash-lite-preview-06-17",
    provider=OpenRouterProvider(api_key=api_key),
)

agent = Agent(model)

result_sync = agent.run_sync("What is the capital of Italy?")
print(result_sync.output)


async def main():
    result = await agent.run("What is the capital of France?")
    print(result.output)

    async with agent.run_stream("What is the capital of the UK?") as response:
        print(await response.get_output())


asyncio.run(main())
