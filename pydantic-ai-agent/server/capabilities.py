#!/usr/bin/env python3
"""
Capability constants for data agent tools
"""
from server.DTOs import Capability

from typing import List, Optional


# Data manipulation capabilities
DATA_UPDATE = "data:update"
DATA_CREATE = "data:create"
DATA_FIELD_TOOLS = "data:field-tools"
DATA_DELETE = "data:delete"
DATA_FETCH_TOOLS = "data:fetch-tools"

# Table structure capabilities
TABLE_ADD_COLUMN = "table:add-column"
TABLE_REMOVE_COLUMN = "table:remove-column"

# View capabilities
VIEWS_FILTERING = "views:filtering"

# Other capabilities
OTHER_URL_CONTENT_LOAD = "other:load-url-content"
OTHER_UPLOAD_CONTENT = "other:upload-content"


def has_capability(
    capability: str,
    capabilities: Optional[List[str]] = None,
) -> bool:
    return capabilities is not None and capability in capabilities


def has_one_of_capabilities(
    capabilities: Optional[List[str]] = None, *capabilities_to_check: str
) -> bool:
    return capabilities is not None and any(
        capability in capabilities for capability in capabilities_to_check
    )


def has_data_manipulation_capabilities(
    capabilities: Optional[List[str]] = None,
) -> bool:
    return has_one_of_capabilities(
        capabilities, DATA_CREATE, DATA_UPDATE, DATA_DELETE, DATA_FIELD_TOOLS
    )


AVAILABLE_CAPABILITIES = [
    Capability(
        code=DATA_CREATE,
        enabledByDefault=True,
        description="Create new records for a table in the active snapshot using data provided by the LLM.",
    ),
    Capability(
        code=DATA_UPDATE,
        enabledByDefault=True,
        description="Update existing records in a table in the active snapshot (creates suggestions, not direct changes).",
    ),
    Capability(
        code=DATA_DELETE,
        enabledByDefault=True,
        description="Delete records from a table in the active snapshot by their IDs.",
    ),
    Capability(
        code=DATA_FIELD_TOOLS,
        enabledByDefault=True,
        description="Tools to edit specific fields",
    ),
    Capability(
        code=VIEWS_FILTERING,
        enabledByDefault=True,
        description="Set or clear SQL-based filters on tables to show/hide specific records.",
    ),
    Capability(
        code=TABLE_ADD_COLUMN,
        enabledByDefault=True,
        description="Add scratch columns to the active table.",
    ),
    Capability(
        code=TABLE_REMOVE_COLUMN,
        enabledByDefault=True,
        description="Remove scratch columns from the active table.",
    ),
    Capability(
        code=OTHER_URL_CONTENT_LOAD,
        enabledByDefault=True,
        description="Allows the LLM to load content from a URL and use it in the conversation.",
    ),
    Capability(
        code=OTHER_UPLOAD_CONTENT,
        enabledByDefault=True,
        description="Allows the LLM to upload content to the active snapshot.",
    ),
    Capability(
        code=DATA_FETCH_TOOLS,
        enabledByDefault=True,
        description="Tools for loading additional records from different tables and views into the context.",
    ),
]
