#!/usr/bin/env python3
"""
Connector Builder Service for handling agent communication
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import HTTPException
from pydantic_ai.usage import UsageLimits

from .models import ConnectorBuilderRunContext, ResponseFromConnectorBuilderAgent
from .agent import create_connector_builder_agent
from .connector_builder_utils import load_custom_connector
from logger import log_info, log_error, log_debug, log_warning


class ConnectorBuilderSession:
    def __init__(self, session_id: str, custom_connector_id: str):
        self.id = session_id
        self.name = f"Connector Builder Session {session_id[-8:]}"
        self.custom_connector_id = custom_connector_id
        self.chat_history = []
        self.created_at = datetime.now().isoformat()
        self.last_activity = datetime.now().isoformat()


class ConnectorBuilderService:
    def __init__(self):
        self.sessions: Dict[str, ConnectorBuilderSession] = {}

    def create_session(
        self, session_id: str, custom_connector_id: str
    ) -> ConnectorBuilderSession:
        """Create a new connector builder session"""
        session = ConnectorBuilderSession(session_id, custom_connector_id)
        self.sessions[session_id] = session
        log_info(
            "Connector builder session created",
            session_id=session_id,
            custom_connector_id=custom_connector_id,
        )
        return session

    def get_session(self, session_id: str) -> Optional[ConnectorBuilderSession]:
        """Get a session by ID"""
        return self.sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session by ID"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            log_info("Connector builder session deleted", session_id=session_id)
            return True
        return False

    def list_sessions(self) -> List[ConnectorBuilderSession]:
        """List all sessions"""
        return list(self.sessions.values())

    def cleanup_inactive_sessions(self, max_age_hours: int = 24):
        """Clean up inactive sessions older than max_age_hours"""
        now = datetime.now()
        sessions_to_delete = []

        for session_id, session in self.sessions.items():
            last_activity = datetime.fromisoformat(session.last_activity)
            age_hours = (now - last_activity).total_seconds() / 3600

            if age_hours > max_age_hours:
                sessions_to_delete.append(session_id)

        for session_id in sessions_to_delete:
            self.delete_session(session_id)

        if sessions_to_delete:
            log_info(
                "Cleaned up inactive connector builder sessions",
                deleted_count=len(sessions_to_delete),
                remaining_count=len(self.sessions),
            )

    async def process_connector_builder_request(
        self,
        message: str,
        custom_connector_id: str,
        api_token: Optional[str] = None,
        style_guides: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
    ) -> ResponseFromConnectorBuilderAgent:
        """Process a connector builder request with the agent and return the response"""
        print(
            f"🤖 Starting connector builder agent processing for connector: {custom_connector_id}"
        )

        try:
            # Load the custom connector data
            print(f"📋 Loading custom connector data...")
            custom_connector = load_custom_connector(custom_connector_id, api_token)
            print(
                f"✅ Custom connector loaded: {custom_connector.get('name', 'Unknown')}"
            )

            # Create context with loaded data
            context = ConnectorBuilderRunContext(
                custom_connector_id=custom_connector_id,
                api_token=api_token,
                custom_connector=custom_connector,
            )

            # Add custom connector information to the prompt
            connector_context = f"\n\nCUSTOM CONNECTOR DATA:\n"
            connector_context += f"Name: {custom_connector.get('name', 'Unknown')}\n"
            connector_context += f"ID: {custom_connector.get('id', 'Unknown')}\n"

            # Add existing functions if they exist
            if custom_connector.get("listTables"):
                connector_context += f"Existing listTables function: Yes\n"
            if custom_connector.get("fetchSchema"):
                connector_context += f"Existing fetchSchema function: Yes\n"
            if custom_connector.get("pollRecords"):
                connector_context += f"Existing pollRecords function: Yes\n"
            if custom_connector.get("createRecord"):
                connector_context += f"Existing createRecord function: Yes\n"
            if custom_connector.get("updateRecord"):
                connector_context += f"Existing updateRecord function: Yes\n"
            if custom_connector.get("deleteRecord"):
                connector_context += f"Existing deleteRecord function: Yes\n"

            # Add prompt if available
            if custom_connector.get("prompt"):
                connector_context += (
                    f"\nConnector Prompt:\n{custom_connector.get('prompt')}\n"
                )

            # Add API key if available
            if custom_connector.get("apiKey"):
                connector_context += f"\nAPI Key available: Yes\n"

            # Format the custom connector data for the prompt
            custom_connector_name = custom_connector.get("name", "Unknown")
            custom_connector_prompt = custom_connector.get(
                "prompt", "No prompt provided"
            )
            custom_connector_api_key = custom_connector.get(
                "apiKey", "No API key provided"
            )

            # Format existing functions
            list_tables_function = custom_connector.get(
                "listTables", "Not generated yet"
            )
            fetch_schema_function = custom_connector.get(
                "fetchSchema", "Not generated yet"
            )
            poll_records_function = custom_connector.get(
                "pollRecords", "Not generated yet"
            )
            get_record_function = custom_connector.get("getRecord", "Not generated yet")
            create_record_function = custom_connector.get(
                "createRecord", "Not generated yet"
            )
            update_record_function = custom_connector.get(
                "updateRecord", "Not generated yet"
            )
            delete_record_function = custom_connector.get(
                "deleteRecord", "Not generated yet"
            )

            # Format test results and data
            tables_data = custom_connector.get("tables", "No tables data available")
            schema_data = custom_connector.get("schema", "No schema data available")
            poll_records_response = custom_connector.get(
                "pollRecordsResponse", "No poll records response available"
            )
            get_record_response = custom_connector.get(
                "getRecordResponse", "No get record response available"
            )

            # Create the full prompt with instructions to generate and save
            full_prompt = f"""RESPOND TO: {message}

