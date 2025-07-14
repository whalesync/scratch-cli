#!/usr/bin/env python3
"""
Generic response extractor utility for different agent types
"""

from typing import TypeVar, Optional, Any
from pydantic import BaseModel

# Generic type variable for response types
T = TypeVar('T')

def extract_response(result: Any, response_type: Optional[type[T]] = None) -> T | None:
    """
    Extract response from result object, trying different attributes.
    
    This is a generic function that can work with different response types
    for different agents. It tries to extract the response from common
    attributes and optionally validates/casts to the expected type.
    
    Args:
        result: The result object from the agent
        response_type: Optional type hint for the expected response type
        
    Returns:
        The extracted response of type T, or None if not found
        
    Examples:
        # For data agent with ResponseFromAgent
        response = extract_response(result, ResponseFromAgent)
        
        # For chat agent with ChatResponse
        response = extract_response(result, ChatResponse)
        
        # For any agent without type checking
        response = extract_response(result)
    """
    # Try different possible response attributes
    for attr in ['output', 'response', 'data']:
        if hasattr(result, attr):
            response = getattr(result, attr)
            if response:
                # If a specific type was provided, try to cast/validate
                if response_type and not isinstance(response, response_type):
                    # Try to construct the response type if it's a Pydantic model
                    if hasattr(response_type, 'model_validate'):
                        try:
                            return response_type.model_validate(response)  # type: ignore
                        except:
                            pass
                    # If that fails, just return the response as-is
                    return response  # type: ignore
                return response  # type: ignore
    return None


# Example response types for different agents
class ChatResponse(BaseModel):
    """Example response type for a chat agent"""
    message: str
    confidence: float
    metadata: dict


class AnalysisResponse(BaseModel):
    """Example response type for an analysis agent"""
    analysis: str
    insights: list[str]
    recommendations: list[str]


class DataResponse(BaseModel):
    """Example response type for a data processing agent"""
    processed_data: dict
    statistics: dict
    summary: str


def extract_chat_response(result: Any) -> ChatResponse | None:
    """Extract a chat response specifically"""
    return extract_response(result, ChatResponse)


def extract_analysis_response(result: Any) -> AnalysisResponse | None:
    """Extract an analysis response specifically"""
    return extract_response(result, AnalysisResponse)


def extract_data_response(result: Any) -> DataResponse | None:
    """Extract a data response specifically"""
    return extract_response(result, DataResponse) 