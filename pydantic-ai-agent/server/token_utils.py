#!/usr/bin/env python3
"""
Token estimation utilities for agent requests
"""

from typing import Optional


def format_token_count(tokens: int) -> str:
    """
    Format token count with K/M suffix
    Examples: 1234 -> "1.2K", 1234567 -> "1.2M"
    Matches the client's formatTokenCount function
    """
    if tokens < 1000:
        return str(tokens)
    elif tokens < 1000000:
        return f"{tokens / 1000:.1f}K"
    else:
        return f"{tokens / 1000000:.1f}M"


def estimate_tokens_from_content(content: str) -> int:
    """
    Estimate tokens using ~3 characters per token heuristic

    Args:
        content: The text content to estimate tokens for

    Returns:
        Estimated number of tokens
    """
    if not content:
        return 0
    return len(content) // 3


def estimate_tokens_from_request_parts(instructions: Optional[str], parts: list) -> int:
    """
    Estimate tokens from model request's instructions and parts

    Args:
        instructions: Optional instruction text from the model request
        parts: List of request parts (can contain content, text, or other attributes)

    Returns:
        Estimated total number of tokens
    """
    content_parts = []

    if instructions:
        content_parts.append(instructions)

    for part in parts:
        if hasattr(part, "content"):
            content_parts.append(str(part.content))
        elif hasattr(part, "text"):
            content_parts.append(str(part.text))
        else:
            content_parts.append(str(part))

    full_content = "\n".join(content_parts)
    return estimate_tokens_from_content(full_content)
