#!/usr/bin/env python3
"""
Centralized logging module for the chat server
"""

import os
from typing import Optional, Any
from logging import (
    basicConfig,
    INFO,
    DEBUG,
    StreamHandler,
    Formatter,
    getLogger,
    WARNING,
    Filter,
)
from pydantic_ai.agent import Agent
from pydantic_ai.models.instrumented import InstrumentationSettings


class AccessLogExclustionFilter(Filter):
    """Filter to exclude health endpoint logs from uvicorn.access"""

    def filter(self, record):
        # Check if the log message contains /health path
        if hasattr(record, "getMessage"):
            message = record.getMessage()
            return "/health" not in message
        return True


# Global logger instance
_logger: Optional[Any] = None
_logfire_available: bool = False


def initialize_logging() -> None:
    """Initialize the logger with Logfire if available"""
    global _logger, _logfire_available

    # Set up global logging to the console
    stream_handler = StreamHandler()
    stream_handler.setFormatter(Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    basicConfig(level=INFO, handlers=[stream_handler])

    access_logger = getLogger("uvicorn.access")
    # Add filter to exclude health endpoint logs
    access_logger.addFilter(AccessLogExclustionFilter())

    logfire_token = os.getenv("LOGFIRE_TOKEN")
    enabled_full_instrumentation = (
        os.getenv("LOGFIRE_ENABLE_FULL_INSTRUMENTATION", "false").lower() == "true"
    )

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

            if enabled_full_instrumentation:
                instrumentation_settings = InstrumentationSettings(
                    include_content=True,
                    include_binary_content=False,
                )
            else:
                instrumentation_settings = InstrumentationSettings(
                    include_content=False,
                    include_binary_content=False,
                )

            Agent.instrument_all(instrumentation_settings)

            print(
                "✅ Logfire configured successfully with full instrumentation"
                if enabled_full_instrumentation
                else "✅ Logfire configured successfully with scrubbed instrumentation"
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
    Log an event to Logfire if available and it is info or higher, otherwise print to console

    Args:
        message: The log message
        level: Log level (debug, info, warning, error)
        **attributes: Additional attributes to log
    """
    if _logfire_available and _logger and level != "debug":
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
initialize_logging()
