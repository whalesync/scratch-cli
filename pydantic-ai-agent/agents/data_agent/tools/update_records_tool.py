# Create custom JSON schema without $ref references
from agents.data_agent.models import (
    ChatRunContext,
    ResponseFromAgent,
    common_field_descriptions,
)

from typing import Optional, Dict, Any, List, Union, TypedDict
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext, Tool
from pydantic_ai._function_schema import FunctionSchema
from pydantic_core import SchemaValidator, core_schema
from agents.data_agent.model_utils import (
    find_column_by_name,
    get_active_table,
    unable_to_identify_active_table_error,
)
from logger import log_info, log_error
import json
from utils.get_styleguide import get_styleguide
from scratchpad.api import ScratchpadApi
from scratchpad.entities import RecordOperation
from logging import getLogger

logger = getLogger(__name__)


field_descriptions = {
    "a": "",
}


class FieldUpdate(TypedDict):
    """Dictionary type for a single field update"""

    field: str = Field(description=common_field_descriptions["field"])
    value: Any = Field(description="The new value for the field")


class RecordUpdateDict(TypedDict):
    """Dictionary type for record updates"""

    wsId: str = Field(description=common_field_descriptions["wsId"])
    updates: List[FieldUpdate] = Field(
        description="List of field updates, each containing 'field' and 'value' keys"
    )


json_schema = {
    "type": "object",
    "properties": {
        "record_updates": {
            "type": "array",
            "description": "List of record updates. Each update should have a wsId (record ID) and data (field updates)",
            "items": {
                "type": "object",
                "properties": {
                    "wsId": {
                        "type": "string",
                        "description": "The ID of the record to update",
                    },
                    "updates": {
                        "type": "array",
                        "description": "List of field updates. Each update should have field name and new value",
                        "items": {
                            "type": "object",
                            "properties": {
                                "field": {
                                    "type": "string",
                                    "description": "The name of the field to update",
                                },
                                "value": {
                                    "type": "string",
                                    "description": "The new value for the field",
                                },
                            },
                            "required": ["field", "value"],
                        },
                    },
                },
                "required": ["wsId", "updates"],
            },
        }
    },
    "required": ["record_updates"],
}

description = """
    Update existing records in a table in the active workbook.

    IMPORTANT: This tool creates SUGGESTIONS, not direct changes. Your updates are stored in the suggested_fields field and require user approval before being applied to the actual record data.

    Use this tool when the user asks to modify or edit existing records in a table.
    The record_updates should be a list of entities with the following fields:
    - 'wsId': the record ID to update
    - 'updates': a list of field update objects, each containing 'field' and 'value' keys

    CRITICAL: Pass record_updates as a proper list object, NOT as a JSON string.
    Example: [{'wsId': 'record_id_1', 'updates': [{'field': 'status', 'value': 'active'}, {'field': 'priority', 'value': 'high'}]}]
    NOT: "[{'wsId': 'record_id_1', 'updates': [{'field': 'status', 'value': 'active'}, {'field': 'priority', 'value': 'high'}]}]"

    If calling this tool always include a non empty list of record_updates.
"""


