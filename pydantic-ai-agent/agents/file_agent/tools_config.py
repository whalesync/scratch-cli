#!/usr/bin/env python3
"""
Tool configuration for the file agent
"""
from logging import getLogger

from agents.file_agent.models import FileAgentResponse, FileAgentRunContext
from agents.file_agent.tools.cat_tool import define_cat_tool
from agents.file_agent.tools.find_tool import define_find_tool
from agents.file_agent.tools.grep_tool import define_grep_tool
from agents.file_agent.tools.ls_tool import define_ls_tool
from agents.file_agent.tools.rm_tool import define_rm_tool
from agents.file_agent.tools.write_tool import define_write_tool
from pydantic_ai import Agent

logger = getLogger(__name__)


def configure_tools(agent: Agent[FileAgentRunContext, FileAgentResponse]):
    """Configure all tools for the file agent"""

    logger.info("Configuring file agent tools")

    # Read-only tools
    define_ls_tool(agent, FileAgentRunContext)
    define_cat_tool(agent, FileAgentRunContext)
    define_find_tool(agent, FileAgentRunContext)
    define_grep_tool(agent, FileAgentRunContext)

    # Write tools
    define_write_tool(agent, FileAgentRunContext)
    define_rm_tool(agent, FileAgentRunContext)

    logger.info("File agent tools configured successfully")
