#!/usr/bin/env python3
"""
WebSocket Handler for real-time chat
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Optional
from fastapi import WebSocket, WebSocketDisconnect

from session import ChatMessage, RequestAndResponseSummary
from server.DTOs import (
    SendMessageRequestDTO,
)
from server.chat_service import ChatService
from server.session_service import SessionService
from logger import log_info, log_error
from logging import getLogger
from server.auth import decode_and_validate_agent_jwt
from server.exception_mapping import exception_mapping


logger = getLogger(__name__)


class ConnectionManager:
    def __init__(self, chat_service: ChatService, session_service: SessionService):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_service = chat_service
        self.session_service = session_service

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str, websocket: Optional[WebSocket] = None):
        """
        Disconnect a session. If websocket is provided, only disconnect if it matches
        the stored connection (to avoid disconnecting a reconnected connection).
        """
        if session_id in self.active_connections:
            stored_websocket = self.active_connections[session_id]
            # If a specific websocket is provided, only disconnect if it matches
            # This prevents disconnecting a reconnected connection
            if websocket is None or stored_websocket == websocket:
                del self.active_connections[session_id]
                logger.info(f"Connection removed for session {session_id}")
            else:
                logger.debug(
                    f"Disconnect skipped for session {session_id}: connection was replaced"
                )

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                # Remove the connection if it's broken, but only if it's still the same websocket
                self.disconnect(session_id, websocket)


# Global connection manager instance (shared across all websocket connections)
_connection_manager: Optional[ConnectionManager] = None


def get_connection_manager(
    chat_service: ChatService, session_service: SessionService
) -> ConnectionManager:
    """Get or create the shared connection manager instance"""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager(chat_service, session_service)
    return _connection_manager


async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    chat_service: ChatService,
    session_service: SessionService,
    auth: Optional[str] = None,
):
    """WebSocket endpoint for real-time chat"""
    manager = get_connection_manager(chat_service, session_service)
    await manager.connect(websocket, session_id)

    if auth:
        connecting_user = decode_and_validate_agent_jwt(auth)
    else:
        connecting_user = None

    if not connecting_user:
        await manager.send_personal_message(
            json.dumps(
                {
                    "type": "agent_error",
                    "data": {
                        "detail": "Unauthorized access. Missing or invalid JWT token.",
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            session_id,
        )
        manager.disconnect(session_id, websocket)
        return

    ## lookup the existing session
    session = session_service.get_session(session_id, connecting_user.userId)
    if not session:
        await manager.send_personal_message(
            json.dumps(
                {
                    "type": "agent_error",
                    "data": {
                        "detail": "Session not found",
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            session_id,
        )
        manager.disconnect(session_id, websocket)
        return

    logger.info(
        f"Connection established and session loaded for user: {connecting_user}"
    )

    await manager.send_personal_message(
        json.dumps(
            {
                "type": "connection_confirmed",
                "data": {
                    "message": "Connection established and session loaded",
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ),
        session_id,
    )

    ## Start the message handling loop
    try:
        while True:
            # Receive message from client
            message_data = None
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received: {e}")
                await manager.send_personal_message(
                    json.dumps(
                        {
                            "type": "agent_error",
                            "data": {"detail": "Invalid message format"},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    session_id,
                )
            except Exception as e:
                logger.error(f"Invalid message received: {e}")
                await manager.send_personal_message(
                    json.dumps(
                        {
                            "type": "agent_error",
                            "data": {
                                "detail": "Error receiving message",
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    session_id,
                )
                # exit the loop
                break

            if not message_data:
                continue

            # messages consist of a type and adata payload
            # type is a string
            # data is an optional object

            logger.info(f"Received message: {message_data}")

            message_type = message_data.get("type")

            if message_type == "ping":
                # Send response back to client
                await manager.send_personal_message(
                    json.dumps(
                        {
                            "type": "pong",
                            "data": {
                                "message": "pong",
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    session_id,
                )

            if message_type == "echo_error":
                # Send response back to client
                await manager.send_personal_message(
                    json.dumps(
                        {
                            "type": "agent_error",
                            "data": {
                                "detail": "This is a test error",
                            },
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    session_id,
                )

            if message_type == "message":
                data_payload = message_data.get("data", {})
                request = SendMessageRequestDTO(**data_payload)

                log_info(
                    "Message received",
                    session_id=session_id,
                    message_length=len(request.message),
                    style_guides_count=(
                        len(request.style_guides) if request.style_guides else 0
                    ),
                    capabilities_count=(
                        len(request.capabilities) if request.capabilities else 0
                    ),
                )

                logger.info(f"💬 Processing message for session: {session_id}")
                logger.info(
                    f"📋 Available sessions: {session_service.list_session_ids()}"
                )
                logger.info(f"📝 Message: {request.message}")

                if request.agent_jwt:
                    message_user = decode_and_validate_agent_jwt(request.agent_jwt)
                else:
                    message_user = None

                if not message_user:
                    logger.error(
                        f"Unauthorized access. Missing or invalid JWT token: {request.agent_jwt}"
                    )
                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "agent_error",
                                "data": {
                                    "detail": "Unauthorized access. Missing or invalid JWT token.",
                                },
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        session_id,
                    )
                    manager.disconnect(session_id, websocket)
                    return

                # TODO: check if the message user is the same as the connecting user

                if request.capabilities:
                    logger.info(
                        f"🔧 Capabilities provided: {len(request.capabilities)} capabilities"
                    )
                    for i, capability in enumerate(request.capabilities, 1):
                        logger.info(f"   Capability {i}: {capability}")
                else:
                    logger.info(f"ℹ️ No capabilities provided")

                if request.style_guides:
                    logger.info(
                        f"📋 Style guides provided: {len(request.style_guides)} style guides"
                    )
                else:
                    logger.info(f"ℹ️ No style guides provided")

                session = session_service.get_session(session_id)
                session.last_activity = datetime.now(timezone.utc)

                # Add user message to history
                user_message = ChatMessage(
                    message=request.message,
                    role="user",
                    timestamp=datetime.now(timezone.utc),
                )

                session.chat_history.append(user_message)
                logger.info(
                    f"📝 Added user message to chat history. New length: {len(session.chat_history)}"
                )

                try:
                    # Process with agent
                    logger.info(f"🤖 Processing with agent...")
                    log_info(
                        "Agent processing started",
                        session_id=session_id,
                        chat_history_length=len(session.chat_history),
                        summary_history_length=len(session.summary_history),
                        snapshot_id=session.snapshot_id,
                    )

                    # Convert style guides to dict format if provided
                    logger.info(f"🔍 Converting style guides...")
                    style_guides_dict = {}
                    if request.style_guides:
                        style_guides_dict = {
                            g.name: g.content for g in request.style_guides
                        }

                    async def progress_callback(
                        progress_type: str, message: str, payload: dict
                    ):
                        await manager.send_personal_message(
                            json.dumps(
                                {
                                    "type": "message_progress",
                                    "data": {
                                        "progress_type": progress_type,
                                        "message": message,
                                        "payload": payload,
                                    },
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                }
                            ),
                            session_id,
                        )

                    agent_response = await chat_service.process_message_with_agent(
                        session,
                        request.message,
                        message_user,
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

                    log_info(
                        "Agent response received",
                        session_id=session_id,
                        response_length=len(agent_response.response_message),
                        snapshot_id=session.snapshot_id,
                    )

                    # Add assistant response to chat history
                    assistant_message = ChatMessage(
                        message=agent_response.response_message,
                        role="assistant",
                        timestamp=datetime.now(timezone.utc),
                    )

                    session.chat_history.append(assistant_message)
                    logger.info(
                        f"📝 Added assistant message to chat history. New length: {len(session.chat_history)}"
                    )

                    summary_entry = RequestAndResponseSummary(
                        request_summary=agent_response.request_summary,
                        response_summary=agent_response.response_summary,
                        timestamp=datetime.now(timezone.utc),
                    )
                    session.summary_history.append(summary_entry)
                    logger.info(
                        f"📋 Added to summary history. New length: {len(session.summary_history)}"
                    )

                    # Update session
                    if (
                        session.name.startswith("New chat")
                        and summary_entry.request_summary
                    ):
                        new_name = (
                            request.message
                            if len(request.message) < 30
                            else request.message[:30] + "..."
                        )
                        session.name = new_name

                    session_service.update_session(session, connecting_user.userId)
                    logger.info(f"💾 Session updated in storage")
                    logger.info(
                        f"📊 Final session state - Chat History: {len(session.chat_history)}, Summary History: {len(session.summary_history)}"
                    )

                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "message_response",
                                "data": agent_response.model_dump(),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        session_id,
                    )
                except Exception as e:
                    log_error(
                        "Message processing failed",
                        session_id=session_id,
                        error=str(e),
                        snapshot_id=session.snapshot_id,
                    )
                    logger.info(f"❌ Error processing message: {e}")
                    logger.info(
                        f"🔍 Session state after error - Chat History: {len(session.chat_history)}, Summary History: {len(session.summary_history)}"
                    )
                    # Don't update the session if there was an error
                    mapped_error = exception_mapping(e)
                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "agent_error",
                                "data": {
                                    "detail": str(mapped_error.detail),
                                },
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        session_id,
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally for session {session_id}")
    except Exception as e:
        logger.exception(f"Unexpected error in WebSocket handler")
    finally:
        manager.disconnect(session_id, websocket)
