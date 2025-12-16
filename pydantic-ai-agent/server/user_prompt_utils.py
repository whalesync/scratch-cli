from logging import getLogger
from typing import Any, Dict, List, Optional

from agents.data_agent.data_agent_utils import (
    ColumnSpecForAi,
    format_records_for_prompt,
)
from agents.data_agent.models import WorkbookForAi

logger = getLogger(__name__)

POSTGRES_TO_AGENT_DATA_TYPE_MAP: Dict[str, str] = {
    "text": "text",
    "number": "number",
    "boolean": "boolean",
    "json": "json",
    "jsonb": "json",
    "timestamp": "timestamp",
    "text[]": "text array",
    "numeric[]": "number array",
    "boolean[]": "boolean array",
}

# Dictionary mapping keywords to short descriptions for LLM prompts
KEYWORD_DESCRIPTIONS: Dict[str, str] = {
    "required": "This column must have a value when creating a new record or updating an existing record",
    "readonly": "You cannot edit or set values in this field",
    "scratch column": "A temporary column that can be used for calculations or intermediate data",
    "limited options": "This column only accepts values from the predefined list of options",
    "unrestricted options": "This column accepts any value, in addition to the predefined options",
    "html": "Text value contains properly formatted HTML",
    "rich_text": "Text value contains rich text",
    "markdown": "Text value contains Markdown",
    "email": "Email address format",
    "url": "Text value is a URL",
    "phone": "Text value is a phone number",
}


def gather_unique_column_keywords(column: ColumnSpecForAi, keywords: List[str]) -> None:
    """
    Extract keywords from column metadata for use in the prompt
    """

    if column.required and "required" not in keywords:
        keywords.append("required")

    if column.readonly and "readonly" not in keywords:
        keywords.append("readonly")

    if column.metadata:
        if (
            "scratch" in column.metadata
            and column.metadata["scratch"]
            and "scratch column" not in keywords
        ):
            keywords.append("scratch column")

        if (
            "textFormat" in column.metadata
            and column.metadata["textFormat"] not in keywords
        ):
            keywords.append(column.metadata["textFormat"])

        if (
            "dateFormat" in column.metadata
            and column.metadata["dateFormat"] not in keywords
        ):
            keywords.append(column.metadata["dateFormat"])

        if (
            "numberFormat" in column.metadata
            and column.metadata["numberFormat"] not in keywords
        ):
            keywords.append(column.metadata["numberFormat"])

        allowAny = (
            "allowAnyOption" in column.metadata and column.metadata["allowAnyOption"]
        )

        if "options" in column.metadata and column.metadata["options"]:
            if allowAny:
                keywords.append("unrestricted options")
            else:
                keywords.append("limited options")


def build_column_context(
    column: ColumnSpecForAi,
) -> str:
    """
    Build column context string for inclusion in prompts.
    """

    data_type = POSTGRES_TO_AGENT_DATA_TYPE_MAP.get(column.type, column.type)

    context = f" - Name: {column.name}, ID: {column.id.wsId}, Data type: {data_type}"

    attributes = []

    if column.required:
        attributes.append("required")

    if column.readonly:
        attributes.append("readonly")

    if column.metadata:
        if "scratch" in column.metadata and column.metadata["scratch"]:
            attributes.append("scratch column")

        if "textFormat" in column.metadata:
            attributes.append(column.metadata["textFormat"])

        if "dateFormat" in column.metadata:
            attributes.append(column.metadata["dateFormat"])

        if "numberFormat" in column.metadata:
            attributes.append(column.metadata["numberFormat"])

        if "options" in column.metadata and column.metadata["options"]:
            allowAny = (
                "allowAnyOption" in column.metadata
                and column.metadata["allowAnyOption"]
            )

            attributeName = "unrestricted options" if allowAny else "limited options"

            options_list = [
                f'"{option["value"]}"' for option in column.metadata["options"]
            ]
            attributes.append(f"{attributeName}: [{', '.join(options_list)}]")

    if attributes:
        context += f", Attributes: {', '.join(attributes)}"

    return context


