from logging import getLogger
from typing import Dict, Any, List, Optional
from agents.data_agent.models import SnapshotForAi, FocusedCell
from agents.data_agent.data_agent_utils import format_records_for_prompt

logger = getLogger(__name__)


def build_snapshot_context(
    snapshot: SnapshotForAi,
    preloaded_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    filtered_counts: Optional[Dict[str, int]] = None,
    data_scope: Optional[str] = "table",
    active_table_id: Optional[str] = None,
    record_id: Optional[str] = None,
    column_id: Optional[str] = None,
    max_records_to_include: Optional[int] = 50,
) -> str:
    """
    Build snapshot context string for inclusion in prompts.

    Args:
        snapshot: The snapshot data
        preloaded_records: Dictionary mapping table names to their records
        filtered_counts: Dictionary mapping table names to their filtered record counts

    Returns:
        Formatted snapshot context string
    """
    if not snapshot:
        return ""

    snapshot_context = f"\n\n-- CURRENT SNAPSHOT DATA PREVIEW START --\n"
    snapshot_context += f"Snapshot: {snapshot.name or snapshot.id}\n"
    # snapshot_context += f"Tables: {len(snapshot.tables)}\n\n"

    truncate_record_content = data_scope == "table"

    for table in snapshot.tables:
        # Determine if this is the active table
        is_active_table = (not active_table_id) or (active_table_id == table.id.wsId)

        columns_to_exclude = []
        if data_scope == "column" and is_active_table:
            # remove all but the column we are interested in
            columns_to_exclude = [
                col.id.wsId for col in table.columns if col.id.wsId != column_id
            ]

        table_context = None
        for table_context in snapshot.tableContexts:
            if table_context.id.wsId == table.id.wsId:
                break

        if table_context:
            columns_to_exclude.extend(table_context.ignoredColumns)

        table_view = snapshot.tableViews.get(table.id.wsId)
        if table_view:
            for column_id, column_config in table_view.columns.items():
                if column_config.hidden:
                    columns_to_exclude.append(column_id)

        # Mark active table in the output
        table_marker = " [ACTIVE TABLE]" if is_active_table else ""
        snapshot_context += (
            f"\nTABLE: {table.name} (ID: {table.id.wsId}){table_marker}\n"
        )
        snapshot_context += "COLUMNS:\n"

        for col in table.columns:
            if columns_to_exclude and col.id.wsId in columns_to_exclude:
                continue

            readonly = False
            if table_view and col.id.wsId in table_view.columns:
                column_config = table_view.columns.get(col.id.wsId)
                if column_config and column_config.protected:
                    readonly = True
            readonly_marker = " (Read Only)" if readonly else ""
            snapshot_context += f"  - Name: {col.name}, ID: {col.id.wsId}, Type: {col.type}{readonly_marker}, Metadata: {col.metadata or {}}, Required: {col.required}\n"

        # Add records if available
        if preloaded_records and table.name in preloaded_records:
            records = preloaded_records[table.name]

            snapshot_context += f"NOTES:\n"

            # Different messaging for active table vs non-active table (sample record)
            if is_active_table:
                snapshot_context += f" - {len(records)} records are currently loaded\n"

                if truncate_record_content:
                    snapshot_context += (
                        f" - Large field values are truncated to 200 characters\n"
                    )

                # Add filtered records information if available
                if filtered_counts and table.name in filtered_counts:
                    filtered_count = filtered_counts[table.name]
                    if filtered_count > 0:
                        snapshot_context += f" - {filtered_count} records are currently filtered out and not included in this list.\n"

                # Add max records information if necessary
                if max_records_to_include and len(records) > max_records_to_include:
                    snapshot_context += f" - Only the first {max_records_to_include} records in included in this list.\n"
            else:
                # This is a sample record from a non-active table
                snapshot_context += f" - This is a sample record from this table (not the active table)\n"
                snapshot_context += f" - Only 1 sample record is shown to provide context about this table's structure and data\n"

            snapshot_context += "\n"

            # Format records using the shared function
            records_summary = format_records_for_prompt(
                records,
                limit=max_records_to_include if is_active_table else 1,
                truncate_record_content=truncate_record_content,
                columns_to_exclude=columns_to_exclude,
            )

            snapshot_context += f"RECORDS:\n{records_summary}\n"
        else:
            snapshot_context += "Records: Not loaded\n"
        snapshot_context += "\n"

    snapshot_context += f"\n-- CURRENT SNAPSHOT DATA PREVIEW END --\n"

    logger.debug(f"Snapshot context: {snapshot_context}")

    return snapshot_context


def build_focus_context(
    read_focus: Optional[List[FocusedCell]] = None,
    write_focus: Optional[List[FocusedCell]] = None,
) -> str:
    """
    Build focus context string for inclusion in prompts.

    Args:
        read_focus: List of cells that should be read-focused
        write_focus: List of cells that should be write-focused

    Returns:
        Formatted focus context string, or empty string if no focus cells
    """
    if not read_focus and not write_focus:
        return ""

    focus_context = "\n\nFOCUS CELLS:\n"

    if read_focus:
        focus_context += "Read Focus Cells:\n"
        for cell in read_focus:
            focus_context += (
                f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
            )
        focus_context += "\n"

    if write_focus:
        focus_context += "Write Focus Cells:\n"
        for cell in write_focus:
            focus_context += (
                f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
            )
        focus_context += "\n"

    return focus_context
