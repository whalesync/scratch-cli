#!/usr/bin/env python3
"""
FastAPI Endpoints for Health Check
"""

from typing import Any


from fastapi import APIRouter
from logging import getLogger
from datetime import datetime
from server.websocket_handler import get_connection_manager
from server.chat_controller import chat_service, session_service
from fastapi import WebSocket

logger = getLogger(__name__)

# Create router
router = APIRouter(tags=["admin"])


@router.get("/")
async def root():
    return {"server": "Scratch AI Agent", "version": "1.0.0"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat(),
        "service": "scratchpad-ai-agent",
    }


@router.get("/websocket/status")
async def websocket_status():
    """Websocket status endpoint"""
    connection_manager = get_connection_manager(chat_service, session_service)

    connection_info = []
    if connection_manager.active_connections:
        for key in connection_manager.active_connections.keys():

            socket = connection_manager.active_connections[key]

            status = "n/a"
            client_info = "n/a"
            if socket and isinstance(socket, WebSocket):
                status = f"{socket.client_state}"
                client_info = f"{socket.client}"

            connection_info.append(
                {
                    "session_id": key,
                    "status": status,
                    "client_info": client_info,
                }
            )
    else:
        connection_info = "No connections found"

    return {
        "status": "enabled",
        "timestamp": datetime.now().isoformat(),
        "connections": connection_info,
    }
