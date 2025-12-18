#!/usr/bin/env python3
"""
FastAPI Endpoints for Health Check
"""

from datetime import datetime
from logging import getLogger

from fastapi import APIRouter, Request, WebSocket
from fastapi.responses import HTMLResponse
from server.services import AgentTaskManagerDep, WebSocketConnectionManagerDep

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


@router.get("/debug/dashboard", response_class=HTMLResponse)
async def debug_dashboard(
    request: Request,
    connection_manager: WebSocketConnectionManagerDep,
    agent_task_manager: AgentTaskManagerDep,
):
    """Admin dashboard with Jinja2 template"""
    from main import get_templates

    templates = get_templates()

    # Gather WebSocket status
    websocket_connections = []
    if connection_manager.active_connections:
        for key, conn in connection_manager.active_connections.items():
            websocket_connections.append(
                {
                    "session_id": key,
                    "created_at": conn.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "last_activity_at": conn.last_activity_at.strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                    "user": conn.user.userId if conn.user else "unknown",
                    "last_activity_type": conn.last_activity_type or "N/A",
                }
            )

    # Gather task manager status
    active_tasks = []
    for task in await agent_task_manager.get_active_tasks():
        active_tasks.append(
            {
                "task_id": task.task_id,
                "session_id": task.session_id,
                "status": task.status,
                "run_state": task.run_state,
                "stop_initiated": task.stop_initiated,
                "created_at": task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": task.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
        )

    # Get recent task history (last 20)
    task_history = await agent_task_manager.get_task_history()
    recent_history = []
    for item in task_history[-20:]:
        recent_history.append(
            {
                "task_id": item.task_id,
                "session_id": item.session_id,
                "status": item.status,
                "run_state": item.final_run_state,
                "created_at": item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "completed_at": item.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
        )

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "websocket_status": {
                "active_count": len(websocket_connections),
                "connections": websocket_connections,
            },
            "task_manager": {
                "active_count": len(active_tasks),
                "history_count": len(task_history),
                "active_tasks": active_tasks,
                "recent_history": recent_history,
            },
        },
    )
