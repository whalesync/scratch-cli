from typing import Dict, Optional


def get_styleguide(style_guides: Optional[Dict[str, str]], key: str) -> Optional[str]:
    """
    Extract a style guide from the dictionary by finding keys that start with the given key.
    
    Args:
        style_guides: Dictionary of style guides, or None
        key: The key prefix to search for
        
    Returns:
        The style guide content if found, None otherwise
    """
    if not style_guides:
        return None
    
    # Find keys that start with the given key
    matching_keys = [k for k in style_guides.keys() if k.startswith(key)]
    
    if matching_keys:
        # If multiple keys match, pick the first one
        selected_key = matching_keys[0]
        print(f"🔍 Found style guide for '{key}' using key: '{selected_key}'")
        return style_guides[selected_key]
    
    # Return None if no matching keys found
    return None 