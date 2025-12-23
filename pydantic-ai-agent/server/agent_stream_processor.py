#!/usr/bin/env python3
"""
Agent Stream Processor for handling agent execution and streaming
"""

import re
from logging import getLogger
from typing import Awaitable, Callable, Optional

from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent
from pydantic_ai import Agent
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    RetryPromptPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.run import AgentRunResult
from pydantic_ai.usage import UsageLimits
from server.agent_control_types import (
    AgentRunInterface,
    AgentRunStoppedError,
    StoppedAgentRunResult,
)
from server.exceptions import TokenLimitExceededException
from server.token_utils import estimate_tokens_from_request_parts

logger = getLogger(__name__)


async def process_agent_stream(
    agent: Agent[ChatRunContext, ResponseFromAgent],
    agent_run_task: AgentRunInterface,
    full_prompt: str,
    chat_run_context: ChatRunContext,
    session: ChatSession,
    model: str | None,
    progress_callback: Optional[Callable[[str, str, dict], Awaitable[None]]] = None,
    usage_limits: Optional[UsageLimits] = None,
    model_context_length: Optional[int] = None,
) -> AgentRunResult[ResponseFromAgent] | StoppedAgentRunResult | None:
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
        AgentRunStoppedError: If the run is stopped
    """
    result = None

    agent_run = None
    try:
        async with agent.iter(
            full_prompt,
            deps=chat_run_context,
            message_history=session.message_history,
            usage_limits=usage_limits,
        ) as agent_run:
            async for node in agent_run:
                if await agent_run_task.is_stop_initiated():
                    raise AgentRunStoppedError(
                        "Run stopped by user",
                        agent_run_task.task_id,
                        "between processing nodes",
                    )

                if not progress_callback:
                    continue

                if Agent.is_user_prompt_node(node):
                    # A user prompt node => The user has provided input
                    continue
                elif Agent.is_model_request_node(node):
                    # A model request node => We can stream tokens from the model's request
                    estimated_tokens = None
                    try:
                        # Get the request object from the node
                        request = node.request

                        # Estimate tokens using utility function
                        estimated_tokens = estimate_tokens_from_request_parts(
                            request.instructions or "", request.parts or []
                        )

                        # Check if estimated tokens exceed 50% of model capacity
                        if model_context_length and estimated_tokens:
                            threshold = model_context_length * 0.5
                            if estimated_tokens > threshold:
                                raise TokenLimitExceededException(
                                    requested_tokens=estimated_tokens,
                                    max_tokens=model_context_length,
                                    is_prerun=True,
                                )

                            # Log the estimate for monitoring
                            logger.info(
                                f"Request token estimate: {estimated_tokens:,} tokens "
                                f"(~{(estimated_tokens/model_context_length)*100:.1f}% of {model_context_length:,} capacity)"
                            )
                    except Exception as e:
                        if isinstance(e, TokenLimitExceededException):
                            raise
                        logger.debug(f"Could not estimate tokens for request: {e}")
                        estimated_tokens = None

                    await progress_callback(
                        "request_sent",
                        f"Request sent to {model}",
                        (
                            {"estimated_tokens": estimated_tokens}
                            if estimated_tokens
                            else {}
                        ),
                    )

                    async with node.stream(agent_run.ctx) as request_stream:
                        async for event in request_stream:
                            # check cancel status
                            if await agent_run_task.is_stop_initiated():
                                raise AgentRunStoppedError(
                                    "Run stopped by user",
                                    agent_run_task.task_id,
                                    "while waiting for model response",
                                )

                elif Agent.is_call_tools_node(node):
                    # Before processing the tool call lets report back the agent usage stats
                    if progress_callback:
                        try:
                            await progress_callback(
                                "model_response",
                                f"Model response received",
                                {
                                    "response_tokens": node.model_response.usage.output_tokens,
                                    "request_tokens": node.model_response.usage.input_tokens,
                                    "total_tokens": (
                                        node.model_response.usage.input_tokens
                                        + node.model_response.usage.output_tokens
                                    ),
                                },
                            )
                            # Get all messages from context to find the latest ModelResponse
                            node.model_response.usage
                        except Exception as e:
                            logger.debug(f"Failed processing model response: {e}")

                    async with node.stream(agent_run.ctx) as handle_stream:
                        async for event in handle_stream:
                            if await agent_run_task.is_stop_initiated():
                                raise AgentRunStoppedError(
                                    "Run stopped by user",
                                    agent_run_task.task_id,
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
            await agent_run_task.update_run_state("completed")

    except AgentRunStoppedError as e:
        logger.info(f"Run {e.run_id} stopped by user: {e.when}")
        await agent_run_task.update_run_state("stopped")
        # NOTE: usage doesn't get fully calculated until after at least one node is full resolved, so token counts will often be 0
        usage = agent_run.usage() if agent_run else None
        result = StoppedAgentRunResult(usage)
    except UsageLimitExceeded as e:
        # Pydantic-AI's built-in usage limit exception. Unfortunately we do not hit it.
        # se should investigate why. Until than - handle the error manually for common providers
        logger.error(f"Usage limit exceeded: {e.message}")

        # Get current usage to extract token counts
        current_usage = agent_run.usage() if agent_run else None
        requested_tokens = current_usage.input_tokens if current_usage else 0

        # Try to extract max tokens from the error message or use a reasonable default
        # The error message format is like "Exceeded the input_tokens_limit of 128000 (input_tokens=130000)"
        match = re.search(r"input_tokens_limit of (\d+)", e.message)
        max_tokens = int(match.group(1)) if match else 0

        raise TokenLimitExceededException(
            requested_tokens=requested_tokens, max_tokens=max_tokens, is_prerun=False
        )
    except ModelHTTPError as e:
        # Check if this is a context length error from the LLM provider
        error_message = str(e.body) if e.body else str(e)
        if (
            "maximum context length" in error_message.lower()
            or "context length" in error_message.lower()
        ):
            logger.error(f"Context length exceeded from provider: {error_message}")

            # Extract token counts from the error message
            # Format: "requested about 881556 tokens (878300 of text input, 3256 of tool input)"
            match = re.search(r"requested about (\d+) tokens", error_message)
            requested_tokens = int(match.group(1)) if match else 0

            match = re.search(r"maximum context length is (\d+) tokens", error_message)
            max_tokens = int(match.group(1)) if match else 0

            raise TokenLimitExceededException(
                requested_tokens=requested_tokens,
                max_tokens=max_tokens,
                is_prerun=False,
            )
        else:
            # Re-raise other ModelHTTPErrors
            raise
    except Exception as e:
        await agent_run_task.update_run_state("error")
        logger.exception(f"Unhandled exception in process_agent_stream: {str(e)}")
        raise

    return result
