

# Create custom JSON schema without $ref references
from agents.data_agent.models import ChatRunContext, ChatSession, ResponseFromAgent, WithTableName, common_field_descriptions
from agents.data_agent.data_agent_utils import format_records_for_display

from typing import Optional, Dict, Any, List, Union, TypedDict
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext, Tool
from pydantic_ai._function_schema import FunctionSchema
from pydantic_core import SchemaValidator, core_schema
from scratchpad_api import list_records, get_snapshot, API_CONFIG
from logger import log_info, log_error
import json


field_descriptions = {
    "a": "",
}

class RecordUpdateDict(TypedDict):
    """Dictionary type for record updates"""
    wsId: str = Field(description=common_field_descriptions["wsId"])
    data: Dict[str, Any] = Field(description="Field names and their new values")

json_schema = {
    "type": "object",
    "properties": {
        "table_name": {
            "type": "string",
            "description": "The name of the table to update records in"
        },
        "record_updates": {
            "type": "array",
            "description": "List of record updates, each containing 'wsId' and 'data' keys",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "wsId": {
                        "type": "string",
                        "description": "The ID of the record to update"
                    },
                    "data": {
                        "type": "object",
                        "description": "Field names and their new values"
                    }
                },
                "required": ["wsId", "data"]
            }
        }
    },
    "required": ["table_name", "record_updates"]
}

description = """
    Update existing records in a table in the active snapshot.

    IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

    Use this tool when the user asks to modify or edit existing records in a table.
    The table_name should be the name of the table you want to update records in.
    The record_updates should be a list of entities with the following fields:
    - 'wsId': the record ID to update
    - 'data': a dictionary of field names and new values to set

    CRITICAL: Pass record_updates as a proper list object, NOT as a JSON string.
    Example: [{'wsId': 'record_id_1', 'data': {'status': 'active', 'priority': 'high'}}]
    NOT: "[{'wsId': 'record_id_1', 'data': {'status': 'active', 'priority': 'high'}}]"

    If calling this tool always include the table_name and non empty record_updates.
"""


async def update_records_implementation(ctx: RunContext[ChatRunContext], table_name: str, record_updates: List[RecordUpdateDict]) -> str:
    try:
        
        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps 
        
        # Find the table by name
        table = None
        for t in chatRunContext.snapshot.tables:
            if t.name.lower() == table_name.lower():
                table = t
                break
        
        if not table:
            available_tables = [t.name for t in chatRunContext.snapshot.tables]
            return f"Error: Table '{table_name}' not found. Available tables: {available_tables}"
        
        from scratchpad_api import RecordOperation
        
        # Create RecordOperation objects for update operations using map
        update_operations = list(map(
            lambda update: RecordOperation(
                op="update",
                wsId=update['wsId'],
                data=update['data']
            ),
            record_updates
        ))
        
        log_info("Updating records via bulk update", 
                table_name=table_name,
                table_id=table.id.wsId,
                record_count=len(update_operations),
                snapshot_id=chatRunContext.session.snapshot_id)
        
        # Import the bulk update function
        from scratchpad_api import bulk_update_records
        
        # Call the bulk update endpoint
        bulk_update_records(
            snapshot_id=chatRunContext.session.snapshot_id,
            table_id=table.id.wsId,
            operations=update_operations,
            api_token=chatRunContext.api_token,
            view_id=chatRunContext.view_id
        )
        
        print(f"✅ Successfully updated {len(update_operations)} records in table '{table_name}'")
        print(f"📋 Table ID: {table.id.wsId}")
        print(f"✏️ Updated records:")
        for i, operation in enumerate(update_operations):
            print(f"  Record {i+1}: ID={operation.wsId}, Data={operation.data}")
        
        log_info("Successfully updated records", 
                table_name=table_name,
                table_id=table.id.wsId,
                record_count=len(update_operations),
                snapshot_id=chatRunContext.session.snapshot_id)
        
        return f"Successfully updated {len(update_operations)} records in table '{table_name}'. Updated record IDs: {[op.wsId for op in update_operations]}"      
    except Exception as e:
        error_msg = f"Failed to update records in table '{table_name}': {str(e)}"
        log_error("Error updating records", 
                table_name=table_name,
                error=str(e))
        print(f"❌ {error_msg}")
        return error_msg

tool_name = "update_records"

def create_update_records_tool(style_guides: Dict[str, str] = None):
    if style_guides is None:
        style_guides = {}
    
    custom_name = style_guides.get(f"TOOLS_{tool_name}_name", tool_name)
    custom_description = style_guides.get(f"TOOLS_{tool_name}_description", description)
    
    # Get custom JSON schema from style guides if available
    custom_json_schema = json_schema
    json_schema_key = f"TOOLS_{tool_name}_json_schema"
    if json_schema_key in style_guides:
        try:
            custom_json_schema = json.loads(style_guides[json_schema_key])
            print(f"🔧 Using custom JSON schema for {tool_name}")
        except json.JSONDecodeError as e:
            print(f"⚠️ Failed to parse custom JSON schema for {tool_name}: {e}")
            print(f"   Using default schema instead")
    
    return Tool(
        name=custom_name,
        description=custom_description,
        function=update_records_implementation,
        function_schema=FunctionSchema(
            function=update_records_implementation,
            description=custom_description,
            json_schema=custom_json_schema,
            takes_ctx=True,
            is_async=True,
            validator=SchemaValidator(schema=core_schema.any_schema()),
        )
    )