async def update_records_implementation(
    ctx: RunContext[ChatRunContext], record_updates: List[RecordUpdateDict]
) -> str:
    try:
        if record_updates is None or len(record_updates) == 0:
            return "Error: The list of record updates is empty. Provide at least one record update"

        for update in record_updates:
            if not isinstance(update, dict):
                return "Error: Each record update must be an object with 'wsId' and 'updates' keys"

            if "wsId" not in update or update.get("wsId") is None:
                return "Error: The wsId is required for each record update"

            if (
                "updates" not in update
                or update.get("updates") is None
                or len(update.get("updates")) == 0
            ):
                return f"Error: The updates is empty for update {update.get('wsId')}. The updates list must include at least one field update"

            # Validate each field update has required properties
            for field_update in update.get("updates", []):
                if not isinstance(field_update, dict):
                    return f"Error: Each field update must be an object with 'field' and 'value' properties for update {update.get('wsId')}"
                if (
                    "field" not in field_update
                    or field_update.get("field") is None
                    or field_update.get("field") == ""
                ):
                    return f"Error: Each field update must include a valid 'field' property for update {update.get('wsId')}"
                if "value" not in field_update:
                    return f"Error: Each field update must include a 'value' property for update {update.get('wsId')}"

        # Get the active workbook
        chatRunContext: ChatRunContext = ctx.deps

        table = get_active_table(chatRunContext)

        if not table:
            return unable_to_identify_active_table_error(chatRunContext)

        # Create RecordOperation objects for update operations translating field_name to the actual field ids
        update_operations = []
        data_errors = []
        for update in record_updates:
            data_payload = {}
            for field_update in update["updates"]:
                column = find_column_by_name(table, field_update["field"])
                if column:
                    data_payload[column.id.wsId] = field_update["value"]
                else:
                    data_errors.append(
                        f"Field '{field_update['field']}' not found in table '{table.name}'"
                    )

            if not data_payload:
                data_errors.append(
                    f"No valid fields to update for record {update['wsId']}"
                )
                continue

            update_operations.append(
                RecordOperation(op="update", wsId=update["wsId"], data=data_payload)
            )

        if len(data_errors) > 0:
            return f"Error: {', '.join(data_errors)}"

        if len(update_operations) == 0:
            return "Error: No valid records to update"

        log_info(
            "Updating records via bulk update",
            table_name=table.name,
            table_id=table.id,
            record_count=len(update_operations),
            workbook_id=chatRunContext.session.workbook_id,
        )

        # Import the bulk update function
        # Call the bulk update endpoint
        ScratchpadApi.bulk_suggest_record_updates(
            user_id=chatRunContext.user_id,
            workbook_id=chatRunContext.session.workbook_id,
            table_id=table.id,
            operations=update_operations,
        )

        logger.info(
            f"✅ Successfully updated {len(update_operations)} records in table '{table.name}'"
        )
        logger.debug(f"✏️ Updated records:")
        for i, operation in enumerate(update_operations):
            logger.debug(f"  Record {i+1}: ID={operation.wsId}, Data={operation.data}")
            # Also show the original field updates for clarity
            original_update = record_updates[i]
            logger.debug(f"    Field updates: {original_update['updates']}")

        log_info(
            "Successfully updated records",
            table_name=table.name,
            table_id=table.id,
            record_count=len(update_operations),
            workbook_id=chatRunContext.session.workbook_id,
        )

        return f"Successfully updated {len(update_operations)} records in table '{table.name}'. Updated record IDs: {[op.wsId for op in update_operations]}"
    except Exception as e:
        error_msg = f"Failed to update records in table '{table.name}': {str(e)}"
        log_error("Error updating records", table_name=table.name, error=str(e))
        logger.exception(e)
        return error_msg


tool_name = "update_records"


def create_update_records_tool(style_guides: Dict[str, str] = None):
    if style_guides is None:
        style_guides = {}

    # Use utility function to get custom name, description, and JSON schema
    custom_name = get_styleguide(style_guides, f"TOOLS_{tool_name}_name") or tool_name
    custom_description = (
        get_styleguide(style_guides, f"TOOLS_{tool_name}_description") or description
    )

    # Get custom JSON schema from style guides if available
    custom_json_schema = json_schema
    json_schema_content = get_styleguide(style_guides, f"TOOLS_{tool_name}_json_schema")
    if json_schema_content:
        try:
            custom_json_schema = json.loads(json_schema_content)
            logger.info(f"🔧 Using custom JSON schema for {tool_name}")
        except json.JSONDecodeError as e:
            logger.info(f"⚠️ Failed to parse custom JSON schema for {tool_name}: {e}")
            logger.info(f"   Using default schema instead")

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
        ),
    )
