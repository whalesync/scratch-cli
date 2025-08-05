#!/usr/bin/env python3
"""
FastAPI Endpoints for Connector Builder Server
"""

import time
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import Dict

from .DTOs import (
    ConnectorBuilderRequestDTO,
    ConnectorBuilderResponseDTO,
    ConnectorBuilderSessionMessageRequestDTO,
    ConnectorBuilderSessionDTO,
    ConnectorBuilderSessionSummaryDTO,
    ConnectorBuilderCapabilityDTO,
    CreateConnectorBuilderSessionResponseDTO,
)
from .connector_builder_service import ConnectorBuilderService
from logger import log_info, log_warning, log_error

# Create router
router = APIRouter(tags=["connector-builder"])

# Initialize connector builder service
connector_builder_service = ConnectorBuilderService()

# Static list of available capabilities for connector builder
AVAILABLE_CAPABILITIES = [
    ConnectorBuilderCapabilityDTO(
        code="test",
        enabledByDefault=False,
        description="Test capability for connector builder (does nothing when selected).",
    ),
]


@router.post("/sessions", response_model=CreateConnectorBuilderSessionResponseDTO)
async def create_session(custom_connector_id: str):
    """Create a new connector builder session"""
    session_id = f"connector_session_{int(time.time())}_{uuid.uuid4().hex[:8]}"

    session = connector_builder_service.create_session(session_id, custom_connector_id)

    # Create summary for client response
    session_summary = ConnectorBuilderSessionSummaryDTO(
        id=session.id,
        name=session.name,
        created_at=session.created_at,
        last_activity=session.last_activity,
    )

    log_info(
        "Connector builder session created",
        session_id=session_id,
        total_sessions=len(connector_builder_service.sessions),
        custom_connector_id=custom_connector_id,
    )
    return CreateConnectorBuilderSessionResponseDTO(
        session=session_summary, available_capabilities=AVAILABLE_CAPABILITIES
    )


@router.get("/sessions/{session_id}", response_model=ConnectorBuilderSessionDTO)
async def get_session(session_id: str):
    """Get connector builder session information"""
    log_info("Connector builder session accessed", session_id=session_id)
    print(f"🔍 Looking for connector builder session: {session_id}")
    print(f"📋 Available sessions: {list(connector_builder_service.sessions.keys())}")

    if session_id not in connector_builder_service.sessions:
        log_warning(
            "Connector builder session not found",
            session_id=session_id,
            available_sessions=list(connector_builder_service.sessions.keys()),
        )
        raise HTTPException(status_code=404, detail="Session not found")

    session = connector_builder_service.sessions[session_id]
    session.last_activity = datetime.now().isoformat()

    return ConnectorBuilderSessionDTO(
        id=session.id,
        name=session.name,
        custom_connector_id=session.custom_connector_id,
        chat_history=session.chat_history,
        created_at=session.created_at,
        last_activity=session.last_activity,
    )


