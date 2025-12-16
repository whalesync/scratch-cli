#!/usr/bin/env python3
"""
History processor for the Data Agent
"""

import json
from logging import getLogger
from typing import List

from pydantic_ai.messages import ModelMessage, ModelRequest, ToolReturnPart

logger = getLogger(__name__)


def _is_data_fetch_tool(part: ToolReturnPart) -> bool:
    """Check if a tool return part is from a data-fetching tool."""
    # Check tool name patterns
    data_fetch_tool_names = [
        "fetch_additional_records_tool",
        "fetch_records_by_ids_tool",
    ]
    if part.tool_name in data_fetch_tool_names:
        return True

    # Check metadata for is_data_fetch flag
    if hasattr(part, "metadata") and isinstance(part.metadata, dict):
        return part.metadata.get("is_data_fetch", False)

    return False


def _cleanup_data_fetch_response(content: str) -> str:
    """
    Clean up data-fetch tool response by replacing the 'data' field.

    Args:
        content: The tool response content (should be JSON string)

    Returns:
        Cleaned up content with data field replaced
    """
    try:
        # Try to parse as JSON
        parsed = json.loads(content)

        # Check if it's a dict with a 'data' field
        if isinstance(parsed, dict) and "data" in parsed:
            # Replace the data field
            parsed["data"] = "[Actual records deleted to reduce context size]"
            return json.dumps(parsed, indent=2)

    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(
            f"Failed to parse data-fetch tool response as JSON: {e}. Returning original content truncated."
        )
        # Fallback: just truncate
        return f"[Data fetch tool response could not be parsed. Original length: {len(content)} chars]"

    # If we couldn't clean it up, return as-is
    return content


def data_agent_history_processor(messages: List[ModelMessage]) -> List[ModelMessage]:
    """
    History processor that intelligently truncates tool outputs.

    For data-fetching tools (fetch_additional_records_tool, fetch_records_by_ids_tool):
    - Parses JSON response and replaces the 'data' field with a placeholder
    - Preserves all metadata (cursor, counts, IDs, summary, etc.)

    For other tools:
    - Applies standard 1000-character truncation

    IMPORTANT: Skips the last ModelRequest to preserve tool results from the current turn.
    The LLM needs to see the full data from tools it just called.
    """
    new_messages = []

    # Find the index of the last ModelRequest to skip cleaning it
    last_model_request_idx = None
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], ModelRequest):
            last_model_request_idx = i
            break

    for idx, msg in enumerate(messages):
        logger.info(f"Processing message type: {type(msg)}")
        if isinstance(msg, ModelRequest):
            # Skip cleaning the last ModelRequest - it contains current turn's tool results
            if idx == last_model_request_idx:
                logger.info(
                    f"Skipping cleanup for last ModelRequest (current turn) at index {idx}"
                )
                new_messages.append(msg)
                continue

            # Process ModelRequest messages - check parts for long tool outputs
            new_parts = []
            for part in msg.parts:
                # Check if the part is a tool return and if its content is too long
                if isinstance(part, ToolReturnPart) and len(str(part.content)) > 1000:
                    # Special handling for data-fetch tools
                    if _is_data_fetch_tool(part):
                        logger.info(
                            f"Applying smart cleanup for data-fetch tool '{part.tool_name}' (length: {len(str(part.content))})"
                        )
                        cleaned_content = _cleanup_data_fetch_response(
                            str(part.content)
                        )
                        new_parts.append(
                            ToolReturnPart(
                                tool_name=part.tool_name,
                                content=cleaned_content,
                                tool_call_id=part.tool_call_id,
                            )
                        )
                    else:
                        # Standard truncation for non-data-fetch tools
                        logger.info(
                            f"Truncating long tool output from '{part.tool_name}' (length: {len(str(part.content))})"
                        )
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
                ModelRequest(parts=new_parts, instructions=msg.instructions)
            )
        else:
            # Keep non-ModelResponse messages (like ModelRequest) as they are
            new_messages.append(msg)

    logger.info(
        f"Processed {len(messages)} messages, returning {len(new_messages)} messages"
    )
    return new_messages
