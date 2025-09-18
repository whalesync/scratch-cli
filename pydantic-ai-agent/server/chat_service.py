#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import os
import uuid
from typing import Dict, List, Optional, Any, Callable, Awaitable
from fastapi import HTTPException
from pydantic_ai.usage import RunUsage

from agents.data_agent.models import (
    ChatRunContext,
    ChatSession,
    FocusedCell,
    ResponseFromAgent,
    UsageStats,
)
from agents.data_agent.agent import create_agent
from utils.response_extractor import extract_response
from logger import log_info, log_error
from logging import getLogger

from scratchpad.api import ScratchpadApi

from server.user_prompt_utils import build_snapshot_context, build_focus_context
from server.agent_stream_processor import (
    process_agent_stream,
    CancelledAgentRunResult,
)

from agents.data_agent.data_agent_utils import (
    convert_scratchpad_snapshot_to_ai_snapshot,
)
from utils.helpers import find_first_matching, mask_string
from server.agent_run_state_manager import AgentRunStateManager
from server.session_service import SessionService
from server.auth import AgentUser

logger = getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# TODO: refactor this as a service or singleton class
class ChatService:
    def __init__(self, session_service: SessionService):
        self._session_service = session_service
        self._run_state_manager = AgentRunStateManager()

    def _log_processing_start(
        self,
        session: ChatSession,
        view_id: Optional[str],
        capabilities: Optional[List[str]],
        style_guides: Dict[str, str],
        data_scope: Optional[str],
    ) -> None:
        """Log the start of agent processing with relevant context"""
        logger.info(
            "Starting agent processing",
            extra={"session_id": session.id, "snapshot_id": session.snapshot_id},
        )

        # Log view ID if provided
        if not view_id:
            logger.info("No view ID provided")

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

    def _get_openrouter_api_key(
        self, session: ChatSession, user: AgentUser
    ) -> tuple[str, Optional[Any]]:
        """Get the OpenRouter API key for the agent, handling user credentials and validation"""
        try:
            # load agent credentials for the user, this both verifies the api_token is active AND gets any
            # openrouter credentials for the user has access to
            user_open_router_credentials = (
                ScratchpadApi.get_agent_credentials_by_service(
                    user.userId, "openrouter"
                )
            )

            if user_open_router_credentials:
                logger.info(
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
            logger.exception(
                "Failed to get agent credentials",
                extra={"session_id": session.id},
            )
            raise HTTPException(
                status_code=500,
                detail="Error authenticating credentials for agent processing. Please try again or contact support if the problem persists.",
            )

        require_user_agent_credentials = (
            os.getenv("REQUIRE_USER_AGENT_CREDENTIALS", "false").lower() == "true"
        )

        if (
            require_user_agent_credentials
            and not user_open_router_credentials
            and not user.role.lower() == "admin"
        ):
            log_error(
                f"User does not have openrouter credentials configured for user {user.userId}, role {user.role}",
                session_id=session.id,
            )
            raise HTTPException(
                status_code=401,
                detail="User agent credentials required",
            )

        api_key = None
        if user_open_router_credentials and user_open_router_credentials.apiKey:
            logger.info(
                f"🔑 Using personal openrouter credentials: {user_open_router_credentials.id}"
            )
            api_key = user_open_router_credentials.apiKey
        else:
            logger.info(f"🔑 Using Whalesync OpenRouter credentials")
            api_key = OPENROUTER_API_KEY

        # Trim whitespace from API key to prevent authentication issues
        if api_key:
            api_key = api_key.strip()

        if not api_key:
            raise HTTPException(
                status_code=401, detail="Unable to find an OpenRouter API key for agent"
            )

        return api_key, user_open_router_credentials

    def _load_snapshot_data(
        self,
        session: ChatSession,
        user: AgentUser,
        view_id: Optional[str],
        active_table_id: Optional[str],
        data_scope: Optional[str],
        record_id: Optional[str],
    ) -> tuple[Any, Dict[str, List[Dict]], Dict[str, int]]:
        """Load snapshot data and preload records for efficiency"""
        logger.info(
            "Pre-loading snapshot data and records",
        )
        snapshot_data = None
        column_view = None
        preloaded_records = {}
        filtered_counts = {}

        if not session.snapshot_id:
            raise HTTPException(
                status_code=500,
                detail="Snapshot ID must be provided to process the agent message.",
            )

        try:
            # Fetch snapshot details
            snapshot_data = ScratchpadApi.get_snapshot(user.userId, session.snapshot_id)
            try:
                if view_id:
                    logger.info(f"🔍 Getting column view {view_id}")
                    column_view = ScratchpadApi.get_column_view(user.userId, view_id)
                else:
                    logger.info(
                        f"🔍 No view ID provided, skipping column view",
                    )
            except Exception as e:
                logger.exception(
                    f"❌ Failed to get column view {view_id}",
                )
                column_view = None

            snapshot = convert_scratchpad_snapshot_to_ai_snapshot(
                snapshot_data, session, column_view
            )

            # Pre-load records for each table
            for table in snapshot.tables:
                if active_table_id and active_table_id != table.id.wsId:
                    continue

                if record_id and (data_scope == "record" or data_scope == "column"):
                    # just preload the one record form the table
                    try:
                        record = ScratchpadApi.get_record(
                            user.userId,
                            session.snapshot_id,
                            table.id.wsId,
                            record_id,
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
                        logger.info(
                            f"📊 Pre-loaded {len(preloaded_records[table.name])} record for table '{table.name}': {record.id.wsId}"
                        )
                    except Exception as e:
                        logger.exception(
                            f"⚠️ Failed to pre-load record {record_id} for table '{table.name}'"
                        )
                        preloaded_records[table.name] = []
                else:
                    try:
                        records_result = ScratchpadApi.list_records_for_ai(
                            user.userId,
                            session.snapshot_id,
                            table.id.wsId,
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
                        logger.info(
                            f"📊 Pre-loaded {len(preloaded_records[table.name])} records for table '{table.name}'"
                        )
                        if records_result.filteredRecordsCount > 0:
                            logger.info(
                                f"🚫 {records_result.filteredRecordsCount} records are filtered out for table '{table.name}'"
                            )
                    except Exception as e:
                        logger.exception(
                            f"⚠️ Failed to pre-load records for table '{table.name}'"
                        )
                        preloaded_records[table.name] = []

            logger.info(
                "Data preload complete",
            )
        except Exception as e:
            log_error(
                "Failed to pre-load snapshot data",
                session_id=session.id,
                error=str(e),
                snapshot_id=session.snapshot_id,
            )
            logger.exception(
                f"❌ Failed to pre-load snapshot data",
            )
            raise HTTPException(
                status_code=500,
                detail="Error preloading snapshot data for agent",
            )

        return snapshot, preloaded_records, filtered_counts

    async def process_message_with_agent(
        self,
        session: ChatSession,
        user_message: str,
        user: AgentUser,
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
        # Define noop callback if none provided so that we don't have to check for None everywhere
        if progress_callback is None:

            async def noop_callback(status: str, message: str, data: dict) -> None:
                pass

            progress_callback = noop_callback

        self._log_processing_start(
            session, view_id, capabilities, style_guides, data_scope
        )

        # Determine the API key to use for the agent
        api_key, user_open_router_credentials = self._get_openrouter_api_key(
            session, user
        )

        # Log agent processing details
        log_info(
            "Agent processing summary",
            session_id=session.id,
            chat_history_length=len(session.chat_history),
            summary_history_length=len(session.summary_history),
            style_guides_count=len(style_guides) if style_guides else 0,
            capabilities_count=len(capabilities) if capabilities else 0,
            # full_prompt_length=len(full_prompt),
            user_message=user_message,
            user_id=user.userId,
            snapshot_id=session.snapshot_id,
        )

        agent_run_id = str(uuid.uuid4())

        # PRE-RUN
        try:
            # Pre-load snapshot data and records for efficiency
            snapshot, preloaded_records, filtered_counts = self._load_snapshot_data(
                session, user, view_id, active_table_id, data_scope, record_id
            )

            # Create context with pre-loaded data

            chatRunContext: ChatRunContext = ChatRunContext(
                run_id=agent_run_id,
                session=session,
                user_id=user.userId,
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

            await progress_callback(
                "run_started",
                f"Run started with ID {agent_run_id}",
                {"run_id": agent_run_id},
            )

            # Prepare records and filtered counts for the utility function
            preloaded_records = chatRunContext.preloaded_records

            snapshot_context = build_snapshot_context(
                snapshot=snapshot,
                preloaded_records=preloaded_records,
                filtered_counts=filtered_counts,
                data_scope=data_scope,
                active_table_id=active_table_id,
                record_id=record_id,
                column_id=column_id,
            )

            # Add focus cells information to the prompt if they exist
            focus_context = build_focus_context(read_focus, write_focus)

            full_prompt = (
                f"RESPOND TO: {user_message} {snapshot_context} {focus_context}"
            )

            if user_open_router_credentials and user_open_router_credentials.apiKey:
                await progress_callback(
                    "create_agent",
                    f"Creating agent using the {model} model with user OpenRouter credentials",
                    {},
                )
            else:
                await progress_callback(
                    "create_agent",
                    f"Creating agent using the {model} model",
                    {},
                )

            agent = create_agent(
                api_key=api_key,
                model_name=model,
                capabilities=capabilities,
                style_guides=style_guides,
                data_scope=data_scope,
            )

            # Store the chat context so it can be accessed by the cancel system
            await self._run_state_manager.start_run(
                session.id,
                agent_run_id,
            )

            # Run the streaming with timeout
            logger.info(
                "Running agent with timeout",
                extra={
                    "session_id": session.id,
                    "timeout_seconds": timeout_seconds,
                },
            )

            start_time = asyncio.get_event_loop().time()
            result = await asyncio.wait_for(
                process_agent_stream(
                    agent=agent,
                    full_prompt=full_prompt,
                    chat_run_context=chatRunContext,
                    session=session,
                    agent_run_id=agent_run_id,
                    model=model,
                    run_state_manager=self._run_state_manager,
                    progress_callback=progress_callback,
                ),
                timeout=timeout_seconds,
            )
            end_time = asyncio.get_event_loop().time()
            execution_time = end_time - start_time
            logger.info(
                f"Agent run ended: session_id={session.id}, execution_time={execution_time}"
            )
        except asyncio.TimeoutError:
            log_error(
                "Agent processing timeout",
                session_id=session.id,
                timeout_seconds=30,
                snapshot_id=session.snapshot_id,
            )
            logger.info(f"❌ Agent.run() timed out after 30 seconds")
            raise HTTPException(status_code=408, detail="Agent response timeout")
        finally:
            await self._run_state_manager.delete_run(agent_run_id)

        # The agent returns an AgentRunResult wrapper, we need to extract the actual response

        logger.info(f"🔍 Agent result: {type(result)}")

        if isinstance(result, CancelledAgentRunResult):

            cancelled_result: CancelledAgentRunResult = result
            # cancelled by user, handle as a special response to the caller
            logger.info(f"Build response for cancelled run {agent_run_id}")

            if cancelled_result.usage_stats.requests > 0:
                try:
                    ScratchpadApi.track_token_usage(
                        user.userId,
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
                    logger.exception(
                        f"❌ Failed to track token usage through Scratchpaper API"
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
            logger.info(f"❌ No response from agent")
            raise HTTPException(
                status_code=500,
                detail="No response from agent. Please try again or switch to a different model if the problem persists.",
            )

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

            usage: RunUsage = result.usage()
            if usage:
                actual_response.usage_stats = UsageStats(
                    requests=usage.requests,
                    request_tokens=usage.input_tokens,
                    response_tokens=usage.output_tokens,
                    total_tokens=usage.input_tokens + usage.output_tokens,
                )

            try:
                ScratchpadApi.track_token_usage(
                    user.userId,
                    model,
                    usage.requests,
                    usage.input_tokens,
                    usage.output_tokens,
                    usage.input_tokens + usage.output_tokens,
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
                logger.exception(
                    f"❌ Failed to track token usage through Scratchpaper API"
                )

            return actual_response
        else:
            log_error(
                "Invalid agent response",
                session_id=session.id,
                response_type=type(result),
                snapshot_id=session.snapshot_id,
            )
            logger.info(f"❌ Invalid response from agent: {result}")
            raise HTTPException(
                status_code=500,
                detail="Invalid response from agent. Please try again or switch to a different model if the problem persists.",
            )

    async def cancel_agent_run(self, session_id: str, run_id: str) -> str:
        """Cancel a run"""
        logger.info(
            f"Cancelling agent run {run_id} for session {session_id}",
        )

        if not await self._run_state_manager.exists(session_id, run_id):
            logger.info(
                f"Run {run_id} not found",
                extra={"run_id": run_id, "session_id": session_id},
            )
            return "Run not found"

        await self._run_state_manager.cancel_run(run_id)
        return "Run cancelled"
