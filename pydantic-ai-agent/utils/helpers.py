from typing import Any, Callable, List


def find_first_matching(
    data_list: List[Any], condition_function: Callable[[Any], bool]
) -> Any | None:
    """
    Finds the first element in a list that satisfies a given condition.

    Args:
    data_list: The list to search within.
    condition_function: A function that takes an element from the list
                        and returns True if the element matches the condition,
                        False otherwise.

    Returns:
    The first matching element, or None if no element satisfies the condition.
    """
    return next((item for item in data_list if condition_function(item)), None)


def mask_string(
    text: str, mask_length: int = 5, fill_char: str = "*", fill_length: int = 20
) -> str:
    """
    Masks a string by preserving the first 5 characters and replacing the rest with asterisks.

    Args:
        text: The input string to mask.

    Returns:
        A string with the first 5 characters preserved and the rest replaced with '*'.
        If the input string is 5 characters or shorter, it returns the original string unchanged.
    """
    if len(text) <= mask_length:
        return text.rjust(fill_length, fill_char)

    return (text[:mask_length] + fill_char * (len(text) - mask_length)).rjust(
        fill_length, fill_char
    )
