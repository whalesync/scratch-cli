from logging import getLogger
from typing import Dict, Optional

logger = getLogger(__name__)


def get_prompt_asset(
    prompt_assets: Optional[Dict[str, str]], key: str
) -> Optional[str]:
    """
    Extract a prompt asset from the dictionary by finding keys that start with the given key.

    Args:
        prompt_assets: Dictionary of prompt assets, or None
        key: The key prefix to search for

    Returns:
        The style guide content if found, None otherwise
    """
    if not prompt_assets:
        return None

    # Find keys that start with the given key
    matching_keys = [k for k in prompt_assets.keys() if k.startswith(key)]

    if matching_keys:
        # If multiple keys match, pick the first one
        selected_key = matching_keys[0]
        logger.info(f"🔍 Found style guide for '{key}' using key: '{selected_key}'")
        return prompt_assets[selected_key]

    # Return None if no matching keys found
    return None
