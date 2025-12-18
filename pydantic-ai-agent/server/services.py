#!/usr/bin/env python3
"""
FastAPI Dependency Injection for Services

This module provides dependency injection setup for services used throughout the application.
Services are managed as singletons and injected via FastAPI's dependency injection system.
"""

from typing import Annotated

from fastapi import Depends
from server.agent_task_manager import AgentTaskManager
from server.chat_service import ChatService
from server.session_service import SessionService
from server.websocket_connection_manager import ConnectionManager

# Global service instances (singletons)
_session_service: SessionService | None = None
_chat_service: ChatService | None = None
_websocket_connection_manager: ConnectionManager | None = None
_agent_task_manager: AgentTaskManager | None = None


def initialize_services() -> None:
    """
    Initialize all services. Should be called during application startup.
    """
    global _session_service, _chat_service, _agent_task_manager, _websocket_connection_manager

    _session_service = SessionService()
    _chat_service = ChatService(_session_service)
    _agent_task_manager = AgentTaskManager(_chat_service, _session_service)
    _websocket_connection_manager = ConnectionManager(
        _chat_service, _session_service, _agent_task_manager
    )


def get_session_service() -> SessionService:
    """
    Dependency injection for SessionService.

    Usage:
        @router.get("/example")
        async def example(session_service: Annotated[SessionService, Depends(get_session_service)]):
            ...
    """
    if _session_service is None:
        raise RuntimeError(
            "Services not initialized. Call initialize_services() first."
        )
    return _session_service


def get_chat_service() -> ChatService:
    """
    Dependency injection for ChatService.

    Usage:
        @router.get("/example")
        async def example(chat_service: Annotated[ChatService, Depends(get_chat_service)]):
            ...
    """
    if _chat_service is None:
        raise RuntimeError(
            "Services not initialized. Call initialize_services() first."
        )
    return _chat_service


def get_websocket_connection_manager() -> ConnectionManager:
    """
    Dependency injection for WebSocketConnectionManager.
    """
    if _websocket_connection_manager is None:
        raise RuntimeError(
            "Services not initialized. Call initialize_services() first."
        )
    return _websocket_connection_manager


def get_agent_task_manager() -> AgentTaskManager:
    """
    Dependency injection for AgentTaskManager.
    """
    if _agent_task_manager is None:
        raise RuntimeError(
            "Services not initialized. Call initialize_services() first."
        )
    return _agent_task_manager


# Type aliases for cleaner endpoint signatures
SessionServiceDep = Annotated[SessionService, Depends(get_session_service)]

ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]
WebSocketConnectionManagerDep = Annotated[
    ConnectionManager, Depends(get_websocket_connection_manager)
]
AgentTaskManagerDep = Annotated[AgentTaskManager, Depends(get_agent_task_manager)]
