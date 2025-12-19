#!/usr/bin/env python3
"""
Agent Task Manager for handling asynchronous message processing
"""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from logging import getLogger
from typing import Awaitable, Callable, Dict, List, Optional

from server.agent_control_types import AgentRunInterface
from server.auth import AgentUser
from server.chat_service import ChatService
from server.DTOs import SendMessageRequestDTO
from server.session_service import SessionService
from session import ChatMessage, ChatSession, RequestAndResponseSummary

logger = getLogger(__name__)


@dataclass
class TaskHistoryItem:
    """Represents a finished task in history"""

    task_id: str
    session_id: str
    created_at: datetime
    updated_at: datetime
    status: str
    final_run_state: str
    user_message: str


class AgentRunTask:
    """Represents an asynchronous agent run task"""

    def __init__(
        self,
        task_id: str,
        session_id: str,
        user_message: str,
        asyncio_task: asyncio.Task,
    ):
        self.task_id = task_id
        self.session_id = session_id
        self.user_message = user_message
        self.asyncio_task = asyncio_task
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        # Tracks the top level status of the task
        # running, completed, failed
        self.status = "running"
        # Tracks the how the actual agent run is processing and is updated frequently by the agent stream processor
        # running, completed, error, stopping, stopped
        self.run_state = "running"
        # Tracks if user has initiated a stop of the agent
        self.stop_initiated = False

    def stop_task(self):
        """Stop the task"""
        self.stop_initiated = True
        self.updated_at = datetime.now(timezone.utc)

    def hard_cancel(self):
        """Cancel the task"""
        if not self.asyncio_task.done():
            self.asyncio_task.cancel()
            self.status = "cancelled"
            self.updated_at = datetime.now(timezone.utc)

    def mark_as_completed(self):
        """Mark the task as completed"""
        self.status = "completed"
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_failed(self):
        """Mark the task as failed"""
        self.status = "failed"
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_cancelled(self):
        """Mark the task as cancelled"""
        self.status = "cancelled"
        self.updated_at = datetime.now(timezone.utc)

    def update_run_state(self, run_state: str):
        """Update the run state of the task"""
        self.run_state = run_state
        self.updated_at = datetime.now(timezone.utc)


