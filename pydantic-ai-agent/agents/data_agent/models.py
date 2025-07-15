#!/usr/bin/env python3
"""
Data models for the chat server
"""

from pydantic import BaseModel, Field
from datetime import datetime
from scratchpad_api import ScratchpadSnapshot
from typing import List, Optional
from session import ChatSession



class ResponseFromAgent(BaseModel):
    """Simple chat response model"""
    response_message: str = Field(description="The agent's response message - should be well-formatted, human-readable with careful and full explanations of what the model did or thinks")
    response_summary: str = Field(description="A concise summary of key actions, decisions, or context that would be useful for processing future prompts. Should be focused and contain anything the model finds useful for future reference, and does not need to be formated for human readability.")
    request_summary: str = Field(description="A concise summary of what the user requested, for future reference")


class ChatRunContext(BaseModel):
    session: ChatSession
    api_token: str
    snapshot: Optional[ScratchpadSnapshot] = Field(default=None, description="Associated snapshot")

