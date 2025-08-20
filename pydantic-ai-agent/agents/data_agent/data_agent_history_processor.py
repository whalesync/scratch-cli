#!/usr/bin/env python3
"""
History processor for the Data Agent
"""

from typing import List
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolReturnPart
from logging import getLogger

logger = getLogger(__name__)


def data_agent_history_processor(messages: List[ModelMessage]) -> List[ModelMessage]:
    """
    A simple history processor to replace the content of tool outputs
    that are longer than 1000 characters with a placeholder message.
    """
    new_messages = []
    for msg in messages:
        logger.info(f"Processing message type: {type(msg)}")
        if isinstance(msg, ModelResponse):
            # Process ModelResponse messages - check parts for long tool outputs
            new_parts = []
            for part in msg.parts:
                # Check if the part is a tool return and if its content is too long
                if isinstance(part, ToolReturnPart) and len(str(part.content)) > 1000:
                    logger.info(
                        f"Truncating long tool output from '{part.tool_name}' (length: {len(str(part.content))})"
                    )
                    # Replace the long content with a placeholder
                    new_parts.append(
                        ToolReturnPart(
                            tool_name=part.tool_name,
                            content=f"[Content from tool '{part.tool_name}' was pruned for brevity. Original length: {len(str(part.content))} chars]",
                            tool_call_id=part.tool_call_id,
                        )
                    )
                else:
                    # Keep the part as is
                    new_parts.append(part)
            # Reconstruct the ModelResponse with the potentially modified parts
            new_messages.append(
                ModelResponse(parts=new_parts, model_name=msg.model_name)
            )
        else:
            # Keep non-ModelResponse messages (like ModelRequest) as they are
            new_messages.append(msg)

    logger.info(
        f"Processed {len(messages)} messages, returning {len(new_messages)} messages"
    )
    return new_messages
