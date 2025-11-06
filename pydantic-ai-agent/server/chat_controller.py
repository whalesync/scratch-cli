#!/usr/bin/env python3
"""
FastAPI Endpoints for Chat Server
"""

import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic_ai.exceptions import UserError

from session import ChatMessage, ChatSession, RequestAndResponseSummary
from server.DTOs import (
    SendMessageRequestDTO,
    SendMessageResponseDTO,
    ChatSessionSummary,
    CreateSessionResponseDTO,
    Capability,
)
from server.chat_service import ChatService
from server.session_service import SessionService
from server.auth import AgentUser, get_current_user
from logger import log_info, log_error
from server.exception_mapping import exception_mapping
from logging import getLogger

myLogger = getLogger(__name__)


# Create router
router = APIRouter(tags=["chat"])

# Initialize services
session_service = SessionService()
chat_service = ChatService(session_service)

# Static list of available capabilities
AVAILABLE_CAPABILITIES = [
    Capability(
        code="data:create",
        enabledByDefault=True,
        description="Create new records for a table in the active snapshot using data provided by the LLM.",
    ),
    Capability(
        code="data:update",
        enabledByDefault=True,
        description="Update existing records in a table in the active snapshot (creates suggestions, not direct changes).",
    ),
    Capability(
        code="data:delete",
        enabledByDefault=True,
        description="Delete records from a table in the active snapshot by their IDs.",
    ),
    Capability(
        code="data:field-tools",
        enabledByDefault=True,
        description="Tools to edit specific fields",
    ),
    Capability(
        code="views:filtering",
        enabledByDefault=True,
        description="Set or clear SQL-based filters on tables to show/hide specific records.",
    ),
    Capability(
        code="data:add-column",
        enabledByDefault=True,
        description="Add a new column to the active table.",
    ),
    Capability(
        code="data:remove-column",
        enabledByDefault=True,
        description="Remove a column from the active table.",
    ),
]


@router.post("/sessions", response_model=CreateSessionResponseDTO)
async def create_session(
    snapshot_id: str, current_user: AgentUser = Depends(get_current_user)
):
    """Create a new chat session"""
    session_id = f"session_{int(time.time())}_{uuid.uuid4().hex[:8]}"

    session = session_service.create_session(
        current_user.userId, session_id, snapshot_id
    )

    # Create summary for client response
    session_summary = ChatSessionSummary(
        id=session.id,
        name=session.name,
        last_activity=session.last_activity,
        created_at=session.created_at,
    )

    myLogger.info(
        f"Session created successfully for snapshot {snapshot_id} by user {current_user.userId}",
    )

    return CreateSessionResponseDTO(
        session=session_summary, available_capabilities=AVAILABLE_CAPABILITIES
    )


@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_session(
    session_id: str, current_user: AgentUser = Depends(get_current_user)
):
    """Get session information"""
    myLogger.info(
        "Session loaded",
        extra={"session_id": session_id, "user_id": current_user.userId},
    )

    session = session_service.get_session(session_id, current_user.userId)

    if not session:
        myLogger.warning(
            "Session not found",
            extra={
                "session_id": session_id,
                "user_id": current_user.userId,
                "available_sessions": session_service.list_session_ids(),
            },
        )
        raise HTTPException(status_code=404, detail="Session not found")

    session.last_activity = datetime.now(timezone.utc)
    return session


