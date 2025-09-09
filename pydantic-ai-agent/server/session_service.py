from typing import Dict, List, Optional
import asyncio
from datetime import datetime, timedelta
import json

from agents.data_agent.models import (
    ChatSession,
)
from scratchpad.api import ScratchpadApi
from logging import getLogger
from session import ChatMessage, RequestAndResponseSummary

# from agents.data_agent.models import ChatMessage, RequestAndResponseSummary


logger = getLogger(__name__)


# TODO: refactor this as a service or singleton class
class SessionService:
    """
    Service for managing chat sessions.

    Now uses API server for persistence with in-memory cache for performance.
    """

    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}
        self._api = ScratchpadApi()

    def create_session(
        self, user_id: str, session_id: str, snapshot_id: str
    ) -> ChatSession:
        """Create a new chat session and set session data in tools"""
        now = datetime.now()
        session = ChatSession(
            id=session_id,
            name=f"New chat {now.strftime('%Y-%m-%d %H:%M')}",
            user_id=user_id,
            last_activity=now,
            created_at=now,
            snapshot_id=snapshot_id,
        )

        logger.info(
            "Session created",
            extra={"session_id": session_id, "snapshot_id": snapshot_id},
        )

        # Store in memory cache
        self._sessions[session_id] = session

        # Persist to API server
        self._persist_session(user_id, session)

        return session

    def cleanup_inactive_sessions(self, max_age_hours: int = 24) -> None:
        """Clean up inactive sessions"""
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        to_delete = []

        for session_id, session in self._sessions.items():
            if session.last_activity < cutoff:
                to_delete.append(session_id)

        for session_id in to_delete:
            del self._sessions[session_id]

        if to_delete:
            logger.info(f"🧹 Cleaned up {len(to_delete)} inactive sessions")

    def get_session(
        self, session_id: str, user_id: Optional[str] = None
    ) -> Optional[ChatSession]:
        """Get a session by ID"""
        # First check memory cache
        if session_id in self._sessions:
            return self._sessions[session_id]

        # If not in cache and we have user_id, try to load from API
        if user_id:
            try:
                session_data = self._api.get_agent_session(user_id, session_id)
                if session_data:
                    session = self._deserialize_session(session_data["data"])
                    self._sessions[session_id] = session
                    return session
            except Exception as e:
                logger.warning(f"Failed to load session from API: {e}")

        return None

    def delete_session(self, session_id: str, user_id: Optional[str] = None) -> None:
        """Delete a session by ID"""
        # Remove from memory cache
        if session_id in self._sessions:
            del self._sessions[session_id]

        # Delete from API server
        if user_id:
            try:
                self._api.delete_agent_session(user_id, session_id)
            except Exception as e:
                logger.warning(f"Failed to delete session from API: {e}")

    def update_session(
        self, session: ChatSession, user_id: Optional[str] = None
    ) -> None:
        """Update a session"""
        # Update memory cache
        self._sessions[session.id] = session

        # Persist to API server
        if user_id:
            self._persist_session(user_id, session)

    def exists(self, session_id: str) -> bool:
        """Check if a session exists by ID"""
        return session_id in self._sessions

    def get_sessions_for_snapshot(
        self, snapshot_id: Optional[str] = None, user_id: Optional[str] = None
    ) -> List[ChatSession]:
        """Get all sessions, loading from API if needed"""
        # First, get sessions from memory cache
        if snapshot_id:
            cached_sessions = [
                session
                for session in self._sessions.values()
                if session.snapshot_id == snapshot_id
            ]
        else:
            cached_sessions = list(self._sessions.values())

        # If we have cached sessions, return them
        if cached_sessions:
            return cached_sessions

        # If no cached sessions and we have both snapshot_id and user_id, try to load from API
        if snapshot_id and user_id:
            try:
                logger.info(
                    f"No cached sessions found for snapshot {snapshot_id}, loading from API"
                )
                persisted_sessions = self._api.list_agent_sessions_by_snapshot(
                    user_id, snapshot_id
                )

                # Convert persisted sessions to ChatSession objects and cache them
                loaded_sessions = []
                for persisted_session in persisted_sessions:
                    session_data = persisted_session.get("data", {})
                    if session_data:
                        session = self._deserialize_session(session_data)
                        self._sessions[session.id] = session
                        loaded_sessions.append(session)

                logger.info(
                    f"Loaded {len(loaded_sessions)} sessions from API for snapshot {snapshot_id}"
                )
                return loaded_sessions

            except Exception as e:
                logger.warning(
                    f"Failed to load sessions from API for snapshot {snapshot_id}: {e}"
                )
                return []

        return []

    def get_sessions_for_user(self, user_id: str) -> List[ChatSession]:
        """Get all sessions for a user"""
        return [
            session for session in self._sessions.values() if session.user_id == user_id
        ]

    def list_session_ids(self) -> List[str]:
        """List all session IDs"""
        return list(self._sessions.keys())

    def _persist_session(self, user_id: str, session: ChatSession) -> None:
        """Persist a session to the API server"""
        try:
            session_data = self._serialize_session(session)
            self._api.save_agent_session(user_id, session.id, session_data)
        except Exception as e:
            logger.warning(f"Failed to persist session to API: {e}")

    def _serialize_session(self, session: ChatSession) -> Dict[str, any]:
        """Serialize a ChatSession to a dictionary for storage"""
        return {
            "id": session.id,
            "name": session.name,
            "user_id": session.user_id,
            "last_activity": session.last_activity.isoformat(),
            "created_at": session.created_at.isoformat(),
            "snapshot_id": session.snapshot_id,
            "chat_history": [
                {
                    "message": msg.message,
                    "role": msg.role,
                    "timestamp": msg.timestamp.isoformat(),
                }
                for msg in session.chat_history
            ],
            "summary_history": [
                {
                    "request_summary": summary.request_summary,
                    "response_summary": summary.response_summary,
                    "timestamp": summary.timestamp.isoformat(),
                }
                for summary in session.summary_history
            ],
        }

    def _deserialize_session(self, data: Dict[str, any]) -> ChatSession:
        """Deserialize a dictionary back to a ChatSession"""

        # Deserialize chat history
        chat_history = []
        for msg_data in data.get("chat_history", []):
            chat_history.append(
                ChatMessage(
                    message=msg_data["message"],
                    role=msg_data["role"],
                    timestamp=datetime.fromisoformat(msg_data["timestamp"]),
                )
            )

        # Deserialize summary history
        summary_history = []
        for summary_data in data.get("summary_history", []):
            summary_history.append(
                RequestAndResponseSummary(
                    request_summary=summary_data["request_summary"],
                    response_summary=summary_data["response_summary"],
                    timestamp=datetime.fromisoformat(summary_data["timestamp"]),
                )
            )

        # Create session
        session = ChatSession(
            id=data["id"],
            name=data["name"],
            user_id=data["user_id"],
            last_activity=datetime.fromisoformat(data["last_activity"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            snapshot_id=data["snapshot_id"],
            chat_history=chat_history,
            summary_history=summary_history,
        )

        return session
