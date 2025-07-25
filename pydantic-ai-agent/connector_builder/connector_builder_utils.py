#!/usr/bin/env python3
"""
Utility functions for the Connector Builder Agent
"""

import os
import requests
from typing import Dict, Any, Optional


def get_scratchpad_api_url() -> str:
    """Get the Scratchpad API URL from environment or use default"""
    return os.getenv("SCRATCHPAD_API_URL", "http://localhost:3010")


def call_scratchpad_api(method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, api_token: Optional[str] = None) -> Any:
    """
    Make a call to the Scratchpad API
    
    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint path (e.g., "/custom-connectors/123")
        data: Request data for POST/PUT requests
        api_token: API token for authentication (required)
        
    Returns:
        The API response data
    """
    api_url = get_scratchpad_api_url()
    
    if not api_token:
        raise ValueError("API token is required for Scratchpad API calls")
    
    url = f"{api_url}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        'User-Agent': 'scratchpad-pydantic-ai-agent'
    }
    
    if api_token:
        headers["Authorization"] = f"API-Token {api_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return response.json()
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"API call failed: {str(e)}")


def load_custom_connector(connector_id: str, api_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Load a custom connector from the Scratchpad API
    
    Args:
        connector_id: The ID of the custom connector to load
        api_token: API token for authentication (required)
        
    Returns:
        The custom connector data
    """
    if not api_token:
        raise ValueError("API token is required to load custom connector")
    
    return call_scratchpad_api("GET", f"/custom-connectors/{connector_id}", api_token=api_token) 