# Create custom JSON schema without $ref references

from typing import Dict, Any, List, TypedDict
from pydantic import Field
from pydantic_ai import Tool
from pydantic_ai._function_schema import FunctionSchema
from pydantic_core import SchemaValidator, core_schema
import json


field_descriptions = {
    "a": "",
}


class RecordUpdateDict(TypedDict):
    """Dictionary type for record updates"""

    wsId: str = Field(description="Id of the record to update")
    data: Dict[str, Any] = Field(description="Field names and their new values")


json_schema = {
    "type": "object",
    "properties": {
        "table_name": {
            "type": "string",
            "description": "The name of the table to update records in",
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
                        "description": "The ID of the record to update",
                    },
                    "data": {
                        "type": "object",
                        "description": "Field names and their new values",
                    },
                },
                "required": ["wsId", "data"],
            },
        },
    },
    "required": ["table_name", "record_updates"],
}

description = """
    Update existing records in a table in the active snapshot.

    IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

    Tool Parameters:
    This tool requires two main pieces of information:
    Table Name - You need to specify which table you want to update records in. This should be the name of the table as a text string.
    Record Updates - You need to provide a list of records to update. Each record update must contain:
    Record ID (wsId) - The unique identifier of the specific record you want to update
    Data - A collection of field names and their new values that you want to change in that record
    Example:
        Table: "customers"
        Records to update: [
            Record ID: "123", Data: {"name": "John Smith", "email": "john@example.com"}
            Record ID: "456", Data: {"status": "active"}
        ]
        This would update the "name" and "email" fields for record "123" and the "status" field for record "456" in the "customers" table.
"""


async def update_records_implementation(
    table_name: str, record_updates: List[RecordUpdateDict]
) -> str:
    try:
        return f"Successfully updated"
    except Exception as e:
        error_msg = f"Failed to update records in table '{table_name}': {str(e)}"
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
            takes_ctx=False,
            is_async=True,
            validator=SchemaValidator(schema=core_schema.any_schema()),
        ),
    )
