from logging import getLogger
from typing import Dict, Any, List, Optional
from agents.data_agent.models import WorkbookForAi
from agents.data_agent.data_agent_utils import format_records_for_prompt

logger = getLogger(__name__)


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
            workbook_context += f"  - Name: {col.name}, ID: {col.id.wsId}, Type: {col.type}, Metadata: {col.metadata or {}}, Required: {col.required}\n"

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

    workbook_context += f"\n-- CURRENT WORKBOOK DATA PREVIEW END --\n"

    logger.debug(f"Workbook context: {workbook_context}")

    return workbook_context
