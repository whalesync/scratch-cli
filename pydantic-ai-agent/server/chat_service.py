#!/usr/bin/env python3
"""
Chat Service for handling agent communication and session management
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Awaitable
from fastapi import HTTPException
from pydantic_ai.usage import UsageLimits
from pydantic_ai import Agent
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)
from agents.data_agent.models import ChatRunContext, ChatSession, FocusedCell, ResponseFromAgent
from agents.data_agent.agent import create_agent, extract_response
from logger import log_info, log_error, log_debug, log_warning
from scratchpad_api import API_CONFIG, check_server_health
# from tools import set_api_token, set_session_data

class ChatService:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}

    def create_session(self, session_id: str, snapshot_id: str) -> ChatSession:
        """Create a new chat session and set session data in tools"""
        now = datetime.now()
        session = ChatSession(
            id=session_id,
            name=f"Chat Session {now.strftime('%Y-%m-%d %H:%M')}",
            last_activity=now,
            created_at=now,
            snapshot_id=snapshot_id
        )
        
        
        log_info("Session created and session data set", 
                 session_id=session_id, 
                 snapshot_id=snapshot_id)
        print(f"📝 Created session: {session_id}")
        if snapshot_id:
            print(f"📊 Session associated with snapshot: {snapshot_id}")
        
        return session

    async def process_message_with_agent(
        self, 
        session: ChatSession, 
        user_message: str, 
        api_token: str,
        style_guides: Dict[str, str],
        model: Optional[str] = None,
        view_id: Optional[str] = None,
        read_focus: Optional[List[FocusedCell]] = None,
        write_focus: Optional[List[FocusedCell]] = None,
        capabilities: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> ResponseFromAgent:
        """Process a message with the agent and return the response"""
        print(f"🤖 Starting agent processing for session: {session.id}")
        if session.snapshot_id:
            print(f"📊 Session associated with snapshot: {session.snapshot_id}")
        # Set API token in tools' global state for this message
        if api_token:
            # set_api_token(api_token)
            log_info("API token set for tools", 
                     session_id=session.id, 
                     token_length=len(api_token), 
                     token_preview=api_token[:8] + "..." if len(api_token) > 8 else api_token,
                     snapshot_id=session.snapshot_id)
            print(f"🔑 API token set for tools: {api_token[:8]}..." if len(api_token) > 8 else api_token)   
        else:
            log_info("No API token provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No API token provided")
        
        # Log view ID if provided
        if view_id:
            log_info("View ID provided for session", session_id=session.id, view_id=view_id, snapshot_id=session.snapshot_id)
            print(f"👁️ View ID provided: {view_id}")
        else:
            log_info("No view ID provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No view ID provided")
        
        # Log capabilities if provided
        if capabilities:
            log_info("Capabilities provided for session", session_id=session.id, capabilities=capabilities, snapshot_id=session.snapshot_id)
            print(f"🔧 Capabilities provided: {capabilities}")
        else:
            log_info("No capabilities provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No capabilities provided")
        
        # Log style guides if provided
        if style_guides:
            log_info("Style guides provided for session", session_id=session.id, style_guides_count=len(style_guides), style_guide_names=list(style_guides.keys()), snapshot_id=session.snapshot_id)
            print(f"📋 Style guides provided: {len(style_guides)} style guides")
            for i, (key, content) in enumerate(style_guides.items(), 1):
                truncated_content = content[:50] + "..." if len(content) > 50 else content
                print(f"   Style guide {i}: {key} - {truncated_content}")
        else:
            log_info("No style guides provided for session", session_id=session.id, snapshot_id=session.snapshot_id)
            print(f"ℹ️ No style guides provided")
        
        
        try:
            # Build context from session history
            context = ""
            
            # Style guides are now handled in the system prompt, not user prompt context
            if style_guides:
                print(f"📚 Style guides will be included in system prompt: {len(style_guides)} style guides")
                for i, key in enumerate(style_guides.keys(), 1):
                    print(f"   Style Guide {i}: {key}")
            else:
                print(f"ℹ️ No style guides to include")
            
            # Include summary history for agent context
            # if session.summary_history:
            #     context += f"\n\nSUMMARY OF RECENT USER REQUESTS AND ASSISTANT ACTIONS:\n"
            #     for summary in session.summary_history:
            #         context += f"User: {summary.request_summary}\n"
            #         context += f"Agent: {summary.response_summary}\n\n"
            
            # Include recent chat history for user context (last 5 messages)
            # if session.chat_history:
            #     recent_history = session.chat_history[-5:]
            #     context += f"\n\nRECENT CONVERSATION:\n"
            #     for msg in recent_history:
            #         truncated_msg = msg.message[:100] + "..." if len(msg.message) > 100 else msg.message
            #         context += f"{msg.role.capitalize()}: {truncated_msg}\n"
            
            # Create the full prompt with memory
            full_prompt = f"RESPOND TO: {user_message} {context}"
            
            print(f"DEBUG - Context length: {len(context)}")
            print(f"DEBUG - Chat history length: {len(session.chat_history)}")
            print(f"DEBUG - Summary history length: {len(session.summary_history)}")
            print(f"DEBUG - Full prompt length: {len(full_prompt)}")
            
            # Log agent processing details
            log_debug("Agent processing details", 
                     session_id=session.id,
                     context_length=len(context),
                     chat_history_length=len(session.chat_history),
                     summary_history_length=len(session.summary_history),
                     style_guides_count=len(style_guides) if style_guides else 0,
                     capabilities_count=len(capabilities) if capabilities else 0,
                     full_prompt_length=len(full_prompt),
                     user_message=user_message,
                     has_api_token=api_token is not None,
                     snapshot_id=session.snapshot_id)
            
            # Get structured response from agent with timeout
            print(f"🤖 Calling agent.run() with timeout...")
            try:
                # Pre-load snapshot data and records for efficiency
                print(f"🔄 Pre-loading snapshot data and records...")
                snapshot_data = None
                preloaded_records = {}
                
                if session.snapshot_id and api_token:
                    try:
                        # Fetch snapshot details
                        from scratchpad_api import get_snapshot, list_records
                        from agents.data_agent.data_agent_utils import convert_scratchpad_snapshot_to_ai_snapshot
                        if progress_callback:
                            await progress_callback("Pre-loading snapshot data and records")
                        
                        snapshot_data = get_snapshot(session.snapshot_id, api_token)
                        snapshot = convert_scratchpad_snapshot_to_ai_snapshot(snapshot_data, session)
                        
                        # Pre-load records for each table
                        for table in snapshot.tables:
                            try:
                                records_result = list_records(session.snapshot_id, table.id.wsId, api_token, view_id=view_id)
                                preloaded_records[table.name] = [
                                    {
                                        'id': {'wsId': record.id.wsId, 'remoteId': record.id.remoteId},
                                        'fields': record.fields,
                                        'suggested_fields': record.suggested_fields,
                                        'edited_fields': record.edited_fields,
                                        'dirty': record.dirty
                                    }
                                    for record in records_result.records
                                ]
                                print(f"📊 Pre-loaded {len(preloaded_records[table.name])} records for table '{table.name}'")
                                if records_result.filteredRecordsCount > 0:
                                    print(f"🚫 {records_result.filteredRecordsCount} records are filtered out for table '{table.name}'")
                            except Exception as e:
                                print(f"⚠️ Failed to pre-load records for table '{table.name}': {e}")
                                preloaded_records[table.name] = []
                        
                        print(f"✅ Pre-loaded data for {len(snapshot.tables)} tables")
                    except Exception as e:
                        print(f"⚠️ Failed to pre-load snapshot data: {e}")
                        snapshot = None
                        preloaded_records = {}
                
                # print(f"🤯🤯🤯🤯 PRELOADED RECORDS: {preloaded_records}")


                # Create context with pre-loaded data
                chatRunContext:ChatRunContext = ChatRunContext(
                    session=session,
                    api_token=api_token,
                    view_id=view_id,
                    snapshot=snapshot,
                    read_focus=read_focus,
                    write_focus=write_focus,
                    preloaded_records=preloaded_records,
                )

                # Add pre-loaded snapshot data and records to the prompt
                if chatRunContext.snapshot:
                    snapshot_context = f"\n\n-- CURRENT SNAPSHOT DATA START --\n"
                    snapshot_context += f"Snapshot: {chatRunContext.snapshot.name or chatRunContext.snapshot.id}\n"
                    snapshot_context += f"Tables: {len(chatRunContext.snapshot.tables)}\n\n"
                    
                    for table in chatRunContext.snapshot.tables:
                        snapshot_context += f"TABLE: {table.name} (ID: {table.id.wsId})\n"
                        snapshot_context += f"Columns: {[col.name for col in table.columns]}\n"
                        
                        # Add records if available
                        if chatRunContext.preloaded_records and table.name in chatRunContext.preloaded_records:
                            records = chatRunContext.preloaded_records[table.name]
                            snapshot_context += f"Records ({len(records)}):\n\n"
                            
                            # Add filtered records information if available
                            try:
                                records_result = list_records(session.snapshot_id, table.id.wsId, api_token, view_id=view_id)
                                if records_result.filteredRecordsCount > 0:
                                    snapshot_context += f"Note: {records_result.filteredRecordsCount} records are currently filtered out and not shown in this list.\n\n"
                            except:
                                pass  # If we can't get the filtered count, just continue
                            
                            # Record structure is now explained in the system prompt
                            
                            # Format records using the shared function
                            from agents.data_agent.data_agent_utils import format_records_for_display
                            records_summary = format_records_for_display(records, limit=50, truncate_record_content=False)
                            snapshot_context += f"RECORDS:\n{records_summary}\n"
                        else:
                            snapshot_context += "Records: Not loaded\n"
                        snapshot_context += "\n"
                    
                    # Update the full prompt with snapshot data
                    full_prompt = f"RESPOND TO: {user_message} {context}{snapshot_context}"

                    snapshot_context = f"\n\n-- CURRENT SNAPSHOT DATA END --\n"

                    # Add focus cells information to the prompt if they exist
                    if read_focus or write_focus:
                        focus_context = "\n\nFOCUS CELLS:\n"
                        
                        if read_focus:
                            focus_context += "Read Focus Cells:\n"
                            for cell in read_focus:
                                focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
                            focus_context += "\n"
                        
                        if write_focus:
                            focus_context += "Write Focus Cells:\n"
                            for cell in write_focus:
                                focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
                            focus_context += "\n"
                        
                        full_prompt += focus_context

                print(f"🔍 About to call create_agent with:")
                print(f"   model: {model}")
                print(f"   capabilities: {capabilities}")
                print(f"   style_guides: {style_guides}")
                print(f"   style_guides type: {type(style_guides)}")
                
                if progress_callback:
                    await progress_callback(f"Creating agent with {model} model")

                agent = create_agent(model_name=model, capabilities=capabilities, style_guides=style_guides)

                result = None
                
                # Runs the agent in streaming mode so we can wrap it in the timeout function blow
                # Final result will get set into the result above
                async def process_stream():
                    nonlocal result
                    nodes = []
                    async with agent.iter(
                        full_prompt, 
                        deps=chatRunContext,
                        usage_limits=UsageLimits(
                            request_limit=10,  # Maximum 20 requests per agent run
                            # request_tokens_limit=10000,  # Maximum 10k tokens per request
                            # response_tokens_limit=5000,  # Maximum 5k tokens per response
                            # total_tokens_limit=15000  # Maximum 15k tokens total
                        )
                    ) as agent_run:
                        async for node in agent_run:
                            if progress_callback:
                                # print(f"Processing node: {node}")

                                if Agent.is_user_prompt_node(node):
                                    # A user prompt node => The user has provided input
                                    await progress_callback(f'User prompt constructed')
                                elif Agent.is_model_request_node(node):
                                    # A model request node => We can stream tokens from the model's request
                                    await progress_callback(f'Model request sent to LLM')
                                    # async with node.stream(agent_run.ctx) as request_stream:
                                        # async for event in request_stream:
                                        #     if isinstance(event, PartStartEvent):
                                        #         output_messages.append(
                                        #             f'[Request] Starting part {event.index}: {event.part!r}'
                                        #         )
                                        #     elif isinstance(event, PartDeltaEvent):
                                        #         if isinstance(event.delta, TextPartDelta):
                                        #             output_messages.append(
                                        #                 f'[Request] Part {event.index} text delta: {event.delta.content_delta!r}'
                                        #             )
                                        #         elif isinstance(event.delta, ToolCallPartDelta):
                                        #             output_messages.append(
                                        #                 f'[Request] Part {event.index} args_delta={event.delta.args_delta}'
                                        #             )
                                        #     elif isinstance(event, FinalResultEvent):
                                        #         output_messages.append(
                                        #             f'[Result] The model produced a final output (tool_name={event.tool_name})'
                                        #         )
                                elif Agent.is_call_tools_node(node):
                                    # A handle-response node => The model returned some data, potentially calls a tool

                                    model_response = node.model_response
                                    if model_response.parts:
                                        model_response_part = model_response.parts[0]
                                        if model_response_part.tool_name and model_response_part.tool_name == "final_result": # type: ignore
                                            continue

                                    async with node.stream(agent_run.ctx) as handle_stream:
                                        async for event in handle_stream:
                                            if isinstance(event, FunctionToolCallEvent):
                                                await progress_callback(f'Tool call {event.part.tool_name!r} with args={event.part.args} (tool_call_id={event.part.tool_call_id!r})')
                                            elif isinstance(event, FunctionToolResultEvent):
                                                await progress_callback(f'Tool call {event.tool_call_id!r} returned => {event.result.content}')
                                                
                                elif Agent.is_end_node(node):
                                    await progress_callback(f'Constructing final agent response')

                        result = agent_run.result

                
                # Run the streaming with timeout
                await asyncio.wait_for(process_stream(), timeout=60.0)
                print(f"✅ Agent.run() completed")
                session.message_history = result.all_messages()
            except asyncio.TimeoutError:
                log_error("Agent processing timeout", session_id=session.id, timeout_seconds=30, snapshot_id=session.snapshot_id)
                print(f"❌ Agent.run() timed out after 30 seconds")
                raise HTTPException(status_code=408, detail="Agent response timeout")
            
            # The agent returns an AgentRunResult wrapper, we need to extract the actual response
            response = result
            print(f"🔍 Agent result: {type(response)}")
            print(f"🔍 Response class: {response.__class__}")
            print(f"🔍 ResponseFromAgent class: {ResponseFromAgent}")
            
            # Extract the actual response from the AgentRunResult
            actual_response = extract_response(response, ResponseFromAgent)
            if not actual_response:
                log_error("No response from agent", session_id=session.id, snapshot_id=session.snapshot_id)
                print(f"❌ No response from agent")
                raise HTTPException(status_code=500, detail="No response from agent")
            
            print(f"🔍 Actual response: {type(actual_response)}")
            print(f"🔍 Is instance check: {isinstance(actual_response, ResponseFromAgent)}")
            
            # Check if actual_response has the expected fields using getattr for safety
            try:
                response_message = getattr(actual_response, 'response_message', None)
                response_summary = getattr(actual_response, 'response_summary', None)
                request_summary = getattr(actual_response, 'request_summary', None)
                
                has_expected_fields = (
                    actual_response and 
                    response_message is not None and 
                    response_summary is not None and 
                    request_summary is not None
                )
            except:
                has_expected_fields = False
            
            if has_expected_fields:
                log_info("Agent response successful", 
                         session_id=session.id,
                         response_length=len(response_message),  # type: ignore
                         response_summary_length=len(response_summary),  # type: ignore
                         request_summary_length=len(request_summary),  # type: ignore
                         had_api_token=api_token is not None,
                         snapshot_id=session.snapshot_id)
                print(f"✅ Valid ResponseFromAgent received")
                # Return both the SendMessageResponse and the original ResponseFromAgent
                # send_response = SendMessageResponseDTO(
                #     response_message=response_message,  # type: ignore
                #     response_summary=response_summary,  # type: ignore
                #     request_summary=request_summary,  # type: ignore
                # )
                
                # # Store the original response for access to summaries
                # send_response.original_response = actual_response  # type: ignore
                
                return actual_response
            else:
                log_error("Invalid agent response", session_id=session.id, response_type=type(response), snapshot_id=session.snapshot_id)
                print(f"❌ Invalid response from agent: {response}")
                raise HTTPException(status_code=500, detail="Invalid response from agent")
                
        except Exception as e:
            log_error("Agent processing error", session_id=session.id, error=str(e), snapshot_id=session.snapshot_id)
            print(f"❌ Error in agent processing: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

    def cleanup_inactive_sessions(self, max_age_hours: int = 24) -> None:
        """Clean up inactive sessions"""
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        to_delete = []
        
        for session_id, session in self.sessions.items():
            if session.last_activity < cutoff:
                to_delete.append(session_id)
        
        for session_id in to_delete:
            del self.sessions[session_id]
        
        if to_delete:
            log_info("Sessions cleaned up", sessions_cleaned=len(to_delete), max_age_hours=max_age_hours)
            print(f"🧹 Cleaned up {len(to_delete)} inactive sessions") 