def build_workbook_context(
    workbook: WorkbookForAi,
    preloaded_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    filtered_counts: Optional[Dict[str, int]] = None,
    data_scope: Optional[str] = "table",
    active_table_id: Optional[str] = None,
    record_id: Optional[str] = None,
    column_id: Optional[str] = None,
    max_records_to_include: Optional[int] = 50,
    mentioned_table_ids: Optional[List[str]] = None,
) -> str:
    """
    Build workbook context string for inclusion in prompts.

    Args:
        workbook: The workbook data
        preloaded_records: Dictionary mapping table names to their records
        filtered_counts: Dictionary mapping table names to their filtered record counts

    Returns:
        Formatted workbook context string
    """
    if not workbook:
        return ""

    workbook_context = f"\n\n-- CURRENT WORKBOOK DATA PREVIEW START --\n"
    workbook_context += f"Workbook: {workbook.name or workbook.id}\n"
    # workbook_context += f"Tables: {len(workbook.tables)}\n\n"

    # truncate_record_content = data_scope == "table"
    truncate_record_content = False

    data_keywords = []

    for table in workbook.tables:
        # Determine if this is the active table
        is_active_table = (not active_table_id) or (active_table_id == table.id)

        # Determine if this table is mentioned in the user message
        is_mentioned_table = mentioned_table_ids and table.id in mentioned_table_ids

        # Include full records for active or mentioned tables
        include_records = is_active_table or is_mentioned_table

        columns_to_exclude = []
        if data_scope == "column" and is_active_table:
            # remove all but the column we are interested in
            columns_to_exclude = [
                col.id.wsId for col in table.columns if col.id.wsId != column_id
            ]

        # Mark active table in the output
        table_marker = " [ACTIVE TABLE]" if is_active_table else ""
        workbook_context += f"\nTABLE: {table.name} (ID: {table.id}){table_marker}\n"
        workbook_context += "COLUMNS:\n"

        for col in table.columns:
            if columns_to_exclude and col.id.wsId in columns_to_exclude:
                continue
            workbook_context += build_column_context(col) + "\n"
            gather_unique_column_keywords(col, data_keywords)

        # Add records if available
        if preloaded_records and table.name in preloaded_records and include_records:
            records = preloaded_records[table.name]

            workbook_context += f"NOTES:\n"

            # Explain why records are visible
            if is_active_table and is_mentioned_table:
                workbook_context += f" - Records for this table are visible since this table is both active and mentioned in the user prompt\n"
            elif is_active_table:
                workbook_context += f" - Records for this table are visible since this table is active\n"
            elif is_mentioned_table:
                workbook_context += f" - Records for this table are visible since this table was mentioned in the user prompt\n"

            workbook_context += f" - {len(records)} records are currently loaded\n"

            # Add filtered records information if available
            if filtered_counts and table.name in filtered_counts:
                filtered_count = filtered_counts[table.name]
                if filtered_count > 0:
                    workbook_context += f" - {filtered_count} records are currently filtered out and not included in this list.\n"

            workbook_context += "\n"

            # Format records using the shared function
            records_summary = format_records_for_prompt(
                records,
                # limit=max_records_to_include if is_active_table else 1,
                limit=100000,
                truncate_record_content=truncate_record_content,
                columns_to_exclude=columns_to_exclude,
            )

            workbook_context += f"RECORDS:\n{records_summary}\n"
        else:
            # Schema only - explain why records are not visible
            workbook_context += f"NOTES:\n"
            workbook_context += f" - No records for this table are listed since it is neither the active table nor mentioned in the user prompt\n"
            workbook_context += f" - Only the schema is shown to provide context about this table's structure\n\n"
        workbook_context += "\n"

    if data_keywords:
        workbook_context += f"COLUMN ATTRIBUTE DEFINITIONS:\n"
        workbook_context += "The following attributes are part of the column definitions and are used to help you understand the data and the user's request.\n"

        for keyword in data_keywords:
            if keyword in KEYWORD_DESCRIPTIONS:
                workbook_context += f" - {keyword}:  {KEYWORD_DESCRIPTIONS[keyword]}\n"

    workbook_context += f"\n-- CURRENT WORKBOOK DATA PREVIEW END --\n"

    logger.debug(f"Workbook context: {workbook_context}")

    return workbook_context
