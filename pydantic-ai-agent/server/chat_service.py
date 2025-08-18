#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Awaitable
from fastapi import HTTPException
from pydantic_ai.exceptions import UserError
from pydantic_ai.usage import UsageLimits
from pydantic_ai import Agent
from pydantic_ai.usage import Usage
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)
from agents.data_agent.models import (
    ChatRunContext,
    ChatSession,
    FocusedCell,
    ResponseFromAgent,
    UsageStats,
)
from agents.data_agent.agent import create_agent, extract_response
from logger import log_info, log_error
from logging import getLogger
from scratchpad_api import API_CONFIG, check_server_health, track_token_usage

# from tools import set_api_token, set_session_data
from server.user_prompt_utils import build_snapshot_context
from scratchpad_api import get_agent_credentials, get_snapshot, list_records, get_record
from agents.data_agent.data_agent_utils import (
    convert_scratchpad_snapshot_to_ai_snapshot,
)
from utils.helpers import find_first_matching, mask_string
from server.agent_run_state_manager import AgentRunStateManager

myLogger = getLogger(__name__)


class CancelledAgentRunResult:
    """Result for a cancelled agent run"""

    def __init__(self, usage: Usage):
        self.usage_stats = UsageStats(
            requests=usage.requests if usage and usage.requests else 0,
            request_tokens=(
                usage.request_tokens if usage and usage.request_tokens else 0
            ),
            response_tokens=(
                usage.response_tokens if usage and usage.response_tokens else 0
            ),
            total_tokens=usage.total_tokens if usage and usage.total_tokens else 0,
        )


class AgentRunCancelledError(UserError):
    """Error raised when an agent run is cancelled"""

    def __init__(self, message: str, run_id: str, when: str):
        super().__init__(message)
        self.run_id = run_id
        self.when = when


