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
from connector_builder.connector_builder_controller import (
    router as connector_builder_router,
)
from logger import log_info

# Load environment variables


# Initialize FastAPI app
app = FastAPI(title="Scratchpad AI Agent", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(connector_builder_router, prefix="/connector-builder")


# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint_handler(
    websocket: WebSocket, session_id: str, api_token: Optional[str] = None
):
    """WebSocket endpoint for real-time chat"""
    await websocket_endpoint(
        websocket, session_id, chat_service, session_service, api_token
    )


if __name__ == "__main__":
    # Run cleanup every hour
    def cleanup_loop():
        while True:
            time_module.sleep(3600)  # 1 hour
            chat_service.cleanup_inactive_sessions()

    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

    # Start the server
    uvicorn.run(app, host="0.0.0.0", port=8000)
