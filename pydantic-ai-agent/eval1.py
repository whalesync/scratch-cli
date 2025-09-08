from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from pydantic_evals.evaluators.common import IsInstance
from pydantic_evals import Case, Dataset
from agents.data_agent.models import ResponseFromAgent
from agents.data_agent.data_agent_prompts import get_data_agent_instructions
from agents.data_agent.data_tools import get_data_tools
from agents.data_agent.models import ChatRunContext
import os
from dotenv import load_dotenv
import logfire as logfire_module

load_dotenv()  # Lo

logfire_token = os.getenv("LOGFIRE_TOKEN")
logfire_module.configure(
    token=logfire_token,
    service_name="data-agent-evals",
    scrubbing=False,
    environment=os.getenv("LOGFIRE_ENVIRONMENT") + "-evals",
)

case1 = Case(
    name="capital_of_france",
    inputs="What is the capital of France?",
    expected_output="Paris",
)

dataset = Dataset(cases=[case1])

dataset.add_evaluator(IsInstance(type_name="ResponseFromAgent"))


api_key = os.getenv("OPENROUTER_API_KEY")
# Trim whitespace from API key to prevent authentication issues
if api_key:
    api_key = api_key.strip()

model = OpenAIModel(
    "openai/gpt-4o-mini",
    provider=OpenRouterProvider(api_key=api_key),
)

agent = Agent(
    name="DataAgent - Evals",
    instructions=get_data_agent_instructions([], {}),
    output_type=ResponseFromAgent,
    model=model,
    deps_type=ChatRunContext,
    tools=get_data_tools([], {}),
)

results = dataset.evaluate_sync(agent.run_sync)