@router.post(
    "/sessions/{session_id}/messages", response_model=ConnectorBuilderResponseDTO
)
async def send_message(
    session_id: str, request: ConnectorBuilderSessionMessageRequestDTO
):
    """Send a message to the connector builder agent"""
    log_info(
        "Connector builder message received",
        session_id=session_id,
        message_length=len(request.message),
        has_api_token=request.api_token is not None,
        style_guides_count=len(request.style_guides) if request.style_guides else 0,
        capabilities_count=len(request.capabilities) if request.capabilities else 0,
    )
    print(f"💬 Processing connector builder message for session: {session_id}")
    print(f"📋 Available sessions: {list(connector_builder_service.sessions.keys())}")

    if session_id not in connector_builder_service.sessions:
        log_warning(
            "Connector builder session not found for message",
            session_id=session_id,
            available_sessions=list(connector_builder_service.sessions.keys()),
        )
        raise HTTPException(status_code=404, detail="Session not found")

    session = connector_builder_service.sessions[session_id]
    session.last_activity = datetime.now().isoformat()

    try:
        # Add user message to session
        user_message = {
            "role": "user",
            "message": request.message,
            "timestamp": datetime.now().isoformat(),
        }
        session.chat_history.append(user_message)

        # Process with agent
        print(f"🤖 Processing with connector builder agent...")
        log_info(
            "Connector builder agent processing started",
            session_id=session_id,
            custom_connector_id=session.custom_connector_id,
        )

        agent_response = (
            await connector_builder_service.process_connector_builder_request(
                message=request.message,
                custom_connector_id=session.custom_connector_id,
                api_token=request.api_token,
                style_guides=request.style_guides,
                model=request.model,
                capabilities=request.capabilities,
            )
        )

        # Add assistant response to session
        assistant_message = {
            "role": "assistant",
            "message": agent_response.response_message,
            "timestamp": datetime.now().isoformat(),
        }
        session.chat_history.append(assistant_message)

        log_info(
            "Connector builder agent response received",
            session_id=session_id,
            custom_connector_id=session.custom_connector_id,
            response_length=len(agent_response.response_message),
        )

        return agent_response

    except Exception as e:
        log_error(
            "Connector builder message processing failed",
            session_id=session_id,
            custom_connector_id=session.custom_connector_id,
            error=str(e),
        )
        print(f"❌ Error processing connector builder message: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error processing message: {str(e)}"
        )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a connector builder session"""
    log_info("Connector builder session deletion requested", session_id=session_id)

    if session_id not in connector_builder_service.sessions:
        log_warning(
            "Connector builder session not found for deletion", session_id=session_id
        )
        raise HTTPException(status_code=404, detail="Session not found")

    connector_builder_service.delete_session(session_id)
    log_info(
        "Connector builder session deleted",
        session_id=session_id,
        remaining_sessions=len(connector_builder_service.sessions),
    )
    return {"message": "Session deleted"}


@router.get("/sessions")
async def list_sessions():
    """List all connector builder sessions"""
    log_info("Connector builder sessions list requested")

    sessions = []
    for session_id, session in connector_builder_service.sessions.items():
        session_summary = ConnectorBuilderSessionSummaryDTO(
            id=session.id,
            name=session.name,
            created_at=session.created_at,
            last_activity=session.last_activity,
        )
        sessions.append(session_summary)

    log_info("Connector builder sessions list returned", session_count=len(sessions))
    return {"sessions": sessions}


@router.post("/process", response_model=ConnectorBuilderResponseDTO)
async def process_connector_builder_request(request: ConnectorBuilderRequestDTO):
    """Process a connector builder request with the agent (legacy endpoint)"""
    log_info(
        "Legacy connector builder request received",
        custom_connector_id=request.custom_connector_id,
        message_length=len(request.message),
        has_api_token=request.api_token is not None,
    )

    print(
        f"🔧 Processing legacy connector builder request for connector: {request.custom_connector_id}"
    )
    print(f"📝 Message: {request.message}")

    try:
        # Process with agent
        print(f"🤖 Processing with connector builder agent...")
        log_info(
            "Connector builder agent processing started",
            custom_connector_id=request.custom_connector_id,
        )

        agent_response = (
            await connector_builder_service.process_connector_builder_request(
                message=request.message,
                custom_connector_id=request.custom_connector_id,
                api_token=request.api_token,
                style_guides=request.style_guides,
                model=request.model,
                capabilities=request.capabilities,
            )
        )

        log_info(
            "Connector builder agent response received",
            custom_connector_id=request.custom_connector_id,
            response_length=len(agent_response.response_message),
        )

        return agent_response

    except Exception as e:
        log_error(
            "Connector builder request processing failed",
            custom_connector_id=request.custom_connector_id,
            error=str(e),
        )
        print(f"❌ Error processing connector builder request: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "connector-builder"}
