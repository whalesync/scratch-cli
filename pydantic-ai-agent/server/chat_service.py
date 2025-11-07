#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import os
import uuid
from typing import Dict, List, Optional, Any, Callable, Awaitable
from fastapi import HTTPException
from pydantic_ai.usage import RunUsage, UsageLimits

from agents.data_agent.models import (
    ChatRunContext,
    ChatSession,
    ResponseFromAgent,
    UsageStats,
)
from agents.data_agent.agent import create_agent
from utils.response_extractor import extract_response
from logger import log_info, log_error
from logging import getLogger

from scratchpad.api import ScratchpadApi

from server.user_prompt_utils import build_snapshot_context
from server.agent_stream_processor import (
    process_agent_stream,
    CancelledAgentRunResult,
)
from server.exceptions import TokenLimitExceededException

from agents.data_agent.data_agent_utils import (
    convert_scratchpad_snapshot_to_ai_snapshot,
)
from agents.data_agent.data_agent_history_processor import (
    data_agent_history_processor,
)
from utils.helpers import find_first_matching, mask_string
from server.agent_run_state_manager import AgentRunStateManager
from server.session_service import SessionService
from server.auth import AgentUser

logger = getLogger(__name__)


# TODO: refactor this as a service or singleton class
class ChatService:
    def __init__(self, session_service: SessionService):
        self._session_service = session_service
        self._run_state_manager = AgentRunStateManager()

    def _log_processing_start(
        self,
        session: ChatSession,
        capabilities: Optional[List[str]],
        style_guides: Dict[str, str],
        data_scope: Optional[str],
    ) -> None:
        """Log the start of agent processing with relevant context"""
        logger.info(
            "Starting agent processing",
            extra={"session_id": session.id, "snapshot_id": session.snapshot_id},
        )

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
        self, session: ChatSession, user: AgentUser, credential_id: Optional[str] = None
    ) -> tuple[str, Optional[Any]]:
        """Get the OpenRouter API key for the agent, handling user credentials and validation"""
        try:
            # load agent credentials for the user, this both verifies the api_token is active AND gets any
            # openrouter credentials for the user has access to
            if credential_id:
                logger.info(
                    "Loading personal openrouter credentials by id",
                )
                user_open_router_credentials = (
                    ScratchpadApi.get_agent_credentials_by_id(
                        user.userId, credential_id
                    )
                )
            else:
                # TODO(chris): remove this code path when this endpoint gets deperecated on the API server
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

        if not user_open_router_credentials:
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
        active_table_id: Optional[str],
        data_scope: Optional[str],
        record_id: Optional[str],
        mentioned_table_ids: Optional[List[str]] = None,
    ) -> tuple[Any, Dict[str, List[Dict]], Dict[str, int]]:
        """Load snapshot data and preload records for efficiency"""
        logger.info(
            "Pre-loading snapshot data and records",
        )
        snapshot_data = None
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

            snapshot = convert_scratchpad_snapshot_to_ai_snapshot(
                snapshot_data, session
            )

            # Pre-load records for each table
            for table in snapshot.tables:
                # Determine if this is the active table
                is_active_table = (not active_table_id) or (
                    active_table_id == table.id.wsId
                )

                # Determine if this table is mentioned
                is_mentioned_table = (
                    mentioned_table_ids and table.id.wsId in mentioned_table_ids
                )

                # Load records for active or mentioned tables
                should_load_records = is_active_table or is_mentioned_table

                if (
                    record_id
                    and (data_scope == "record" or data_scope == "column")
                    and is_active_table
                ):
                    # just preload the one record from the active table
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
                elif should_load_records:
                    # Load all records for active or mentioned tables
                    try:
                        records_result = ScratchpadApi.list_records_for_ai(
                            user.userId,
                            session.snapshot_id,
                            table.id.wsId,
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
                        table_reason = "active" if is_active_table else "mentioned"
                        if is_active_table and is_mentioned_table:
                            table_reason = "active and mentioned"
                        logger.info(
                            f"📊 Pre-loaded {len(preloaded_records[table.name])} records for {table_reason} table '{table.name}'"
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
                else:
                    # Load just 1 sample record for non-active tables
                    try:
                        records_result = ScratchpadApi.list_records_for_ai(
                            user.userId,
                            session.snapshot_id,
                            table.id.wsId,
                            # take=1,  #we used to include a sample record from the non active tables, now we dump everything that the user sees
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
                            f"📊 Pre-loaded 1 sample record for non-active table '{table.name}'"
                        )
                    except Exception as e:
                        logger.exception(
                            f"⚠️ Failed to pre-load sample record for table '{table.name}'"
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
        capabilities: Optional[List[str]] = None,
        active_table_id: Optional[str] = None,
        data_scope: Optional[str] = None,
        record_id: Optional[str] = None,
        column_id: Optional[str] = None,
        credential_id: Optional[str] = None,
        mentioned_table_ids: Optional[List[str]] = None,
        model_context_length: Optional[int] = None,
        timeout_seconds: float = 60.0,
        progress_callback: Optional[Callable[[str, str, dict], Awaitable[None]]] = None,
    ) -> ResponseFromAgent:
        """Process a message with the agent and return the response"""
        # Define noop callback if none provided so that we don't have to check for None everywhere
        if progress_callback is None:

            async def noop_callback(status: str, message: str, data: dict) -> None:
                pass

            progress_callback = noop_callback

        self._log_processing_start(session, capabilities, style_guides, data_scope)

        # Determine the API key to use for the agent
        api_key, user_open_router_credentials = self._get_openrouter_api_key(
            session, user, credential_id
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
                session,
                user,
                active_table_id,
                data_scope,
                record_id,
                mentioned_table_ids,
            )

            # Create context with pre-loaded data

            chatRunContext: ChatRunContext = ChatRunContext(
                run_id=agent_run_id,
                session=session,
                user_id=user.userId,
                snapshot=snapshot,
                preloaded_records=preloaded_records,
                active_table_id=active_table_id,
                data_scope=data_scope,
                record_id=record_id,
                column_id=column_id,
                mentioned_table_ids=mentioned_table_ids,
            )

            await progress_callback(
                "run_started",
                f"Run started with ID {agent_run_id}",
                {"run_id": agent_run_id},
            )

            # The snapshot context is now handled by dynamic instructions
            # in the agent, so we just pass the user message directly
            full_prompt = user_message

            if user_open_router_credentials and user_open_router_credentials.apiKey:
                await progress_callback(
                    "create_agent",
                    f"Creating agent using the {model} model with user OpenRouter credentials",
                    {},
                )
            else:
                await progress_callback(
                    "create_agent", f"Creating agent using the {model} model", {}
                )

            agent = create_agent(
                api_key=api_key,
                model_name=model,
                capabilities=capabilities,
                style_guides=style_guides,
                data_scope=data_scope,
                filtered_counts=filtered_counts,
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
                    model_context_length=model_context_length,
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
                timeout_seconds=timeout_seconds,
                snapshot_id=session.snapshot_id,
            )
            logger.info(f"❌ Agent.run() timed out after {timeout_seconds} seconds")
            raise HTTPException(status_code=408, detail="Agent response timeout")
        except TokenLimitExceededException as e:
            log_error(
                "Token limit exceeded",
                session_id=session.id,
                requested_tokens=e.requested_tokens,
                max_tokens=e.max_tokens,
                snapshot_id=session.snapshot_id,
            )
            logger.info(
                f"❌ Token limit exceeded: {e.requested_tokens} requested, {e.max_tokens} max"
            )
            raise HTTPException(status_code=413, detail=str(e))
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
                        f"❌ Failed to track token usage through Scratch API"
                    )

            return ResponseFromAgent(
                response_message="Request cancelled by user",
                response_summary="Request cancelled by user",
                request_summary="Request cancelled by user",
                usage_stats=cancelled_result.usage_stats,
            )

        # Apply history processor to clean up data-fetch tool responses before persisting
        raw_messages = result.all_messages()
        cleaned_messages = data_agent_history_processor(raw_messages)
        session.message_history = cleaned_messages

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
                logger.exception(f"❌ Failed to track token usage through Scratch API")

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
