#!/usr/bin/env python3
"""
WebSocket Handler for real-time chat
"""

import json
from datetime import datetime, timezone
from logging import getLogger
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from logger import log_error, log_info

from server.auth import decode_and_validate_agent_jwt
from server.DTOs import SendMessageRequestDTO
from server.exception_mapping import exception_mapping
from server.websocket_connection_manager import ConnectionManager

logger = getLogger(__name__)


async def websocket_endpoint(
    connection_manager: ConnectionManager,
    websocket: WebSocket,
    session_id: str,
    auth: Optional[str] = None,
):
    """WebSocket endpoint for real-time chat"""
    await connection_manager.connect(websocket, session_id)

    if auth:
        connecting_user = decode_and_validate_agent_jwt(auth)
    else:
        connecting_user = None

    if not connecting_user:
        await connection_manager.send_message(
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
        connection_manager.disconnect(session_id, websocket)
        return

    ## lookup the existing session
    session = connection_manager.session_service.get_session(
        session_id, connecting_user.userId
    )
    if not session:
        await connection_manager.send_message(
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
        connection_manager.disconnect(session_id, websocket)
        return

    logger.info(
        f"Connection established and session loaded for user: {connecting_user}"
    )

    await connection_manager.send_message(
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
                await connection_manager.send_message(
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
                await connection_manager.send_message(
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
            connection_manager.track_activity(
                session_id, f"process_message - {message_type}"
            )

            if message_type == "ping":
                # Send response back to client
                await connection_manager.send_message(
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
                await connection_manager.send_message(
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

                logger.info(
                    f"💬 Processing message for session {session_id}:  {request.message}"
                )

                if request.agent_jwt:
                    message_user = decode_and_validate_agent_jwt(request.agent_jwt)
                else:
                    message_user = None

                if not message_user:
                    logger.error(
                        f"Unauthorized access. Missing or invalid JWT token: {request.agent_jwt}"
                    )
                    await connection_manager.send_message(
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
                    connection_manager.disconnect(session_id, websocket)
                    return

                # Validate that the requested model is allowed for this user's subscription
                if request.model and not message_user.is_model_allowed(request.model):
                    logger.warning(
                        f"Model access denied. User {message_user.userId} attempted to use model '{request.model}' but only has access to: {message_user.availableModels}"
                    )
                    await connection_manager.send_message(
                        json.dumps(
                            {
                                "type": "agent_error",
                                "data": {
                                    "detail": f"Model '{request.model}' is not available on your current plan. Please upgrade your subscription or select a different model.",
                                },
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        session_id,
                    )
                    continue  # Don't disconnect, just reject this message

                session = connection_manager.session_service.get_session(session_id)
                session.last_activity = datetime.now(timezone.utc)

                log_info(
                    "Agent processing started",
                    session_id=session_id,
                    chat_history_length=len(session.chat_history),
                    summary_history_length=len(session.summary_history),
                    workbook_id=session.workbook_id,
                )

                # Define callbacks for the async task
                async def progress_callback(
                    progress_type: str, message: str, payload: dict
                ):
                    await connection_manager.send_message(
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

                async def completion_callback(response_data: dict):
                    """Called when message processing completes successfully"""
                    log_info(
                        "Agent response received",
                        session_id=session_id,
                        workbook_id=session.workbook_id,
                    )
                    await connection_manager.send_message(
                        json.dumps(response_data),
                        session_id,
                    )

                async def error_callback(error: Exception):
                    """Called when message processing fails"""
                    log_error(
                        "Message processing failed",
                        session_id=session_id,
                        error=str(error),
                        workbook_id=session.workbook_id,
                    )
                    logger.info(f"❌ Error processing message: {error}")

                    # Don't update the session if there was an error
                    mapped_error = exception_mapping(error)
                    await connection_manager.send_message(
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

                # Start the async task - this returns immediately
                task_id = connection_manager.agent_task_manager.start_message_task(
                    session=session,
                    request=request,
                    user=message_user,
                    progress_callback=progress_callback,
                    completion_callback=completion_callback,
                    error_callback=error_callback,
                )

                logger.info(f"✅ Started async task {task_id} for session {session_id}")

                # Send task started acknowledgment
                progress_callback(
                    "task_started", "Message processing started", {"task_id": task_id}
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally for session {session_id}")
    except Exception as e:
        logger.exception(f"Unexpected error in WebSocket handler")
    finally:
        connection_manager.disconnect(session_id, websocket)
