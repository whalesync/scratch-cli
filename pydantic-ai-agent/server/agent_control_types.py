#!/usr/bin/env python3
"""
Types for the agent chat service
"""

from typing import Any, Awaitable, Callable

from agents.data_agent.models import UsageStats
from pydantic_ai.exceptions import UserError


class AgentRunInterface:
    """Interface for interacting with an agent run task"""

    def __init__(
        self,
        task_id: str,
        is_stop_initiated: Callable[[], Awaitable[bool]],
        update_run_state: Callable[[str], Awaitable[None]],
    ):
        self.task_id = task_id
        self.is_stop_initiated = is_stop_initiated
        self.update_run_state = update_run_state


class AgentRunStoppedError(UserError):
    """Error raised when an agent run is stopped"""

    def __init__(self, message: str, run_id: str, when: str):
        super().__init__(message)
        self.run_id = run_id
        self.when = when


class StoppedAgentRunResult:
    """Result for a stopped agent run"""

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