# WARNING: This endpoint has become wildly out of date as all effort was put into the websocket endpoint
# it will need a major overhaul to be useful again
@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponseDTO)
async def send_message(
    session_id: str,
    request: SendMessageRequestDTO,
    current_user: AgentUser = Depends(get_current_user),
):
    """Send a message to the agent"""
    log_info(
        "Message received",
        session_id=session_id,
        user_id=current_user.userId,
        message_length=len(request.message),
        style_guides_count=len(request.style_guides) if request.style_guides else 0,
        capabilities_count=len(request.capabilities) if request.capabilities else 0,
    )

    if request.capabilities:
        myLogger.info(
            f"🔧 Capabilities provided: {len(request.capabilities)} capabilities"
        )
        for i, capability in enumerate(request.capabilities, 1):
            myLogger.info(f"   Capability {i}: {capability}")
    else:
        myLogger.info(f"ℹ️ No capabilities provided")

    if request.style_guides:
        myLogger.info(
            f"📋 Style guides provided: {len(request.style_guides)} style guides"
        )
        for i, style_guide in enumerate(request.style_guides, 1):
            content = style_guide.content
            if isinstance(content, str):
                truncated_content = (
                    content[:50] + "..." if len(content) > 50 else content
                )
            else:
                truncated_content = (
                    str(content)[:50] + "..."
                    if len(str(content)) > 50
                    else str(content)
                )
            myLogger.info(
                f"   Style guide {i}: {style_guide.name} - {truncated_content}"
            )
    else:
        myLogger.info(f"ℹ️ No style guides provided")

    if request.active_table_id:
        myLogger.info(f"📊 Active table: {request.active_table_id}")

    if not session_service.exists(session_id):
        log_error(
            "Message failed - session not found",
            session_id=session_id,
            user_id=current_user.userId,
            available_sessions=session_service.list_session_ids(),
        )
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_service.get_session(session_id)
    myLogger.info(f"✅ Found session: {session_id}")
    if session.snapshot_id:
        myLogger.info(f"📊 Session associated with snapshot: {session.snapshot_id}")
    myLogger.info(f"📊 Session chat history length: {len(session.chat_history)}")
    myLogger.info(f"📋 Session summary history length: {len(session.summary_history)}")

    session.last_activity = datetime.now(timezone.utc)

    # Add user message to history
    user_message = ChatMessage(
        message=request.message, role="user", timestamp=datetime.now(timezone.utc)
    )

    session.chat_history.append(user_message)
    myLogger.info(
        f"📝 Added user message to chat history. New length: {len(session.chat_history)}"
    )

    try:
        # Process with agent
        myLogger.info(f"🤖 Processing with agent...")
        log_info(
            "Agent processing started",
            session_id=session_id,
            user_id=current_user.userId,
            chat_history_length=len(session.chat_history),
            summary_history_length=len(session.summary_history),
            snapshot_id=session.snapshot_id,
        )

        # Convert style guides to dict format if provided
        myLogger.info(f"🔍 Converting style guides:")
        myLogger.info(f"   request.style_guides: {request.style_guides}")
        myLogger.info(f"   request.style_guides type: {type(request.style_guides)}")

        style_guides_dict = {}
        if request.style_guides:
            style_guides_dict = {g.name: g.content for g in request.style_guides}
            myLogger.info(f"   Converted to: {style_guides_dict}")
        else:
            myLogger.info(f"   No style guides provided, using empty dict")

        agent_response = await chat_service.process_message_with_agent(
            session,
            request.message,
            current_user,
            style_guides_dict,
            request.model,
            request.view_id,
            request.capabilities,
            request.active_table_id,
            request.data_scope,
            request.record_id,
            request.column_id,
            60.0,
        )

        log_info(
            "Agent response received",
            session_id=session_id,
            user_id=current_user.userId,
            response_length=len(agent_response.response_message),
            snapshot_id=session.snapshot_id,
        )

        # Add assistant response to chat history
        assistant_message = ChatMessage(
            message=agent_response.response_message,
            role="assistant",
            timestamp=datetime.now(timezone.utc),
        )

        session.chat_history.append(assistant_message)
        myLogger.info(
            f"📝 Added assistant message to chat history. New length: {len(session.chat_history)}"
        )

        summary_entry = RequestAndResponseSummary(
            request_summary=agent_response.request_summary,
            response_summary=agent_response.response_summary,
            timestamp=datetime.now(timezone.utc),
        )
        session.summary_history.append(summary_entry)
        myLogger.info(
            f"📋 Added to summary history. New length: {len(session.summary_history)}"
        )

        # Update session
        session_service.update_session(session, current_user.userId)
        myLogger.info(f"💾 Session updated in storage")
        myLogger.info(
            f"📊 Final session state - Chat History: {len(session.chat_history)}, Summary History: {len(session.summary_history)}"
        )

        return agent_response

    except Exception as e:
        log_error(
            "Message processing failed",
            session_id=session_id,
            user_id=current_user.userId,
            error=str(e),
            snapshot_id=session.snapshot_id,
        )
        myLogger.info(f"❌ Error processing message: {e}")
        myLogger.info(
            f"🔍 Session state after error - Chat History: {len(session.chat_history)}, Summary History: {len(session.summary_history)}"
        )
        # Don't update the session if there was an error
        raise exception_mapping(e)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str, current_user: AgentUser = Depends(get_current_user)
):
    """Delete a session"""

    if not session_service.exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    session_service.delete_session(session_id)
    myLogger.info(f"🗑️ Deleted session: {session_id} by user {current_user.userId}")
    return {"success": True}


@router.get("/sessions")
async def list_sessions(current_user: AgentUser = Depends(get_current_user)):
    """List all active sessions"""
    # Convert full sessions to summaries
    session_summaries = []
    for session in session_service.get_sessions_for_user(current_user.userId):
        summary = ChatSessionSummary(
            id=session.id,
            name=session.name,
            last_activity=session.last_activity,
            created_at=session.created_at,
        )
        session_summaries.append(summary)

    myLogger.info(f"📋 Listed sessions for user {current_user.userId}")
    return {"sessions": session_summaries}


@router.get("/sessions/snapshot/{snapshot_id}")
async def list_sessions_for_snapshot(
    snapshot_id: str, current_user: AgentUser = Depends(get_current_user)
):
    """List all active sessions for a snapshot"""
    # Convert full sessions to summaries
    session_summaries = []
    for session in session_service.get_sessions_for_snapshot(
        snapshot_id, current_user.userId
    ):
        summary = ChatSessionSummary(
            id=session.id,
            name=session.name,
            last_activity=session.last_activity,
            created_at=session.created_at,
        )
        session_summaries.append(summary)

    myLogger.info(
        f"📋 Listed sessions for snapshot {snapshot_id} by user {current_user.userId}"
    )
    return {"sessions": session_summaries}


@router.post("/sessions/{session_id}/cancel-agent-run/{run_id}")
async def cancel_agent_run(
    session_id: str,
    run_id: str,
    current_user: AgentUser = Depends(get_current_user),
):
    """Cancel an agent run"""
    msg = await chat_service.cancel_agent_run(session_id, run_id)
    myLogger.info(
        f"🛑 Cancelled agent run {run_id} for session {session_id} by user {current_user.userId}"
    )
    return {"message": msg}


@router.post("/cleanup")
async def cleanup_sessions(current_user: AgentUser = Depends(get_current_user)):
    """Manually trigger session cleanup"""
    before_count = len(session_service.get_sessions_for_snapshot())
    session_service.cleanup_inactive_sessions()
    after_count = len(session_service.get_sessions_for_snapshot())
    cleaned_count = before_count - after_count

    myLogger.info(
        "Session cleanup completed",
        sessions_cleaned=cleaned_count,
        remaining_sessions=after_count,
        user_id=current_user.userId,
    )
    return {"message": "Cleanup completed"}
