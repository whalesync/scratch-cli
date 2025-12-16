#!/usr/bin/env python3
"""
WebSocket Handler for real-time chat
"""


from datetime import datetime, timezone
from logging import getLogger
from typing import Dict, Optional

from fastapi import WebSocket
from server.agent_task_manager import AgentTaskManager
from server.chat_service import ChatService
from server.session_service import SessionService

logger = getLogger(__name__)


class WebSocketConnection:
    """
    A class to track a websocket connection and its activity.
    """

    def __init__(self, websocket: WebSocket):
        """
        Initialize a new websocket connection.
        """
        self.websocket = websocket
        self.created_at = datetime.now(timezone.utc)
        self.last_activity_at = self.created_at
        self.last_activity_type = "connect"

    def track_last_activity(self, activity_type: str):
        self.last_activity_at = datetime.now(timezone.utc)
        self.last_activity_type = activity_type

    def __str__(self):
        return f"WebSocketConnection(created_at={self.created_at}, last_activity_at={self.last_activity_at}, last_activity_type={self.last_activity_type})"


class ConnectionManager:
    def __init__(
        self,
        chat_service: ChatService,
        session_service: SessionService,
        agent_task_manager: AgentTaskManager,
    ):
        """
        Initialize ConnectionManager. Services will be injected when get_connection_manager is called.
        """
        self.active_connections: Dict[str, WebSocketConnection] = {}
        self.chat_service = chat_service
        self.session_service = session_service
        self.agent_task_manager = agent_task_manager

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = WebSocketConnection(websocket)

    def disconnect(self, session_id: str, websocket: Optional[WebSocket] = None):
        """
        Disconnect a session. If websocket is provided, only disconnect if it matches
        the stored connection (to avoid disconnecting a reconnected connection).
        """
        if session_id in self.active_connections:
            stored_websocket = self.active_connections[session_id]
            # If a specific websocket is provided, only disconnect if it matches
            # This prevents disconnecting a reconnected connection
            if websocket is None or stored_websocket.websocket == websocket:
                del self.active_connections[session_id]
                logger.info(f"Connection removed for session {session_id}")
            else:
                logger.debug(
                    f"Disconnect skipped for session {session_id}: connection was replaced"
                )

    def track_activity(self, session_id: str, activity_type: str):
        if session_id in self.active_connections:
            stored_websocket = self.active_connections[session_id]
            if stored_websocket and stored_websocket.websocket:
                stored_websocket.track_last_activity(activity_type)

    async def send_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            stored_websocket = self.active_connections[session_id]

            if stored_websocket and stored_websocket.websocket:
                try:
                    await stored_websocket.websocket.send_text(message)
                    stored_websocket.track_last_activity("send_message")
                except Exception as e:
                    logger.error(f"Failed to send message to {session_id}: {e}")
                    # Remove the connection if it's broken, but only if it's still the same websocket
                    self.disconnect(session_id, stored_websocket.websocket)