class ChatService:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}
        self.run_state_manager = AgentRunStateManager()

    def create_session(self, session_id: str, snapshot_id: str) -> ChatSession:
        """Create a new chat session and set session data in tools"""
        now = datetime.now()
        session = ChatSession(
            id=session_id,
            name=f"Chat Session {now.strftime('%Y-%m-%d %H:%M')}",
            last_activity=now,
            created_at=now,
            snapshot_id=snapshot_id,
        )

        myLogger.info(
            "Session created",
            extra={"session_id": session_id, "snapshot_id": snapshot_id},
        )

        return session

    async def cancel_agent_run(self, session_id: str, run_id: str) -> str:
        """Cancel a run"""
        myLogger.info(
            f"Cancelling agent run {run_id} for session {session_id}",
        )

        if not await self.run_state_manager.exists(session_id, run_id):
            myLogger.info(
                f"Run {run_id} not found",
                extra={"run_id": run_id, "session_id": session_id},
            )
            return "Run not found"

        await self.run_state_manager.cancel_run(run_id)
        return "Run cancelled"

    async def process_message_with_agent(
        self,
        session: ChatSession,
        user_message: str,
        api_token: str,
        style_guides: Dict[str, str],
        model: Optional[str] = None,
        view_id: Optional[str] = None,
        read_focus: Optional[List[FocusedCell]] = None,
        write_focus: Optional[List[FocusedCell]] = None,
        capabilities: Optional[List[str]] = None,
        active_table_id: Optional[str] = None,
        data_scope: Optional[str] = None,
        record_id: Optional[str] = None,
        column_id: Optional[str] = None,
        timeout_seconds: float = 60.0,
        progress_callback: Optional[Callable[[str, str, dict], Awaitable[None]]] = None,
    ) -> ResponseFromAgent:
        """Process a message with the agent and return the response"""
        myLogger.info(
            "Starting agent processing",
            extra={"session_id": session.id, "snapshot_id": session.snapshot_id},
        )
        # Set API token in tools' global state for this message
        if not api_token:
            myLogger.info("No API token provided")

        # Log view ID if provided
        if not view_id:
            myLogger.info("No view ID provided")

        # Log capabilities if provided
        if capabilities:
            log_info(
                "Capabilities provided",
                session_id=session.id,
                capabilities=capabilities,
                snapshot_id=session.snapshot_id,
            )

        # Log style guides if provided
        if style_guides:
            log_info(
                "Style guides provided for session",
                session_id=session.id,
                style_guides_count=len(style_guides),
                style_guide_names=list(style_guides.keys()),
                snapshot_id=session.snapshot_id,
            )

        if data_scope:
            log_info(
                "Data scope provided for session",
                session_id=session.id,
                data_scope=data_scope,
                snapshot_id=session.snapshot_id,
            )

        user_open_router_credentials = None

        try:
            # load agent credentials for the user, this both verifies the api_token is active AND gets any
            # openrouter credentials for the user has access to
            agent_credentials = get_agent_credentials(api_token)
            user_open_router_credentials = find_first_matching(
                agent_credentials,
                lambda c: c.service == "openrouter"
                and c.apiKey is not None
                and c.apiKey.strip() != ""
                and c.enabled,
            )
            if user_open_router_credentials:
                myLogger.info(
                    "User has personal openrouter credentials",
                    extra={
                        "session_id": session.id,
                        "api_key": mask_string(
                            user_open_router_credentials.apiKey, 8, "*", 15
                        ),
                    },
                )
        except Exception as e:
            log_error(
                "Failed to verify user credentials",
                session_id=session.id,
                error=str(e),
            )
            myLogger.exception(
                "Failed to get agent credentials",
                extra={"session_id": session.id},
            )
            raise HTTPException(
                status_code=500,
                detail="Error authenticating credentials for agent processing",
            )

        try:
            # Create the full prompt with memory
            full_prompt = f"RESPOND TO: {user_message}"

            # Log agent processing details
            log_info(
                "Agent processing summary",
                session_id=session.id,
                chat_history_length=len(session.chat_history),
                summary_history_length=len(session.summary_history),
                style_guides_count=len(style_guides) if style_guides else 0,
                capabilities_count=len(capabilities) if capabilities else 0,
                full_prompt_length=len(full_prompt),
                user_message=user_message,
                has_api_token=api_token is not None,
                snapshot_id=session.snapshot_id,
            )

            try:
                # Pre-load snapshot data and records for efficiency
                myLogger.info(
                    "Pre-loading snapshot data and records",
                )
                snapshot_data = None
                preloaded_records = {}
                filtered_counts = {}

                if session.snapshot_id and api_token:
                    try:
                        # Fetch snapshot details
                        snapshot_data = get_snapshot(session.snapshot_id, api_token)
                        snapshot = convert_scratchpad_snapshot_to_ai_snapshot(
                            snapshot_data, session
                        )

                        # Pre-load records for each table
                        for table in snapshot.tables:
                            if active_table_id and active_table_id != table.id.wsId:
                                continue

                            if record_id and (
                                data_scope == "record" or data_scope == "column"
                            ):
                                # just preload the one record form the table
                                try:
                                    record = get_record(
                                        session.snapshot_id,
                                        table.id.wsId,
                                        record_id,
                                        api_token,
                                    )
                                    preloaded_records[table.name] = [
                                        {
                                            "id": {
                                                "wsId": record.id.wsId,
                                                "remoteId": record.id.remoteId,
                                            },
                                            "fields": record.fields,
                                            "suggested_fields": record.suggested_fields,
                                            "edited_fields": record.edited_fields,
                                            "dirty": record.dirty,
                                        }
                                    ]
                                    myLogger.info(
                                        f"📊 Pre-loaded {len(preloaded_records[table.name])} record for table '{table.name}': {record.id.wsId}"
                                    )
                                except Exception as e:
                                    myLogger.exception(
                                        f"⚠️ Failed to pre-load record {record_id} for table '{table.name}'"
                                    )
                                    preloaded_records[table.name] = []
                            else:
                                try:
                                    records_result = list_records(
                                        session.snapshot_id,
                                        table.id.wsId,
                                        api_token,
                                        view_id=view_id,
                                    )
                                    filtered_counts[table.name] = (
                                        records_result.filteredRecordsCount
                                    )
                                    preloaded_records[table.name] = [
                                        {
                                            "id": {
                                                "wsId": record.id.wsId,
                                                "remoteId": record.id.remoteId,
                                            },
                                            "fields": record.fields,
                                            "suggested_fields": record.suggested_fields,
                                            "edited_fields": record.edited_fields,
                                            "dirty": record.dirty,
                                        }
                                        for record in records_result.records
                                    ]
                                    myLogger.info(
                                        f"📊 Pre-loaded {len(preloaded_records[table.name])} records for table '{table.name}'"
                                    )
                                    if records_result.filteredRecordsCount > 0:
                                        myLogger.info(
                                            f"🚫 {records_result.filteredRecordsCount} records are filtered out for table '{table.name}'"
                                        )
                                except Exception as e:
                                    myLogger.exception(
                                        f"⚠️ Failed to pre-load records for table '{table.name}'"
                                    )
                                    preloaded_records[table.name] = []

                        myLogger.info(
                            "Data preload complete",
                        )
                    except Exception as e:
                        log_error(
                            "Failed to pre-load snapshot data",
                            session_id=session.id,
                            error=str(e),
                            snapshot_id=session.snapshot_id,
                        )
                        snapshot = None
                        preloaded_records = {}
                        return None

                # Create context with pre-loaded data
                chatRunContext: ChatRunContext = ChatRunContext(
                    run_id=str(uuid.uuid4()),
                    session=session,
                    api_token=api_token,
                    view_id=view_id,
                    snapshot=snapshot,
                    read_focus=read_focus,
                    write_focus=write_focus,
                    preloaded_records=preloaded_records,
                    active_table_id=active_table_id,
                    data_scope=data_scope,
                    record_id=record_id,
                    column_id=column_id,
                )

                # Store the chat context so it can be accessed by the cancel system
                await self.run_state_manager.start_run(
                    session.id,
                    chatRunContext.run_id,
                )

                if progress_callback:
                    await progress_callback(
                        "run_started",
                        f"Run started with ID {chatRunContext.run_id}",
                        {
                            "run_id": chatRunContext.run_id,
                        },
                    )

                # Prepare records and filtered counts for the utility function
                preloaded_records = chatRunContext.preloaded_records

                snapshot_context = build_snapshot_context(
                    snapshot=snapshot,
                    preloaded_records=preloaded_records,
                    filtered_counts=filtered_counts,
                    truncate_record_content=data_scope == "table",
                )

                # Update the full prompt with snapshot data
                full_prompt = f"RESPOND TO: {user_message} {snapshot_context}"

                # Add focus cells information to the prompt if they exist
                if read_focus or write_focus:
                    focus_context = "\n\nFOCUS CELLS:\n"

                    if read_focus:
                        focus_context += "Read Focus Cells:\n"
                        for cell in read_focus:
                            focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
                        focus_context += "\n"

                    if write_focus:
                        focus_context += "Write Focus Cells:\n"
                        for cell in write_focus:
                            focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
                        focus_context += "\n"

                    full_prompt += focus_context

                if progress_callback:
                    if (
                        user_open_router_credentials
                        and user_open_router_credentials.apiKey
                    ):
                        await progress_callback(
                            "status",
                            f"Creating agent using the {model} model with user OpenRouter credentials",
                            {},
                        )
                    else:
                        await progress_callback(
                            "status",
                            f"Creating agent using the {model} model",
                            {},
                        )

                agent = create_agent(
                    model_name=model,
                    capabilities=capabilities,
                    style_guides=style_guides,
                    data_scope=data_scope,
                    open_router_credentials=user_open_router_credentials,
                )

                result = None

                # Runs the agent in streaming mode so we can wrap it in the timeout function blow
                # Final result will get set into the result above
                async def process_stream():
                    nonlocal result
                    try:
                        async with agent.iter(
                            full_prompt,
                            deps=chatRunContext,
                            message_history=session.message_history,
                            usage_limits=UsageLimits(
                                request_limit=10,  # Maximum 20 requests per agent run
                                # request_tokens_limit=10000,  # Maximum 10k tokens per request
                                # response_tokens_limit=5000,  # Maximum 5k tokens per response
                                # total_tokens_limit=15000  # Maximum 15k tokens total
                            ),
                        ) as agent_run:
                            async for node in agent_run:
                                if await self.run_state_manager.is_cancelled(
                                    chatRunContext.run_id
                                ):
                                    raise AgentRunCancelledError(
                                        "Run cancelled",
                                        chatRunContext.run_id,
                                        "between processing nodes",
                                    )

                                if progress_callback:
                                    if Agent.is_user_prompt_node(node):
                                        # A user prompt node => The user has provided input
                                        # await progress_callback(f"User prompt constructed")
                                        continue
                                    elif Agent.is_model_request_node(node):
                                        # A model request node => We can stream tokens from the model's request
                                        await progress_callback(
                                            "status", f"Request sent to {model}", {}
                                        )

                                        async with node.stream(
                                            agent_run.ctx
                                        ) as request_stream:
                                            async for event in request_stream:
                                                # check cancel status
                                                if await self.run_state_manager.is_cancelled(
                                                    chatRunContext.run_id
                                                ):
                                                    raise AgentRunCancelledError(
                                                        "Run cancelled",
                                                        chatRunContext.run_id,
                                                        "while waiting for model response",
                                                    )

                                    elif Agent.is_call_tools_node(node):
                                        # A handle-response node => The model returned some data, potentially calls a tool
                                        model_response = node.model_response
                                        if model_response.parts:
                                            model_response_part = model_response.parts[
                                                0
                                            ]
                                            if model_response_part.tool_name and model_response_part.tool_name == "final_result":  # type: ignore
                                                continue

                                        async with node.stream(
                                            agent_run.ctx
                                        ) as handle_stream:
                                            async for event in handle_stream:
                                                if await self.run_state_manager.is_cancelled(
                                                    chatRunContext.run_id
                                                ):
                                                    raise AgentRunCancelledError(
                                                        "Run cancelled",
                                                        chatRunContext.run_id,
                                                        "while processing tool result",
                                                    )

                                                if isinstance(
                                                    event, FunctionToolCallEvent
                                                ):
                                                    await progress_callback(
                                                        "tool_call",
                                                        f"Tool call {event.part.tool_name!r}",
                                                        {
                                                            "tool_call_id": event.tool_call_id,
                                                            "args": event.part.args,
                                                        },
                                                    )
                                                elif isinstance(
                                                    event, FunctionToolResultEvent
                                                ):
                                                    await progress_callback(
                                                        "tool_result",
                                                        f"Tool call {event.tool_call_id!r} returned",
                                                        {
                                                            "tool_call_id": event.tool_call_id,
                                                            "content": event.result.content,
                                                        },
                                                    )

                                    elif Agent.is_end_node(node):
                                        await progress_callback(
                                            "status",
                                            f"Constructing final agent response",
                                            {},
                                        )

                            result = agent_run.result
                            await self.run_state_manager.complete_run(
                                chatRunContext.run_id
                            )
                    except AgentRunCancelledError as e:
                        myLogger.info(f"Run {e.run_id} cancelled by user: {e.when}")
                        result = CancelledAgentRunResult(
                            agent_run.usage() if agent_run.usage else None
                        )

                # Run the streaming with timeout
                myLogger.info(
                    "Running agent with timeout",
                    extra={
                        "session_id": session.id,
                        "timeout_seconds": timeout_seconds,
                    },
                )

                start_time = asyncio.get_event_loop().time()
                await asyncio.wait_for(process_stream(), timeout=timeout_seconds)
                end_time = asyncio.get_event_loop().time()
                execution_time = end_time - start_time
                myLogger.info(
                    f"Agent run ended: session_id={session.id}, execution_time={execution_time}"
                )
            except asyncio.TimeoutError:
                log_error(
                    "Agent processing timeout",
                    session_id=session.id,
                    timeout_seconds=30,
                    snapshot_id=session.snapshot_id,
                )
                myLogger.info(f"❌ Agent.run() timed out after 30 seconds")
                raise HTTPException(status_code=408, detail="Agent response timeout")
            finally:
                await self.run_state_manager.delete_run(chatRunContext.run_id)

            # The agent returns an AgentRunResult wrapper, we need to extract the actual response
            myLogger.info(f"🔍 Agent result: {type(result)}")

            if isinstance(result, CancelledAgentRunResult):

                cancelled_result: CancelledAgentRunResult = result
                # cancelled by user, handle as a special response to the caller
                myLogger.info(
                    f"Build response for cancelled run {chatRunContext.run_id}"
                )

                if cancelled_result.usage_stats.requests > 0:
                    try:
                        track_token_usage(
                            api_token,
                            model,
                            cancelled_result.usage_stats.requests,
                            cancelled_result.usage_stats.request_tokens,
                            cancelled_result.usage_stats.response_tokens,
                            cancelled_result.usage_stats.total_tokens,
                            usage_context={
                                "session_id": session.id,
                                "snapshot_id": session.snapshot_id,
                                "active_table_id": active_table_id,
                                "data_scope": data_scope,
                                "record_id": record_id,
                                "column_id": column_id,
                                "agent_credentials": (
                                    "user" if user_open_router_credentials else "system"
                                ),
                                "cancelled_by_user": True,
                            },
                        )
                    except Exception as e:
                        myLogger.exception(
                            f"❌ Failed to track token usage through Scratchpad API"
                        )

                return ResponseFromAgent(
                    response_message="Request cancelled by user",
                    response_summary="Request cancelled by user",
                    request_summary="Request cancelled by user",
                    usage_stats=cancelled_result.usage_stats,
                )

            session.message_history = result.all_messages()

            # Extract the actual response from the AgentRunResult
            actual_response = extract_response(result, ResponseFromAgent)
            if not actual_response:
                log_error(
                    "No response from agent",
                    session_id=session.id,
                    snapshot_id=session.snapshot_id,
                )
                myLogger.info(f"❌ No response from agent")
                raise HTTPException(status_code=500, detail="No response from agent")

            # Check if actual_response has the expected fields using getattr for safety
            try:
                response_message = getattr(actual_response, "response_message", None)
                response_summary = getattr(actual_response, "response_summary", None)
                request_summary = getattr(actual_response, "request_summary", None)

                has_expected_fields = (
                    actual_response
                    and response_message is not None
                    and response_summary is not None
                    and request_summary is not None
                )
            except:
                has_expected_fields = False

            if has_expected_fields:
                log_info(
                    "Agent response summary info",
                    session_id=session.id,
                    response_length=len(response_message),  # type: ignore
                    response_summary_length=len(response_summary),  # type: ignore
                    request_summary_length=len(request_summary),  # type: ignore
                    snapshot_id=session.snapshot_id,
                )

                usage: Usage = result.usage()
                if usage:
                    actual_response.usage_stats = UsageStats(
                        requests=usage.requests,
                        request_tokens=usage.request_tokens,
                        response_tokens=usage.response_tokens,
                        total_tokens=usage.total_tokens,
                    )

                try:
                    track_token_usage(
                        api_token,
                        model,
                        usage.requests,
                        usage.request_tokens,
                        usage.response_tokens,
                        usage.total_tokens,
                        usage_context={
                            "session_id": session.id,
                            "snapshot_id": session.snapshot_id,
                            "active_table_id": active_table_id,
                            "data_scope": data_scope,
                            "record_id": record_id,
                            "column_id": column_id,
                            "agent_credentials": (
                                "user" if user_open_router_credentials else "system"
                            ),
                        },
                    )
                except Exception as e:
                    myLogger.exception(
                        f"❌ Failed to track token usage through Scratchpad API"
                    )

                return actual_response
            else:
                log_error(
                    "Invalid agent response",
                    session_id=session.id,
                    response_type=type(result),
                    snapshot_id=session.snapshot_id,
                )
                myLogger.info(f"❌ Invalid response from agent: {result}")
                raise HTTPException(
                    status_code=500, detail="Invalid response from agent"
                )

        except Exception as e:
            log_error(
                "Agent processing error",
                session_id=session.id,
                error=str(e),
                snapshot_id=session.snapshot_id,
            )
            myLogger.exception(f"Error in agent processing")
            raise HTTPException(
                status_code=500, detail=f"Error processing message: {str(e)}"
            )

    def cleanup_inactive_sessions(self, max_age_hours: int = 24) -> None:
        """Clean up inactive sessions"""
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        to_delete = []

        for session_id, session in self.sessions.items():
            if session.last_activity < cutoff:
                to_delete.append(session_id)

        for session_id in to_delete:
            del self.sessions[session_id]

        if to_delete:
            myLogger.info(f"🧹 Cleaned up {len(to_delete)} inactive sessions")
