#!/usr/bin/env python3
"""
Custom exceptions for the agent server
"""

from server.token_utils import format_token_count


class TokenLimitExceededException(Exception):
    """
    Exception raised when the token limit is exceeded for a model.
    """

    def __init__(self, requested_tokens: int, max_tokens: int, is_prerun: bool):
        """
        Initialize the TokenLimitExceededException.

        Args:
            requested_tokens: The number of tokens requested
            max_tokens: The maximum number of tokens supported by the model
            is_prerun: True if this error occurred before calling the model (pre-run check),
                      False if it occurred during/after model execution
        """
        self.requested_tokens = requested_tokens
        self.max_tokens = max_tokens
        self.is_prerun = is_prerun

        # Format token counts using the same format as the client (122.5K, 1.3M, etc)
        formatted_requested = format_token_count(requested_tokens)
        formatted_max = format_token_count(max_tokens)

        # Generate message based on whether this is a pre-run check or not
        # Using markdown line breaks (double newline) for proper rendering in MarkdownRenderer
        if is_prerun:
            message = (
                f"The context is too large (~{formatted_requested} tokens).\n"
                f"This exceeds 50% of the model's {formatted_max} token capacity.\n"
                f"Try:\n"
                f"- Applying filters to reduce records\n"
                f"- Mentioning only specific tables you need\n"
                f"- Selecting a model with larger context"
            )
        else:
            message = (
                f"The context and data exceed the model's context window.]\n"
                f"Requested ~{formatted_requested} tokens but model supports {formatted_max} tokens.\n"
                f"Try:\n"
                f"- Applying filters to reduce records\n"
                f"- Selecting a model with larger context\n"
                f"- Reducing the amount of data in your request"
            )

        super().__init__(message)
