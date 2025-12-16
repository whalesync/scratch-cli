from logging import getLogger
import jwt
from typing import List, Optional
from pydantic import BaseModel
from fastapi import HTTPException, Header
from config import get_settings

logger = getLogger(__name__)

settings = get_settings()


class AgentUser(BaseModel):
    userId: str
    role: str
    # List of allowed model IDs. Empty list means all models are allowed (paid plans).
    # Non-empty list means only those specific models are allowed (free plan).
    availableModels: List[str] = []

    def is_model_allowed(self, model_id: str) -> bool:
        """
        Check if a specific model is allowed for this user's subscription.
        Empty availableModels list means all models are allowed.
        """
        if not self.availableModels:
            return True  # Empty = all models allowed (paid plans)
        return model_id in self.availableModels


def decode_and_validate_agent_jwt(jwt_token: str) -> Optional[AgentUser]:
    """
    Decode and validate a JWT token using the SCRATCHPAD_AGENT_JWT_SECRET environment variable.

    Args:
        jwt_token: The JWT token string to decode and validate

    Returns:
        A dictionary containing the decoded JWT payload if valid, None if invalid or missing secret

    Raises:
        jwt.InvalidTokenError: If the token is invalid, expired, or malformed
        jwt.DecodeError: If the token cannot be decoded
    """
    secret = settings.scratchpad_agent_jwt_secret
    if not secret:
        return None

    try:
        # Decode and validate the JWT token
        payload = jwt.decode(
            jwt_token,
            secret,
            algorithms=["HS256"],
            options={"verify_signature": True, "verify_exp": True},
        )
        return AgentUser(**payload)
    except jwt.ExpiredSignatureError as e:
        # Token has expired
        logger.warning(f"Agent JWT token expired: {jwt_token} {e}")
        return None
    except jwt.InvalidTokenError as e:
        # Token is invalid for any other reason
        logger.exception(f"Invalid Agent JWT token: {e}")
        return None
    except Exception as e:
        # Any other unexpected error
        logger.exception(f"Unexpected error decoding Agent JWT token: {e}")
        return None


async def get_current_user(authorization: str = Header(None)) -> AgentUser:
    """
    Dependency function to validate JWT token from Authorization header
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is required")

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization header must start with 'Bearer '"
        )

    token = authorization[7:]  # Remove "Bearer " prefix
    payload = decode_and_validate_agent_jwt(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired JWT token")

    return payload
