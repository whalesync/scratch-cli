#!/usr/bin/env python3
"""
Main FastAPI Chat Server - Modular Version
"""
from dotenv import load_dotenv

load_dotenv()

import threading
import time as time_module
from contextlib import asynccontextmanager
from logging import getLogger
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from config import get_settings
from server.controllers.admin_controller import router as admin_router
from server.controllers.chat_controller import router as chat_router
from server.controllers.websocket_handler import websocket_endpoint
from server.services import (
    WebSocketConnectionManagerDep,
    get_session_service,
    initialize_services,
)

logger = getLogger(__name__)

# Initialize Jinja2 templates
templates = Jinja2Templates(directory="templates")


# Application lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI app.
    Handles initialization and cleanup of services.
    """
    # Startup: Initialize all services
    logger.info("Initializing services...")
    initialize_services()
    logger.info("Services initialized successfully")

    # Start cleanup thread
    def cleanup_loop():
        while True:
            time_module.sleep(3600)  # 1 hour
            get_session_service().cleanup_inactive_sessions()

    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    logger.info("Cleanup thread started")

    yield

    # Shutdown: Cleanup if needed
    logger.info("Shutting down services...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title=f"{get_settings().project_name} AI Agent", version="1.0.0", lifespan=lifespan
)

logger.info(f"App Environment: {get_settings().app_env}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(chat_router)
app.include_router(admin_router)


# Export templates for use in controllers
def get_templates():
    return templates


# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint_handler(
    connection_manager: WebSocketConnectionManagerDep,
    websocket: WebSocket,
    session_id: str,
    auth: Optional[str] = None,
):
    """WebSocket endpoint for real-time chat"""
    await websocket_endpoint(connection_manager, websocket, session_id, auth)


if __name__ == "__main__":
    # Start the server
    uvicorn.run(app, host="0.0.0.0", port=8000)
