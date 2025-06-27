#!/usr/bin/env python3
"""
Main FastAPI Chat Server - Modular Version
"""

import os
import sys
import threading
import time as time_module
from typing import Optional, Any
from dotenv import load_dotenv

# Add the current directory to the path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from endpoints import router, chat_service
from websocket_handler import websocket_endpoint
from logger import log_info

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="PydanticAI Chat Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router
app.include_router(router)

# WebSocket endpoint
@app.websocket("/ws/{session_id}")
async def websocket_endpoint_handler(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat"""
    await websocket_endpoint(websocket, session_id, chat_service)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the agent on startup"""
    if not chat_service.agent:
        raise RuntimeError("Failed to initialize agent")
    
    log_info("Chat server started", server_version="1.0.0", agent_initialized=True)

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