#!/usr/bin/env python3
"""
FastAPI Endpoints for Health Check
"""

from typing import Any


from fastapi import APIRouter
from logging import getLogger
from datetime import datetime
from server.websocket_handler import get_connection_manager
from server.chat_controller import (
    chat_service,
    session_service,
    agent_run_state_manager,
)
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


@router.get("/debug/websocket/status")
async def websocket_status():
    """Websocket status endpoint"""
    connection_manager = get_connection_manager(chat_service, session_service)

    connection_info = []
    if connection_manager.active_connections:
        for key in connection_manager.active_connections.keys():

            stored_connection = connection_manager.active_connections[key]

            status = "n/a"
            client_info = "n/a"
            if (
                stored_connection
                and stored_connection.websocket
                and isinstance(stored_connection.websocket, WebSocket)
            ):
                status = f"{stored_connection.websocket.client_state}"
                client_info = f"{stored_connection.websocket.client}"

            connection_info.append(
                {
                    "session_id": key,
                    "status": status,
                    "client_info": client_info,
                    "last_activity_at": stored_connection.last_activity_at.isoformat(),
                    "last_activity_type": stored_connection.last_activity_type,
                }
            )
    else:
        connection_info = "No connections found"

    return {
        "timestamp": datetime.now().isoformat(),
        "connections": connection_info,
    }


@router.get("debug/agent/run-state")
async def agent_run_state():
    """Agent runs endpoint"""
    run_status = await agent_run_state_manager.get_run_status()
    return {
        "timestamp": datetime.now().isoformat(),
        "agent_runs": run_status,
    }
