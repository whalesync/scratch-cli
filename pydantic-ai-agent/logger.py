#!/usr/bin/env python3
"""
Centralized logging module for the chat server
"""

import os
from typing import Optional, Any

# Global logger instance
_logger: Optional[Any] = None
_logfire_available: bool = False


def initialize_logger() -> None:
    """Initialize the logger with Logfire if available"""
    global _logger, _logfire_available

    logfire_token = os.getenv("LOGFIRE_TOKEN")

    if logfire_token:
        try:
            import logfire as logfire_module

            logfire_module.configure(
                token=logfire_token,
                service_name="pydantic-ai-chat-server",
                scrubbing=False,  # Disable scrubbing to see full data including auth tokens
            )
            _logger = logfire_module
            _logfire_available = True

            # Enable Logfire's AI instrumentation for automatic LLM logging
            logfire_module.instrument_pydantic_ai()
            print("✅ Logfire configured successfully")
            print(
                "🔍 Logfire AI instrumentation enabled - will capture LLM interactions automatically"
            )
        except ImportError:
            print("⚠️ Logfire not installed. Install with: pip install logfire")
            _logfire_available = False
        except Exception as e:
            print(f"⚠️ Logfire configuration failed: {e}")
            _logfire_available = False
    else:
        print("⚠️ LOGFIRE_TOKEN not found in environment. Logging to console only.")
        _logfire_available = False


def log_event(message: str, level: str = "info", **attributes) -> None:
    """
    Log an event to Logfire if available, otherwise print to console

    Args:
        message: The log message
        level: Log level (debug, info, warning, error)
        **attributes: Additional attributes to log
    """
    if _logfire_available and _logger:
        # Logfire API: log(level, message, attributes=data)
        try:
            _logger.log(level, message, attributes=attributes)
        except Exception as e:
            # Fallback: just log the message without attributes
            try:
                _logger.log(level, message)
            except Exception:
                # Final fallback: just log the message
                _logger.log("info", message)
    else:
        # Console logging with level prefix
        level_upper = level.upper()
        attr_str = ""
        if attributes:
            attr_str = f" | {', '.join(f'{k}={v}' for k, v in attributes.items())}"
        print(f"[{level_upper}] {message}{attr_str}")


def log_debug(message: str, **attributes) -> None:
    """Log a debug message"""
    log_event(message, level="debug", **attributes)


def log_info(message: str, **attributes) -> None:
    """Log an info message"""
    log_event(message, level="info", **attributes)


def log_warning(message: str, **attributes) -> None:
    """Log a warning message"""
    log_event(message, level="warning", **attributes)


def log_error(message: str, **attributes) -> None:
    """Log an error message"""
    log_event(message, level="error", **attributes)


# Initialize logger on module import
initialize_logger()