class AgentTaskManager:
    """Manages asynchronous message processing tasks"""

    def __init__(self, chat_service: ChatService, session_service: SessionService):
        self.chat_service = chat_service
        self.session_service = session_service
        self.active_tasks: Dict[str, AgentRunTask] = {}
        self.task_history: List[TaskHistoryItem] = []
        self._lock = asyncio.Lock()

    async def process_message_async(
        self,
        task_id: str,
        session: ChatSession,
        request: SendMessageRequestDTO,
        user: AgentUser,
        progress_callback: Callable[[str, str, dict], Awaitable[None]],
        completion_callback: Callable[[dict], Awaitable[None]],
        error_callback: Callable[[Exception], Awaitable[None]],
    ):
        """
        Process a message asynchronously with callbacks for progress, completion, and errors

        Args:
            task_id: Unique identifier for this task
            session: The chat session
            request: The message request DTO
            user: The authenticated user
            progress_callback: Called for progress updates
            completion_callback: Called when processing completes successfully
            error_callback: Called if processing fails
        """
        try:
            logger.info(f"Starting async message processing task {task_id}")

            # Convert style guides to dict format if provided
            prompt_assets_dict = {}
            if request.prompt_assets:
                prompt_assets_dict = {g.name: g.content for g in request.prompt_assets}

            # Add user message to history
            user_message = ChatMessage(
                message=request.message,
                role="user",
                timestamp=datetime.now(timezone.utc),
            )
            session.chat_history.append(user_message)
            logger.info(
                f"Added user message to chat history. New length: {len(session.chat_history)}"
            )

            async def is_stop_initiated_wrapper() -> bool:
                return await self.is_stop_initiated(task_id)

            async def update_run_state_wrapper(run_state: str) -> None:
                await self.update_run_state(task_id, run_state)

            agent_run_interface = AgentRunInterface(
                task_id=task_id,
                is_stop_initiated=is_stop_initiated_wrapper,
                update_run_state=update_run_state_wrapper,
            )

            # Process with agent
            agent_response = await self.chat_service.process_message_with_agent(
                agent_run_interface,
                session,
                request.message,
                user,
                prompt_assets_dict,
                request.model,
                request.capabilities,
                request.active_table_id,
                request.data_scope,
                request.record_id,
                request.column_id,
                request.credential_id,
                request.mentioned_table_ids,
                request.model_context_length,
                1800.0,  # 30 minutes timeout
                progress_callback,
            )

            # Add assistant response to chat history
            assistant_message = ChatMessage(
                message=agent_response.response_message,
                role="assistant",
                timestamp=datetime.now(timezone.utc),
                model=request.model,
                request_tokens=(
                    agent_response.usage_stats.request_tokens
                    if agent_response.usage_stats
                    else None
                ),
                response_tokens=(
                    agent_response.usage_stats.response_tokens
                    if agent_response.usage_stats
                    else None
                ),
                total_tokens=(
                    agent_response.usage_stats.total_tokens
                    if agent_response.usage_stats
                    else None
                ),
            )
            session.chat_history.append(assistant_message)
            logger.info(
                f"Added assistant message to chat history. New length: {len(session.chat_history)}"
            )

            # Add to summary history
            summary_entry = RequestAndResponseSummary(
                request_summary=agent_response.request_summary,
                response_summary=agent_response.response_summary,
                timestamp=datetime.now(timezone.utc),
            )
            session.summary_history.append(summary_entry)
            logger.info(
                f"Added to summary history. New length: {len(session.summary_history)}"
            )

            # Update session name if needed
            if session.name.startswith("New chat") and summary_entry.request_summary:
                new_name = (
                    request.message
                    if len(request.message) < 30
                    else request.message[:30] + "..."
                )
                session.name = new_name

            # Update session
            self.session_service.update_session(session, user.userId)
            logger.info(f"Session updated in storage")
            logger.info(
                f"Final session state - Chat History: {len(session.chat_history)}, "
                f"Summary History: {len(session.summary_history)}"
            )

            # Mark task as completed
            async with self._lock:
                if task_id in self.active_tasks:
                    self.active_tasks[task_id].mark_as_completed()

            # Call completion callback with response data
            await completion_callback(
                {
                    "type": "message_response",
                    "data": agent_response.model_dump(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

            logger.info(f"Completed async message processing task {task_id}")

        except asyncio.CancelledError:
            logger.info(f"Task {task_id} was cancelled")
            async with self._lock:
                if task_id in self.active_tasks:
                    self.active_tasks[task_id].mark_as_cancelled()
            raise
        except Exception as e:
            logger.exception(f"Error in async message processing task {task_id}: {e}")
            async with self._lock:
                if task_id in self.active_tasks:
                    self.active_tasks[task_id].mark_as_failed()
            await error_callback(e)
        finally:
            # Add task to history before removing from active tasks
            async with self._lock:
                if task_id in self.active_tasks:
                    task = self.active_tasks[task_id]
                    history_item = TaskHistoryItem(
                        task_id=task.task_id,
                        session_id=task.session_id,
                        created_at=task.created_at,
                        status=task.status,
                        updated_at=task.updated_at,
                        final_run_state=task.run_state if task.run_state else "unknown",
                        user_message=task.user_message,
                    )
                    # track newest first
                    self.task_history.insert(0, history_item)

                    # Keep only the most recent 1000 tasks
                    self.task_history = self.task_history[:1000]

                    # Clean up task from active tasks
                    del self.active_tasks[task_id]

    async def start_message_task(
        self,
        session: ChatSession,
        request: SendMessageRequestDTO,
        user: AgentUser,
        progress_callback: Callable[[str, str, dict], Awaitable[None]],
        completion_callback: Callable[[dict], Awaitable[None]],
        error_callback: Callable[[Exception], Awaitable[None]],
    ) -> str:
        """
        Start a new message processing task

        Returns:
            task_id: The unique identifier for the created task
        """
        task_id = str(uuid.uuid4())

        # Create the asyncio task
        asyncio_task = asyncio.create_task(
            self.process_message_async(
                task_id,
                session,
                request,
                user,
                progress_callback,
                completion_callback,
                error_callback,
            )
        )

        # Store the task
        message_task = AgentRunTask(
            task_id=task_id,
            session_id=session.id,
            asyncio_task=asyncio_task,
            user_message=request.message,
        )
        async with self._lock:
            self.active_tasks[task_id] = message_task

        logger.info(f"Started message task {task_id} for session {session.id}")
        return task_id

    async def hard_cancel_task(self, task_id: str) -> bool:
        """
        Attempts a hard cancellation of a running task by trying to kill the underlying asyncio task

        WARNING: this will not gracefully handle the task cancellation so a response will not be returned to the client.

        Returns:
            True if task was found and cancelled, False otherwise
        """
        async with self._lock:
            if task_id in self.active_tasks:
                task = self.active_tasks[task_id]
                task.hard_cancel()
                logger.info(f"Cancelled task {task_id}")
                return True
        logger.warning(f"Task {task_id} not found")
        return False

    async def initiate_stop(self, task_id: str):
        """Initiate a stop of a running task"""
        async with self._lock:
            if task_id in self.active_tasks:
                task = self.active_tasks[task_id]
                task.stop_task()
                logger.info(f"Initiated stop of task {task_id}")
                return f"Initiated stop of task {task_id}"
        logger.warning(f"Task {task_id} not found")
        return f"Task {task_id} not found"

    async def get_task(self, task_id: str) -> Optional[AgentRunTask]:
        """Get the task"""
        async with self._lock:
            if task_id in self.active_tasks:
                return self.active_tasks[task_id]
        return None

    async def get_active_task_count(self) -> int:
        """Get the number of active tasks"""
        async with self._lock:
            return len(self.active_tasks)

    async def get_task_history(self) -> List[TaskHistoryItem]:
        """Get the task history"""
        async with self._lock:
            return self.task_history.copy()

    async def get_active_tasks(self) -> List[AgentRunTask]:
        """Get the active tasks"""
        async with self._lock:
            active_tasks = list(self.active_tasks.values())
            active_tasks.sort(key=lambda x: x.created_at, reverse=True)
            return active_tasks

    async def is_stop_initiated(self, task_id: str) -> bool:
        """Check if the stop has been initiated for a task"""
        async with self._lock:
            if task_id in self.active_tasks:
                return self.active_tasks[task_id].stop_initiated
        return False

    async def update_run_state(self, task_id: str, run_state: str):
        """Update the run state of a task"""
        async with self._lock:
            if task_id in self.active_tasks:
                self.active_tasks[task_id].update_run_state(run_state)
