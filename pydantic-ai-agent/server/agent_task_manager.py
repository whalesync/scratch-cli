#!/usr/bin/env python3
"""
Agent Task Manager for handling asynchronous message processing
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Callable, Awaitable, List
from dataclasses import dataclass
from logging import getLogger

from session import ChatMessage, RequestAndResponseSummary, ChatSession
from server.chat_service import ChatService
from server.session_service import SessionService
from server.auth import AgentUser
from server.DTOs import SendMessageRequestDTO

logger = getLogger(__name__)


@dataclass
class TaskHistoryItem:
    """Represents a finished task in history"""

    task_id: str
    session_id: str
    created_at: datetime
    updated_at: datetime
    status: str


class AgentMessageTask:
    """Represents an asynchronous message processing task"""

    def __init__(
        self,
        task_id: str,
        session_id: str,
        asyncio_task: asyncio.Task,
    ):
        self.task_id = task_id
        self.session_id = session_id
        self.asyncio_task = asyncio_task
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.status = "running"  # running, completed, failed, cancelled

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


class AgentTaskManager:
    """Manages asynchronous message processing tasks"""

    def __init__(self, chat_service: ChatService, session_service: SessionService):
        self.chat_service = chat_service
        self.session_service = session_service
        self.active_tasks: Dict[str, AgentMessageTask] = {}
        self.task_history: List[TaskHistoryItem] = []

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
            style_guides_dict = {}
            if request.style_guides:
                style_guides_dict = {g.name: g.content for g in request.style_guides}

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

            # Process with agent
            agent_response = await self.chat_service.process_message_with_agent(
                task_id,
                session,
                request.message,
                user,
                style_guides_dict,
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
            if task_id in self.active_tasks:
                self.active_tasks[task_id].mark_as_cancelled()
            raise
        except Exception as e:
            logger.exception(f"Error in async message processing task {task_id}: {e}")
            if task_id in self.active_tasks:
                self.active_tasks[task_id].mark_as_failed()
            await error_callback(e)
        finally:
            # Add task to history before removing from active tasks
            if task_id in self.active_tasks:
                task = self.active_tasks[task_id]
                history_item = TaskHistoryItem(
                    task_id=task.task_id,
                    session_id=task.session_id,
                    created_at=task.created_at,
                    status=task.status,
                    updated_at=task.updated_at,
                )
                # track newest first
                self.task_history.insert(0, history_item)

                # Keep only the most recent 1000 tasks
                self.task_history = self.task_history[:1000]

                # Clean up task from active tasks
                del self.active_tasks[task_id]

    def start_message_task(
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
        message_task = AgentMessageTask(
            task_id=task_id,
            session_id=session.id,
            asyncio_task=asyncio_task,
        )
        self.active_tasks[task_id] = message_task

        logger.info(f"Started message task {task_id} for session {session.id}")
        return task_id

    def hard_cancel_task(self, task_id: str) -> bool:
        """
        Attempts a hard cancellation of a running task by trying to kill the underlying asyncio task

        WARNING: Unlike communciating through the AgentRunStateManager, this will not gracefully handle the task cancellation so a response will not be returned to the client.

        Returns:
            True if task was found and cancelled, False otherwise
        """
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            task.hard_cancel()
            logger.info(f"Cancelled task {task_id}")
            return True
        logger.warning(f"Task {task_id} not found")
        return False

    def get_task_status(self, task_id: str) -> Optional[str]:
        """Get the status of a task"""
        if task_id in self.active_tasks:
            return self.active_tasks[task_id].status
        return None

    def get_active_task_count(self) -> int:
        """Get the number of active tasks"""
        return len(self.active_tasks)

    def get_task_history(self) -> List[TaskHistoryItem]:
        """Get the task history"""
        return self.task_history
