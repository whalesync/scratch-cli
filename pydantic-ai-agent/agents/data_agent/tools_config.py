#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from typing import Dict, List, Optional

from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from agents.data_agent.tools.add_column_tool import define_add_column_tool
from agents.data_agent.tools.append_field_value_tool import (
    define_append_field_value_tool,
)
from agents.data_agent.tools.create_records_tool import create_create_records_tool
from agents.data_agent.tools.delete_records_tool import define_delete_records_tool
from agents.data_agent.tools.fetch_additional_records_tool import (
    define_fetch_additional_records_tool,
)
from agents.data_agent.tools.fetch_records_by_ids_tool import (
    define_fetch_records_by_ids_tool,
)
from agents.data_agent.tools.insert_value_tool import define_insert_value_tool
from agents.data_agent.tools.remove_column_tool import define_remove_column_tool
from agents.data_agent.tools.search_and_replace_field_value_tool import (
    define_search_and_replace_field_value_tool,
)
from agents.data_agent.tools.set_field_value_tool import define_set_field_value_tool
from agents.data_agent.tools.update_records_tool import create_update_records_tool
from agents.data_agent.tools.upload_content_tool import define_upload_content_tool
from agents.data_agent.tools.url_content_load_tool import define_url_content_load_tool
from agents.data_agent.tools.view.set_filter_tool import define_set_filter_tool
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from server.capabilities import (
    DATA_CREATE,
    DATA_DELETE,
    DATA_FETCH_TOOLS,
    DATA_FIELD_TOOLS,
    DATA_UPDATE,
    OTHER_UPLOAD_CONTENT,
    OTHER_URL_CONTENT_LOAD,
    TABLE_ADD_COLUMN,
    TABLE_REMOVE_COLUMN,
    VIEWS_FILTERING,
    has_capability,
)


class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""

    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(
        default=100, description="The maximum number of records to retrieve"
    )


def get_data_tools(
    capabilities: Optional[List[str]] = None,
    style_guides: Dict[str, str] = None,
    data_scope: Optional[str] = None,
):
    tools = []

    if (capabilities is None or DATA_UPDATE in capabilities) and data_scope == "table":
        tools.append(create_update_records_tool(style_guides))
    if (capabilities is None or DATA_CREATE in capabilities) and data_scope == "table":
        tools.append(create_create_records_tool(style_guides))
    return tools


def configure_tools(
    agent: Agent[ChatRunContext, ResponseFromAgent],
    capabilities: Optional[List[str]] = None,
    data_scope: Optional[str] = None,
):
    """Configure the tools for the agent based on the capabilities"""

    if has_capability(DATA_FIELD_TOOLS, capabilities):
        define_append_field_value_tool(agent, data_scope)
        define_insert_value_tool(agent, data_scope)
        define_search_and_replace_field_value_tool(agent, data_scope)
        define_set_field_value_tool(agent, data_scope)

    if has_capability(DATA_DELETE, capabilities) and data_scope == "table":
        define_delete_records_tool(agent)

    if has_capability(VIEWS_FILTERING, capabilities):
        define_set_filter_tool(agent)

    if has_capability(TABLE_ADD_COLUMN, capabilities) and data_scope == "table":
        define_add_column_tool(agent)

    if has_capability(TABLE_REMOVE_COLUMN, capabilities) and data_scope == "table":
        define_remove_column_tool(agent)

    # Common tools / utilities
    if has_capability(OTHER_URL_CONTENT_LOAD, capabilities):
        # must be manually enabled
        define_url_content_load_tool(agent)

    if has_capability(OTHER_UPLOAD_CONTENT, capabilities):
        # must be manually enabled
        define_upload_content_tool(agent)

    if has_capability(DATA_FETCH_TOOLS, capabilities):
        # available by default
        define_fetch_additional_records_tool(agent)
        define_fetch_records_by_ids_tool(agent)
