from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Scratch"
    app_env: str = "development"
    model_name: str = "openai/gpt-4o-mini"
    logfire_token: Optional[str] = None
    logfire_environment: Optional[str] = None
    logfire_enable_full_instrumentation: bool = False
    scratchpad_server_url: str = "http://localhost:3010"
    scratchpad_agent_auth_token: str = ""
    scratchpad_agent_jwt_secret: str = ""
    debug: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def get_cors_origins(self) -> List[str]:
        return ["*"]
        # if self.app_env == "development" or self.app_env == "local":
        #     return ["*"]
        # else:
        #     return [
        #         "*.scratchpaper.ai",
        #         "*.scratch.md",
        #         "scratchpad-client.vercel.app",
        #     ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
