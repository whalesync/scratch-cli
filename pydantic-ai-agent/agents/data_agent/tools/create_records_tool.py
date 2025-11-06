# Create custom JSON schema without $ref references
from logging import getLogger
from agents.data_agent.models import (
    ChatRunContext,
    common_field_descriptions,
)

from typing import Dict, Any, List, Union, TypedDict
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext, Tool
from pydantic_ai._function_schema import FunctionSchema
from pydantic_core import SchemaValidator, core_schema
from agents.data_agent.model_utils import (
    find_column_by_name,
    get_active_table,
    unable_to_identify_active_snapshot_error,
    unable_to_identify_active_table_error,
)
from agents.data_agent.data_agent_utils import get_table_context
from logger import log_info, log_error
import json
from utils.get_styleguide import get_styleguide
from scratchpad.api import ScratchpadApi
from scratchpad.entities import RecordOperation


logger = getLogger(__name__)


field_descriptions = {
    "a": "",
}


class FieldData(TypedDict):
    """Dictionary type for a single field data"""

    field: str = Field(description=common_field_descriptions["field"])
    value: Any = Field(description="The value for the field")


class RecordDataDict(TypedDict):
    """Dictionary type for record data"""

    data: List[FieldData] = Field(
        description="List of field data, each containing 'field' and 'value' keys"
    )


json_schema = {
    "type": "object",
    "properties": {
        "record_data_list": {
            "type": "array",
            "description": "List of record data. Each record should have data (field updates)",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "array",
                        "description": "List of field data. Each field should have field name and value",
                        "items": {
                            "type": "object",
                            "properties": {
                                "field": {
                                    "type": "string",
                                    "description": "The name of the field",
                                },
                                "value": {
                                    "type": "string",
                                    "description": "The value for the field",
                                },
                            },
                            "required": ["field", "value"],
                        },
                    }
                },
                "required": ["data"],
            },
        },
    },
    "required": ["record_data_list"],
}

description = """
    Create new records in a table.

    IMPORTANT: This tool creates the records and sets the new values as SUGGESTIONS. Your new records are stored in the suggested_fields field and require user approval before being applied to the actual record data.

    Use this tool when the user asks to create new records or add content data to a table.
    The table_name should be the name of the table you want to create records for.
    The record_data_list should be a list of entities with the following fields:
      - 'data': a non-empty list of field data objects, each containing 'field' and 'value' keys
    Only include fields that exist in the table and are not read only
    Do not call this tool with an empty record_data_list

    CRITICAL: Pass record_data_list as a proper list object, NOT as a JSON string.
    Example: [{'data': [{'field': 'name', 'value': 'John Doe'}, {'field': 'email', 'value': 'john@example.com'}]}, {'data': [{'field': 'name', 'value': 'Jane Smith'}, {'field': 'email', 'value': 'jane@example.com'}]}]
    NOT: "[{'data': [{'field': 'name', 'value': 'John Doe'}, {'field': 'email', 'value': 'john@example.com'}]}]"

"""


async def create_records_implementation(
    ctx: RunContext[ChatRunContext],
    record_data_list: List[RecordDataDict],
) -> str:
    table_name = None
    try:
        if record_data_list is None or len(record_data_list) == 0:
            return "Error: The list of record data is empty. Provide at least one record data"

        for i, record_data in enumerate(record_data_list):
            if not isinstance(record_data, dict):
                return "Error: Each data record must be an object with 'data' key and list of field data"

            if record_data.get("data") is None or len(record_data.get("data")) == 0:
                return f"Error: The data is empty for record {i+1}. The data list must include at least one field data"

            # Validate each field data has required properties
            for field_data in record_data.get("data", []):
                if not isinstance(field_data, dict):
                    return f"Error: Each field data must be an object with 'field' and 'value' properties for record {i+1}"
                if (
                    "field" not in field_data
                    or field_data.get("field") is None
                    or field_data.get("field") == ""
                ):
                    return f"Error: Each field data must include a valid 'field' property for record {i+1}"
                if "value" not in field_data:
                    return f"Error: Each field data must include a 'value' property for record {i+1}"

        # Get the active snapshot
        chatRunContext: ChatRunContext = ctx.deps

        if not chatRunContext.snapshot:
            return unable_to_identify_active_snapshot_error(chatRunContext)

        table = get_active_table(chatRunContext)
        table_name = table.name

        if not table:
            return unable_to_identify_active_table_error(chatRunContext)

        table_context = get_table_context(chatRunContext.snapshot, table.id.wsId)

        create_operations = []
        data_errors = []
        for index, record_data in enumerate(record_data_list):
            data_payload = {}
            for field_data in record_data["data"]:
                column = find_column_by_name(table, field_data["field"])
                if column:
                    if (
                        table_context
                        and table_context.readOnlyColumns
                        and column.id.wsId in table_context.readOnlyColumns
                    ):
                        data_errors.append(
                            f"Field '{field_data['field']}' is read only and cannot be set when creating records."
                        )
                        continue

                    data_payload[column.id.wsId] = field_data["value"]
                else:
                    data_errors.append(
                        f"Field '{field_data['field']}' not found in table '{table.name}'"
                    )

            if not data_payload:
                data_errors.append(f"No valid fields to create for record {index}")
                continue

            create_operations.append(
                RecordOperation(
                    op="create",
                    wsId=f"temp_id_{index+1}",  # Temporary ID for create operations
                    data=data_payload,
                ),
            )

        if len(data_errors) > 0:
            return f"Error: {', '.join(data_errors)}"

        if len(create_operations) == 0:
            return "Error: No valid records to create"

        log_info(
            "Creating records via bulk update",
            table_name=table_name,
            table_id=table.id.wsId,
            record_count=len(create_operations),
            snapshot_id=chatRunContext.session.snapshot_id,
        )

        # Call the bulk update endpoint
        ScratchpadApi.bulk_update_records(
            user_id=chatRunContext.user_id,
            snapshot_id=chatRunContext.session.snapshot_id,
            table_id=table.id.wsId,
            operations=create_operations,
            view_id=chatRunContext.view_id,
        )

        logger.info(
            f"✅ Successfully created {len(create_operations)} records in table '{table_name}'"
        )
        logger.info(f"📋 Table ID: {table.id.wsId}")
        logger.info(f"📊 Created records:")
        for i, operation in enumerate(create_operations):
            logger.info(f"  Record {i+1}: {operation.data}")
            # Also show the original field data for clarity
            original_record = record_data_list[i]
            logger.info(f"    Field data: {original_record['data']}")

        log_info(
            "Successfully created records",
            table_name=table_name,
            table_id=table.id.wsId,
            record_count=len(create_operations),
            snapshot_id=chatRunContext.session.snapshot_id,
        )

        return f"Successfully created {len(create_operations)} records in table '{table_name}'."
    except Exception as e:
        error_msg = f"Failed to create records in table '{table_name}': {str(e)}"
        log_error("Error creating records", table_name=table_name, error=str(e))
        logger.info(f"❌ {error_msg}")
        return error_msg


tool_name = "create_records"


def create_create_records_tool(style_guides: Dict[str, str] = None):
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
        function=create_records_implementation,
        function_schema=FunctionSchema(
            function=create_records_implementation,
            description=custom_description,
            json_schema=custom_json_schema,
            takes_ctx=True,
            is_async=True,
            validator=SchemaValidator(schema=core_schema.any_schema()),
        ),
    )
