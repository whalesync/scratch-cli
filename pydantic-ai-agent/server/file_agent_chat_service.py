#!/usr/bin/env python3
"""
File Agent Chat Service for handling file agent communication and session management
"""

import asyncio
from logging import getLogger
from typing import Any, Awaitable, Callable, Dict, Optional

from agents.file_agent.agent import create_file_agent
from agents.file_agent.models import FileAgentResponse, FileAgentRunContext
from fastapi import HTTPException
from logger import log_error, log_info
from pydantic_ai.usage import RunUsage
from scratchpad.api import ScratchpadApi
from server.agent_control_types import AgentRunInterface
from server.agent_stream_processor import StoppedAgentRunResult, process_agent_stream
from server.auth import AgentUser
from server.exceptions import TokenLimitExceededException
from server.session_service import SessionService
from session import ChatSession
from utils.helpers import mask_string
from utils.response_extractor import extract_response

logger = getLogger(__name__)


class FileAgentChatService:
    def __init__(self, session_service: SessionService):
        self._session_service = session_service

    def _log_processing_start(
        self,
        session: ChatSession,
    ) -> None:
        """Log the start of file agent processing"""
        logger.info(
            "Starting file agent processing",
            extra={"session_id": session.id, "workbook_id": session.workbook_id},
        )

    def _get_openrouter_api_key(
        self, session: ChatSession, user: AgentUser, credential_id: Optional[str] = None
    ) -> tuple[str, Optional[Any]]:
        """Get the OpenRouter API key for the agent"""
        try:
            if credential_id:
                logger.info("Loading personal openrouter credentials by id")
                user_open_router_credentials = (
                    ScratchpadApi.get_agent_credentials_by_id(
                        user.userId, credential_id
                    )
                )
            else:
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
                detail="Error authenticating credentials for agent processing.",
            )

        if not user_open_router_credentials:
            log_error(
                f"User does not have openrouter credentials configured for user {user.userId}",
                session_id=session.id,
            )
            raise HTTPException(
                status_code=401,
                detail="User agent credentials required",
            )

        api_key = None
        if user_open_router_credentials and user_open_router_credentials.apiKey:
            logger.info(
                f"Using personal openrouter credentials: {user_open_router_credentials.id}"
            )
            api_key = user_open_router_credentials.apiKey

        if api_key:
            api_key = api_key.strip()

        if not api_key:
            raise HTTPException(
                status_code=401, detail="Unable to find an OpenRouter API key for agent"
            )

        return api_key, user_open_router_credentials

    async def process_message_with_agent(
        self,
        agent_run_task: AgentRunInterface,
        session: ChatSession,
        user_message: str,
        user: AgentUser,
        model: Optional[str] = None,
        credential_id: Optional[str] = None,
        active_folder_path: Optional[str] = "/",
        active_file_path: Optional[str] = None,
        model_context_length: Optional[int] = None,
        timeout_seconds: float = 60.0,
        progress_callback: Optional[Callable[[str, str, dict], Awaitable[None]]] = None,
    ) -> FileAgentResponse:
        """Process a message with the file agent and return the response"""
        if progress_callback is None:

            async def noop_callback(status: str, message: str, data: dict) -> None:
                pass

            progress_callback = noop_callback

        self._log_processing_start(session)

        # Get API key
        api_key, user_open_router_credentials = self._get_openrouter_api_key(
            session, user, credential_id
        )

        log_info(
            "File agent processing summary",
            session_id=session.id,
            chat_history_length=len(session.chat_history),
            user_message=user_message,
            user_id=user.userId,
            workbook_id=session.workbook_id,
            active_folder_path=active_folder_path,
            active_file_path=active_file_path,
        )

        try:
            # Create file agent context - much simpler than data agent
            file_agent_context = FileAgentRunContext(
                run_id=agent_run_task.task_id,
                session=session,
                user_id=user.userId,
                active_folder_path=active_folder_path,
                active_file_path=active_file_path,
            )

            await progress_callback(
                "run_started",
                f"Run started with ID {agent_run_task.task_id}",
                {"run_id": agent_run_task.task_id},
            )

            full_prompt = user_message

            if user_open_router_credentials and user_open_router_credentials.apiKey:
                await progress_callback(
                    "create_agent",
                    f"Creating file agent using the {model} model with user OpenRouter credentials",
                    {},
                )
            else:
                await progress_callback(
                    "create_agent", f"Creating file agent using the {model} model", {}
                )

            agent = create_file_agent(
                api_key=api_key,
                model_name=model,
            )

            await agent_run_task.update_run_state("agent_running")

            logger.info(
                "Running file agent with timeout",
                extra={
                    "session_id": session.id,
                    "timeout_seconds": timeout_seconds,
                },
            )

            start_time = asyncio.get_event_loop().time()
            result = await asyncio.wait_for(
                process_agent_stream(
                    agent=agent,
                    agent_run_task=agent_run_task,
                    full_prompt=full_prompt,
                    chat_run_context=file_agent_context,
                    session=session,
                    model=model,
                    progress_callback=progress_callback,
                    model_context_length=model_context_length,
                ),
                timeout=timeout_seconds,
            )
            end_time = asyncio.get_event_loop().time()
            execution_time = end_time - start_time
            logger.info(
                f"File agent run ended: session_id={session.id}, execution_time={execution_time}"
            )
        except asyncio.TimeoutError:
            log_error(
                "File agent processing timeout",
                session_id=session.id,
                timeout_seconds=timeout_seconds,
                workbook_id=session.workbook_id,
            )
            await agent_run_task.update_run_state("timeout")
            raise HTTPException(status_code=408, detail="Agent response timeout")
        except TokenLimitExceededException as e:
            log_error(
                "Token limit exceeded",
                session_id=session.id,
                requested_tokens=e.requested_tokens,
                max_tokens=e.max_tokens,
                workbook_id=session.workbook_id,
            )
            await agent_run_task.update_run_state("token_limit_exceeded")
            raise HTTPException(status_code=413, detail=str(e))

        logger.info(f"File agent result: {type(result)}")

        if result is None:
            log_error(
                "Invalid file agent response of None",
                session_id=session.id,
                workbook_id=session.workbook_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Invalid response from file agent.",
            )

        if isinstance(result, StoppedAgentRunResult):
            stopped_result: StoppedAgentRunResult = result
            logger.info(f"Build response for cancelled run {agent_run_task.task_id}")

            if stopped_result.usage_stats.requests > 0:
                try:
                    ScratchpadApi.track_token_usage(
                        user.userId,
                        credential_id,
                        model,
                        stopped_result.usage_stats.requests,
                        stopped_result.usage_stats.request_tokens,
                        stopped_result.usage_stats.response_tokens,
                        stopped_result.usage_stats.total_tokens,
                        usage_context={
                            "session_id": session.id,
                            "workbook_id": session.workbook_id,
                            "agent_type": "file_agent",
                            "cancelled_by_user": True,
                        },
                    )
                except Exception as e:
                    logger.exception("Failed to track token usage through Scratch API")

            return FileAgentResponse(
                response_message="Request stopped by user",
                response_summary="Request stopped by user",
                request_summary="Request stopped by user",
                usage_stats=stopped_result.usage_stats,
            )

        # Don't process history for file agent - it's simpler
        session.message_history = result.all_messages()

        actual_response = extract_response(result, FileAgentResponse)
        if not actual_response:
            log_error(
                "No response from file agent",
                session_id=session.id,
                workbook_id=session.workbook_id,
            )
            raise HTTPException(
                status_code=500,
                detail="No response from file agent.",
            )

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
                "File agent response summary info",
                session_id=session.id,
                response_length=len(response_message),
                response_summary_length=len(response_summary),
                request_summary_length=len(request_summary),
                workbook_id=session.workbook_id,
            )

            usage: RunUsage = result.usage()
            if usage:
                from agents.file_agent.models import FileAgentUsageStats

                actual_response.usage_stats = FileAgentUsageStats(
                    requests=usage.requests,
                    request_tokens=usage.input_tokens,
                    response_tokens=usage.output_tokens,
                    total_tokens=usage.input_tokens + usage.output_tokens,
                )

            try:
                usage_context = {
                    "session_id": session.id,
                    "workbook_id": session.workbook_id,
                    "agent_type": "file_agent",
                    "active_folder_path": active_folder_path,
                    "active_file_path": active_file_path,
                }

                if usage.details:
                    usage_context.update(usage.details)

                ScratchpadApi.track_token_usage(
                    user.userId,
                    credential_id,
                    model,
                    usage.requests,
                    usage.input_tokens,
                    usage.output_tokens,
                    usage.input_tokens + usage.output_tokens,
                    usage_context=usage_context,
                )
            except Exception as e:
                logger.exception("Failed to track token usage through Scratch API")

            return actual_response
        else:
            log_error(
                "Invalid file agent response",
                session_id=session.id,
                response_type=type(result),
                workbook_id=session.workbook_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Invalid response from file agent.",
            )
