#!/usr/bin/env python3
"""
Main FastAPI Chat Server - Modular Version
"""
from dotenv import load_dotenv

load_dotenv()

import os
import sys
import threading
import time as time_module
from typing import Optional, Any

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from server.chat_controller import router as chat_router, chat_service, session_service
from server.admin_controller import router as admin_router
from server.websocket_handler import websocket_endpoint

from config import get_settings
from logging import getLogger

logger = getLogger(__name__)

# Initialize FastAPI app

app = FastAPI(title=f"{get_settings().project_name} AI Agent", version="1.0.0")

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


# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint_handler(
    websocket: WebSocket, session_id: str, auth: Optional[str] = None
):
    """WebSocket endpoint for real-time chat"""
    await websocket_endpoint(websocket, session_id, chat_service, session_service, auth)


if __name__ == "__main__":
    # Run cleanup every hour
    def cleanup_loop():
        while True:
            time_module.sleep(3600)  # 1 hour
            session_service.cleanup_inactive_sessions()

    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

    # Start the server
    uvicorn.run(app, host="0.0.0.0", port=8000)
