from ast import Dict
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional

from agents.data_agent.models import (
    ChatSession,
)
from logging import getLogger

logger = getLogger(__name__)


# TODO: refactor this as a service or singleton class
class SessionService:
    """
    Service for managing chat sessions.

    Just does in-memory storage of sessions for now, but should switch to DB or redis in the future.
    """

    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}

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

        self._sessions[session_id] = session

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

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a session by ID"""
        return self._sessions.get(session_id)

    def delete_session(self, session_id: str) -> None:
        """Delete a session by ID"""
        del self._sessions[session_id]

    def update_session(self, session: ChatSession) -> None:
        """Update a session"""
        self._sessions[session.id] = session

    def exists(self, session_id: str) -> bool:
        """Check if a session exists by ID"""
        return session_id in self._sessions

    def get_sessions_for_snapshot(
        self, snapshot_id: Optional[str] = None
    ) -> List[ChatSession]:
        """Get all sessions"""
        if snapshot_id:
            return [
                session
                for session in self._sessions.values()
                if session.snapshot_id == snapshot_id
            ]
        else:
            return list(self._sessions.values())

    def get_sessions_for_user(self, user_id: str) -> List[ChatSession]:
        """Get all sessions for a user"""
        return [
            session for session in self._sessions.values() if session.user_id == user_id
        ]

    def list_session_ids(self) -> List[str]:
        """List all session IDs"""
        return list(self._sessions.keys())
