#!/usr/bin/env python3
"""
PydanticAI Tools for the Chat Server
"""
from agents.data_agent.models import ChatRunContext, ResponseFromAgent
from typing import Optional, Dict, List
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from agents.data_agent.tools.update_records_tool import create_update_records_tool
from agents.data_agent.tools.append_field_value_tool import define_append_field_value_tool
from agents.data_agent.tools.insert_value_tool import define_insert_value_tool
from agents.data_agent.tools.search_and_replace_field_value_tool import define_search_and_replace_field_value_tool
from agents.data_agent.tools.delete_records_tool import define_delete_records_tool
from agents.data_agent.tools.create_records_tool import create_create_records_tool

class GetRecordsInput(BaseModel):
    """Input for the get_records tool"""
    table_id: str = Field(description="The ID of the table to get records for")
    limit: Optional[int] = Field(default=100, description="The maximum number of records to retrieve")

# TODO: Use table id

def get_data_tools(capabilities: Optional[List[str]] = None, style_guides: Dict[str, str] = None):
    tools = []
    if capabilities is None or 'data:update' in capabilities:
        tools.append(create_update_records_tool(style_guides));
    if capabilities is None or 'data:create' in capabilities:
        tools.append(create_create_records_tool(style_guides));
    return tools;


def define_data_tools(agent: Agent[ChatRunContext, ResponseFromAgent], capabilities: Optional[List[str]] = None):
    if capabilities is None or 'data:field-tools' in capabilities:
        define_append_field_value_tool(agent)
        define_insert_value_tool(agent)
        define_search_and_replace_field_value_tool(agent)
    
    if capabilities is None or 'data:delete' in capabilities:
        define_delete_records_tool(agent)

