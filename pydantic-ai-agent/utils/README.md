# Utils Module

This module contains shared utilities for the Pydantic AI Agent system.

## Response Extractor

The `response_extractor.py` module provides a generic function for extracting responses from different types of agents.

### Usage

The `extract_response` function is generic and can work with any response type:

```python
from utils.response_extractor import extract_response
from agents.data_agent.models import ResponseFromAgent

# For data agents
response = extract_response(result, ResponseFromAgent)

# For chat agents (example)
from utils.response_extractor import ChatResponse
response = extract_response(result, ChatResponse)

# For any agent without type checking
response = extract_response(result)
```

### Features

- **Generic**: Works with any response type using Python's `TypeVar`
- **Flexible**: Tries multiple common response attributes (`output`, `response`, `data`)
- **Type-safe**: Optionally validates and casts to expected response types
- **Pydantic-aware**: Automatically handles Pydantic model validation
- **Fallback**: Returns the raw response if type validation fails

### Example Response Types

The module includes example response types for different agents:

- `ChatResponse`: For conversational agents
- `AnalysisResponse`: For analysis agents
- `DataResponse`: For data processing agents

### Benefits

1. **Reusability**: One function works for all agent types
2. **Type Safety**: Optional type checking prevents runtime errors
3. **Extensibility**: Easy to add new response types
4. **Consistency**: Standardized response extraction across agents
