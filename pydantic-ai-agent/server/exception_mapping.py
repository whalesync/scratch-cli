from fastapi import HTTPException
from pydantic_ai.exceptions import ModelHTTPError
from logger import log_warning

def exception_mapping(error: Exception) -> HTTPException:
    """
    Map different types of errors to appropriate HTTP status codes and messages.
    There are 3 cases:
    - ModelHTTPError: These are thrown by the model provider and should be mapped to a user friendly error.
    - HTTPException: These are thrown by us and are assumed to already be well structured.
    - Other errors: These are wrapped in a 500 error.
    """

    
    if(isinstance(error, ModelHTTPError)):
        if(error.status_code == 403 and "Key limit exceeded" in str(error)):
            # 403 = I know who you are, but you’re not allowed to see this.
            # Happens when:
            # - a KEY (not the full acount) has run out of credits (empirically discovered).
            #   In that case error msg will be: "Key limit exceeded. Manage it using https://openrouter.ai/settings/keys"
            # - when the model is moderated and the input is rejected (claimed by the documentation, not seen in practice)
            return HTTPException(status_code=error.status_code, detail="Openrouter ey limit exceeded. Manage it using https://openrouter.ai/settings/keys")
        elif(error.status_code == 401 and "Connection error." in str(error)):
             # This one I haven't seen in practice.
             return HTTPException(status_code=error.status_code, detail="Openrouter connection error. Please retry in a moment and contact support if the problem persists.")
        elif(error.status_code == 401 and "No auth credentials found" in str(error)):
            # Happens when an invalid API key is provided.
            return HTTPException(status_code=error.status_code, detail="Missing or invalid Openrouter API key. Create a new key at https://openrouter.ai/settings/keys and add it to https://scratchpaper.ai/settings")
        elif(error.status_code == 401 and "User not found" in str(error)):
            # Happens when the api key is disabled. Leaving the User not fouond part to catch whatever other usecases they use this error for.
            return HTTPException(status_code=error.status_code, detail="Openrouter user not found or API key disabled. Check: https://openrouter.ai/settings/keys")
        else: 
            # Lets try to handle all external errors and map the message to a user friendly one.
            # Errors that we don't yet map will be logged and returned as is.
            log_warning(
                "Unknown ModelHTTPError",
                status_code=error.status_code,
                body=error.body,
            )
            # Handle missing body or message gracefully
            detail = None
            if hasattr(error, "body") and error.body:
                if isinstance(error.body, dict):
                    detail = error.body.get("message") or str(error.body)
                else:
                    detail = str(error.body)
            if not detail:
                detail = "An unknown error occurred with the model provider."
            return HTTPException(
                status_code=error.status_code, detail=detail
            )
    elif(isinstance(error, HTTPException)):
        # These are thrown by us and are assumed to already be well structured.
        return error
    else:
        # Wrap other wrrors in 500
        log_warning(
            f"Unknown error processing message: {str(error)}",
        )
        return HTTPException(
            status_code=500, detail=f"Unknown error processing message: {str(error)}"
        )
    
