#!/usr/bin/env python3
"""
WebSocket Handler for file agent real-time chat
"""

import json
from datetime import datetime, timezone
from logging import getLogger
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from logger import log_error, log_info
from server.auth import decode_and_validate_agent_jwt
from server.DTOs import FileAgentSendMessageRequestDTO, StopAgentMessageRequestDTO
from server.exception_mapping import exception_mapping
from server.file_agent_task_manager import FileAgentTaskManager
from server.websocket_connection_manager import ConnectionManager

logger = getLogger(__name__)


async def file_websocket_endpoint(
    connection_manager: ConnectionManager,
    file_agent_task_manager: FileAgentTaskManager,
    websocket: WebSocket,
    session_id: str,
    auth: Optional[str] = None,
):
    """WebSocket endpoint for file agent real-time chat"""
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

    # Lookup the existing session
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
        f"File agent connection established and session loaded for user: {connecting_user}"
    )
    connection_manager.set_user(session_id, connecting_user)

    await connection_manager.send_message(
        json.dumps(
            {
                "type": "connection_confirmed",
                "data": {
                    "message": "File agent connection established and session loaded",
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ),
        session_id,
    )

    # Start the message handling loop
    try:
        while True:
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
                break

            if not message_data:
                continue

            logger.info(f"File agent received message: {message_data}")

            message_type = message_data.get("type")
            connection_manager.track_activity(
                session_id,
                f"process_message",
                {"message_type": message_type, "message_data": message_data},
            )

            if message_type == "ping":
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

            if message_type == "stop":
                data_payload = message_data.get("data", {})
                request = StopAgentMessageRequestDTO(**data_payload)
                if request.hard_kill:
                    logger.info(
                        f"Processing request to hard stop file agent task {request.task_id}"
                    )
                    await file_agent_task_manager.hard_cancel_task(request.task_id)
                else:
                    logger.info(
                        f"Processing request to stop file agent task {request.task_id}"
                    )
                    await file_agent_task_manager.initiate_stop(request.task_id)

            if message_type == "message":
                data_payload = message_data.get("data", {})
                request = FileAgentSendMessageRequestDTO(**data_payload)

                log_info(
                    "File agent message received",
                    session_id=session_id,
                    message_length=len(request.message),
                )

                logger.info(
                    f"Processing file agent message for session {session_id}: {request.message}"
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

                # Validate model access
                if request.model and not message_user.is_model_allowed(request.model):
                    logger.warning(
                        f"Model access denied. User {message_user.userId} attempted to use model '{request.model}'"
                    )
                    await connection_manager.send_message(
                        json.dumps(
                            {
                                "type": "agent_error",
                                "data": {
                                    "detail": f"Model '{request.model}' is not available on your current plan.",
                                },
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        session_id,
                    )
                    continue

                session = connection_manager.session_service.get_session(session_id)
                session.last_activity = datetime.now(timezone.utc)

                log_info(
                    "File agent processing started",
                    session_id=session_id,
                    chat_history_length=len(session.chat_history),
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
                    """Called when file agent message processing completes successfully"""
                    log_info(
                        "File agent response received",
                        session_id=session_id,
                        workbook_id=session.workbook_id,
                    )
                    await connection_manager.send_message(
                        json.dumps(response_data),
                        session_id,
                    )

                async def error_callback(error: Exception):
                    """Called when file agent message processing fails"""
                    log_error(
                        "File agent message processing failed",
                        session_id=session_id,
                        error=str(error),
                        workbook_id=session.workbook_id,
                    )
                    logger.info(f"Error processing file agent message: {error}")

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

                # Start the async task
                task_id = await file_agent_task_manager.start_message_task(
                    session=session,
                    request=request,
                    user=message_user,
                    progress_callback=progress_callback,
                    completion_callback=completion_callback,
                    error_callback=error_callback,
                )

                logger.info(
                    f"Started async file agent task {task_id} for session {session_id}"
                )

                # Send task started acknowledgment
                progress_callback(
                    "task_started",
                    "File agent message processing started",
                    {"task_id": task_id},
                )

    except WebSocketDisconnect:
        logger.info(
            f"File agent WebSocket disconnected normally for session {session_id}"
        )
    except Exception as e:
        logger.exception("Unexpected error in file agent WebSocket handler")
    finally:
        connection_manager.disconnect(session_id, websocket)
