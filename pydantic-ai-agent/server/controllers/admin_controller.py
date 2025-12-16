#!/usr/bin/env python3
"""
FastAPI Endpoints for Health Check
"""

from datetime import datetime
from logging import getLogger

from fastapi import APIRouter, WebSocket

from server.services import (
    AgentRunStateManagerDep,
    AgentTaskManagerDep,
    WebSocketConnectionManagerDep,
)

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
        "service": "scratchpad-agent",
    }


@router.get("/debug/websocket/status")
async def websocket_status(
    connection_manager: WebSocketConnectionManagerDep,
):
    """Websocket status endpoint"""
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


@router.get("/debug/agent/run-state/status")
async def agent_run_state(
    agent_run_state_manager: AgentRunStateManagerDep,
):
    """Agent runs endpoint"""
    run_status = await agent_run_state_manager.get_run_status()
    return {
        "timestamp": datetime.now().isoformat(),
        "agent_runs": run_status,
    }


@router.get("/debug/agent/task-manager/status")
async def agent_task_manager(
    agent_task_manager: AgentTaskManagerDep,
):
    """Agent task manager status endpoint"""

    return {
        "timestamp": datetime.now().isoformat(),
        "active_task_count": agent_task_manager.get_active_task_count(),
        "task_history": agent_task_manager.get_task_history(),
    }
