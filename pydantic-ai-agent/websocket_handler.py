#!/usr/bin/env python3
"""
WebSocket Handler for real-time chat
"""

import json
from datetime import datetime
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect

from agents.data_agent.models import ChatSession
from server.chat_service import ChatService

class ConnectionManager:
    def __init__(self, chat_service: ChatService):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_service = chat_service

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(message)

async def websocket_endpoint(websocket: WebSocket, session_id: str, chat_service: ChatService):
    """WebSocket endpoint for real-time chat"""
    manager = ConnectionManager(chat_service)
    await manager.connect(websocket, session_id)
    
    # Create session if it doesn't exist
    if session_id not in chat_service.sessions:
        now = datetime.now()
        chat_service.sessions[session_id] = ChatSession(
            id=session_id,
            name=f"WebSocket Session {now.strftime('%Y-%m-%d %H:%M')}",
            last_activity=now,
            snapshot_id='', # TODO: add snapshot_id
            created_at=now
        )
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message":
                user_message = message_data.get("message", "")
                
                # Process with agent
                response = await chat_service.process_message_with_agent(
                    chat_service.sessions[session_id], 
                    user_message,
                    api_token='' # TODO: add api_token
                )
                
                # Send response back to client
                await manager.send_personal_message(
                    json.dumps({
                        "type": "response",
                        "message": response.response_message,
                        "timestamp": datetime.now().isoformat()
                    }),
                    session_id
                )
                
    except WebSocketDisconnect:
        manager.disconnect(session_id) 