"""
Pydantic models for the HelloWorldAgent
"""

from typing import List
from pydantic import BaseModel, Field


class GreetingResponse(BaseModel):
    """Response model for greeting interactions"""

    message: str = Field(description="A friendly greeting message")
    mood: str = Field(
        description="The agent's current mood (happy, excited, calm, etc.)"
    )
    suggestions: List[str] = Field(
        description="Suggestions for what the user could ask next"
    )


class MathResponse(BaseModel):
    """Response model for math calculations"""

    result: float = Field(description="The calculated result")
    operation: str = Field(description="The mathematical operation performed")
    explanation: str = Field(description="Brief explanation of the calculation")


class WeatherResponse(BaseModel):
    """Response model for weather information"""

    temperature: str = Field(description="Current temperature")
    condition: str = Field(description="Weather condition (sunny, rainy, etc.)")
    recommendation: str = Field(description="What to wear or do based on the weather")


class TaskResponse(BaseModel):
    """Response model for task management"""

    task_name: str = Field(description="Name of the task")
    status: str = Field(
        description="Status of the task (pending, in_progress, completed)"
    )
    priority: str = Field(description="Priority level (low, medium, high)")
    estimated_time: str = Field(description="Estimated time to complete")