{connector_context}

IMPORTANT INSTRUCTIONS:
1. Generate the requested function based on the user's message
2. Test the function if possible using the available tools
3. If the function works correctly, save it to the custom connector using the save_custom_connector_tool
4. Provide a clear response explaining what you did and the results

The agent has access to these tools:
- execute_list_tables_tool: Test listTables functions
- save_custom_connector_tool: Save generated functions to the custom connector
- save_custom_connector_with_test_result_tool: Save generated functions and test results to the custom connector

TESTING AND PERSISTENCE:
- listTables test results can be saved to the 'tables' field
- fetchSchema test results can be saved to the 'schema' field  
- pollRecords test results can be saved to the 'pollRecordsResponse' field
- getRecord test results can be saved to the 'getRecordResponse' field
- Other functions can be tested but results are not persisted

WORKFLOW:
1. Generate the function
2. Test it using the appropriate tool
3. If test is successful, save both function and test result (if applicable) using save_custom_connector_with_test_result_tool
4. If test fails, save only the function using save_custom_connector_tool

CURRENT CUSTOM CONNECTOR STATE:
The current custom connector contains the following data that you should consider when generating new functions:

### Basic Information:
- **Name**: {custom_connector_name}
- **Prompt**: {custom_connector_prompt}
- **API Key**: {custom_connector_api_key}

### Existing Functions:
- **listTables**: {list_tables_function}
- **fetchSchema**: {fetch_schema_function}
- **pollRecords**: {poll_records_function}
- **getRecord**: {get_record_function}
- **createRecord**: {create_record_function}
- **updateRecord**: {update_record_function}
- **deleteRecord**: {delete_record_function}

### Test Results and Data:
- **Tables**: {tables_data}
- **Schema**: {schema_data}
- **Poll Records Response**: {poll_records_response}
- **Get Record Response**: {get_record_response}

### Function Dependencies:
When generating new functions, consider the existing functions and their outputs:
- If generating `fetchSchema`, use the `tables` data to know which tables are available
- If generating `pollRecords`, use the `tables` data to select a table to poll
- If generating `getRecord`, use the `pollRecordsResponse` to know what records are available
- Ensure new functions are consistent with the existing function patterns and API structure

Please generate, test, and save the function as requested."""

            print(f"🔍 About to call create_connector_builder_agent with:")
            print(f"   model: {model}")
            print(f"   capabilities: {capabilities}")
            print(f"   style_guides: {style_guides}")

            # Create and run the agent
            agent = create_connector_builder_agent(
                model_name=model, capabilities=capabilities, style_guides=style_guides
            )

            try:
                result = await asyncio.wait_for(
                    agent.run(
                        full_prompt,
                        deps=context,
                        usage_limits=UsageLimits(
                            request_limit=10,  # Maximum 10 requests per agent run
                        ),
                    ),
                    timeout=30.0,
                )  # 30 second timeout
                print(f"✅ Agent.run() completed")
            except asyncio.TimeoutError:
                log_error(
                    "Agent processing timeout",
                    custom_connector_id=custom_connector_id,
                    timeout_seconds=30,
                )
                print(f"❌ Agent.run() timed out after 30 seconds")
                raise HTTPException(status_code=408, detail="Agent response timeout")

            # The agent returns the response directly
            actual_response = result
            if not actual_response:
                log_error(
                    "No response from agent", custom_connector_id=custom_connector_id
                )
                print(f"❌ No response from agent")
                raise HTTPException(status_code=500, detail="No response from agent")

            print(f"✅ Valid ResponseFromConnectorBuilderAgent received")
            return actual_response

        except Exception as e:
            log_error(
                "Agent processing error",
                custom_connector_id=custom_connector_id,
                error=str(e),
            )
            print(f"❌ Error in agent processing: {e}")
            import traceback

            traceback.print_exc()
            raise HTTPException(
                status_code=500, detail=f"Error processing message: {str(e)}"
            )
