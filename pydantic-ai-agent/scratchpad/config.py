import os
from typing import Dict
from logging import getLogger


logger = getLogger(__name__)


class ScratchpadApiConfig:
    """Configuration for Scratch API calls"""

    def __init__(self):
        self.api_url = os.getenv("SCRATCHPAD_SERVER_URL", "http://localhost:3010")
        self.agent_auth_token = os.getenv("SCRATCHPAD_AGENT_AUTH_TOKEN")

    def get_api_url(self) -> str:
        return self.api_url

    def get_api_headers(self, user_id: str) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "scratchpad-pydantic-ai-agent",
            "Authorization": f"Agent-Token {self.agent_auth_token}:{user_id}",
        }
        return headers

    def get_api_server_health_url(self) -> str:
        return f"{self.api_url}/health"


# Global config instance
API_CONFIG = ScratchpadApiConfig()
