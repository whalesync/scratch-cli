#!/usr/bin/env python3
"""
WebSocket Handler for real-time chat
"""

import asyncio
import json
from datetime import datetime
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

logger = getLogger(__name__)


class ConnectionManager:
    def __init__(self, chat_service: ChatService, session_service: SessionService):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_service = chat_service
        self.session_service = session_service

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(message)


async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    chat_service: ChatService,
    session_service: SessionService,
    api_token: Optional[str] = None,
):
    """WebSocket endpoint for real-time chat"""
    manager = ConnectionManager(chat_service, session_service)
    await manager.connect(websocket, session_id)

    ## lookup the existing session
    session = session_service.get_session(session_id)
    if not session:
        await manager.send_personal_message(
            json.dumps(
                {
                    "type": "agent_error",
                    "data": {
                        "detail": "Session not found",
                    },
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            session_id,
        )
        manager.disconnect(session_id)
        return

    await manager.send_personal_message(
        json.dumps(
            {
                "type": "connection_confirmed",
                "data": {
                    "message": "Connection established and session loaded",
                },
                "timestamp": datetime.now().isoformat(),
            }
        ),
        session_id,
    )

    ## Start the message handling loop
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

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
                            "timestamp": datetime.now().isoformat(),
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
                            "timestamp": datetime.now().isoformat(),
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
                    has_api_token=request.api_token is not None,
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
                if request.api_token:
                    logger.info(
                        f"🔑 API token provided: {request.api_token[:8]}..."
                        if len(request.api_token) > 8
                        else request.api_token
                    )
                else:
                    logger.info(f"ℹ️ No API token provided")

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
                    for i, style_guide in enumerate(request.style_guides, 1):
                        content = style_guide.content
                        if isinstance(content, str):
                            truncated_content = (
                                content[:50] + "..." if len(content) > 50 else content
                            )
                        else:
                            truncated_content = (
                                str(content)[:50] + "..."
                                if len(str(content)) > 50
                                else str(content)
                            )
                        logger.info(
                            f"   Style guide {i}: {style_guide.name} - {truncated_content}"
                        )
                else:
                    logger.info(f"ℹ️ No style guides provided")

                session = session_service.get_session(session_id)
                session.last_activity = datetime.now()

                # Add user message to history
                user_message = ChatMessage(
                    message=request.message, role="user", timestamp=datetime.now()
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
                    logger.info(f"🔍 Converting style guides:")
                    logger.info(f"   request.style_guides: {request.style_guides}")
                    logger.info(
                        f"   request.style_guides type: {type(request.style_guides)}"
                    )

                    style_guides_dict = {}
                    if request.style_guides:
                        style_guides_dict = {
                            g.name: g.content for g in request.style_guides
                        }
                        logger.info(f"   Converted to: {style_guides_dict}")
                    else:
                        logger.info(f"   No style guides provided, using empty dict")

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
                                    "timestamp": datetime.now().isoformat(),
                                }
                            ),
                            session_id,
                        )

                    agent_response = await chat_service.process_message_with_agent(
                        session,
                        request.message,
                        request.api_token,
                        style_guides_dict,
                        request.model,
                        request.view_id,
                        request.read_focus,
                        request.write_focus,
                        request.capabilities,
                        request.active_table_id,
                        request.data_scope,
                        request.record_id,
                        request.column_id,
                        300.0,
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
                        timestamp=datetime.now(),
                    )

                    session.chat_history.append(assistant_message)
                    logger.info(
                        f"📝 Added assistant message to chat history. New length: {len(session.chat_history)}"
                    )

                    summary_entry = RequestAndResponseSummary(
                        request_summary=agent_response.request_summary,
                        response_summary=agent_response.response_summary,
                    )
                    session.summary_history.append(summary_entry)
                    logger.info(
                        f"📋 Added to summary history. New length: {len(session.summary_history)}"
                    )

                    # Update session
                    session_service.update_session(session)
                    logger.info(f"💾 Session updated in storage")
                    logger.info(
                        f"📊 Final session state - Chat History: {len(session.chat_history)}, Summary History: {len(session.summary_history)}"
                    )

                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "message_response",
                                "data": agent_response.model_dump(),
                                "timestamp": datetime.now().isoformat(),
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
                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "agent_error",
                                "data": {
                                    "detail": str(e),
                                },
                                "timestamp": datetime.now().isoformat(),
                            }
                        ),
                        session_id,
                    )

    except WebSocketDisconnect:
        manager.disconnect(session_id)
