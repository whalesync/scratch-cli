#!/usr/bin/env python3
"""
Agent Stream Processor for handling agent execution and streaming
"""

from typing import Optional, Callable, Awaitable, Any
from logging import getLogger

from pydantic_ai import Agent
from pydantic_ai.usage import UsageLimits
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    ToolCallPart,
    RetryPromptPart,
    ToolReturnPart,
)
from pydantic_ai.exceptions import UserError

from agents.data_agent.models import ChatSession, ChatRunContext, UsageStats

logger = getLogger(__name__)


class AgentRunCancelledError(UserError):
    """Error raised when an agent run is cancelled"""

    def __init__(self, message: str, run_id: str, when: str):
        super().__init__(message)
        self.run_id = run_id
        self.when = when


async def process_agent_stream(
    agent: Agent,
    full_prompt: str,
    chat_run_context: ChatRunContext,
    session: ChatSession,
    agent_run_id: str,
    model: str,
    run_state_manager: Any,
    progress_callback: Optional[Callable[[str, str, dict], Awaitable[None]]] = None,
    usage_limits: Optional[UsageLimits] = None,
) -> Any:
    """
    Process agent stream and return the result.

    Args:
        agent: The agent instance to run
        full_prompt: The full prompt to send to the agent
        chat_run_context: The chat run context
        session: The chat session
        agent_run_id: Unique identifier for this agent run
        model: The model name being used
        run_state_manager: Manager for tracking run state
        progress_callback: Optional callback for progress updates

    Returns:
        The agent run result

    Raises:
        AgentRunCancelledError: If the run is cancelled
    """
    result = None

    try:
        async with agent.iter(
            full_prompt,
            deps=chat_run_context,
            message_history=session.message_history,
            usage_limits=usage_limits,
        ) as agent_run:
            async for node in agent_run:
                if await run_state_manager.is_cancelled(agent_run_id):
                    raise AgentRunCancelledError(
                        "Run cancelled",
                        agent_run_id,
                        "between processing nodes",
                    )

                if not progress_callback:
                    continue

                if Agent.is_user_prompt_node(node):
                    # A user prompt node => The user has provided input
                    # await progress_callback(f"User prompt constructed")
                    continue
                elif Agent.is_model_request_node(node):
                    # A model request node => We can stream tokens from the model's request
                    await progress_callback(
                        "request_sent", f"Request sent to {model}", {}
                    )

                    async with node.stream(agent_run.ctx) as request_stream:
                        async for event in request_stream:
                            # check cancel status
                            if await run_state_manager.is_cancelled(agent_run_id):
                                raise AgentRunCancelledError(
                                    "Run cancelled",
                                    agent_run_id,
                                    "while waiting for model response",
                                )

                elif Agent.is_call_tools_node(node):
                    # A handle-response node => The model returned some data, potentially calls a tool

                    async with node.stream(agent_run.ctx) as handle_stream:
                        async for event in handle_stream:
                            if await run_state_manager.is_cancelled(agent_run_id):
                                raise AgentRunCancelledError(
                                    "Run cancelled",
                                    agent_run_id,
                                    "while processing tool result",
                                )

                            if isinstance(event, FunctionToolCallEvent):
                                if isinstance(event.part, ToolCallPart):
                                    await progress_callback(
                                        "tool_call",
                                        f"Tool call {event.part.tool_name!r}",
                                        {
                                            "tool_call_id": event.tool_call_id,
                                            "tool_name": event.part.tool_name,
                                            "args": event.part.args,
                                        },
                                    )

                            elif isinstance(event, FunctionToolResultEvent):
                                tool_name = (
                                    event.result.tool_name
                                    if event.result and event.result.tool_name
                                    else "unknown tool"
                                )
                                if isinstance(event.result, RetryPromptPart):
                                    await progress_callback(
                                        "tool_call",
                                        f"Retrying tool {tool_name!r}",
                                        {
                                            "tool_call_id": event.tool_call_id,
                                            "tool_name": tool_name,
                                            "content": event.result.content,
                                        },
                                    )

                                if isinstance(event.result, ToolReturnPart):
                                    await progress_callback(
                                        "tool_result",
                                        f"Tool call {tool_name!r} returned",
                                        {
                                            "tool_call_id": event.tool_call_id,
                                            "tool_name": tool_name,
                                            "content": event.result.content,
                                        },
                                    )

                elif Agent.is_end_node(node):
                    await progress_callback(
                        "build_response",
                        f"Constructing final agent response",
                        {},
                    )

            result = agent_run.result
            await run_state_manager.complete_run(agent_run_id)

    except AgentRunCancelledError as e:
        logger.info(f"Run {e.run_id} cancelled by user: {e.when}")
        result = CancelledAgentRunResult(agent_run.usage() if agent_run.usage else None)

    return result


class CancelledAgentRunResult:
    """Result for a cancelled agent run"""

    def __init__(self, usage: Any):
        self.usage_stats = UsageStats(
            requests=usage.requests if usage and usage.requests else 0,
            request_tokens=(usage.input_tokens if usage and usage.input_tokens else 0),
            response_tokens=(
                usage.output_tokens if usage and usage.output_tokens else 0
            ),
            total_tokens=(
                usage.input_tokens + usage.output_tokens
                if usage and usage.input_tokens and usage.output_tokens
                else 0
            ),
        )
