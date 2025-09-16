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

    snapshot_context = f"\n\n-- CURRENT SNAPSHOT DATA START --\n"
    snapshot_context += f"Snapshot: {snapshot.name or snapshot.id}\n"
    # snapshot_context += f"Tables: {len(snapshot.tables)}\n\n"

    truncate_record_content = data_scope == "table"

    for table in snapshot.tables:
        if active_table_id and table.id.wsId != active_table_id:
            continue

        columns_to_exclude = []
        if data_scope == "column":
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

        snapshot_context += f"TABLE: {table.name} (ID: {table.id.wsId})\n"

        columns_context = []

        for col in table.columns:
            if columns_to_exclude and col.id.wsId in columns_to_exclude:
                continue

            readonly = False
            if table_view and col.id.wsId in table_view.columns:
                column_config = table_view.columns.get(col.id.wsId)
                if column_config and column_config.protected:
                    readonly = True

            columns_context.append(f"{col.name}{f' (Read Only)' if readonly else ''}")
        snapshot_context += f"Fields: {', '.join(columns_context)}\n"

        # Add records if available
        if preloaded_records and table.name in preloaded_records:
            records = preloaded_records[table.name]
            # snapshot_context += f"Records ({len(records)}):\n\n"

            # Add filtered records information if available
            if filtered_counts and table.name in filtered_counts:
                filtered_count = filtered_counts[table.name]
                if filtered_count > 0:
                    snapshot_context += f"Note: {filtered_count} records are currently filtered out and not shown in this list.\n\n"

            # Format records using the shared function
            records_summary = format_records_for_prompt(
                records,
                limit=50,
                truncate_record_content=truncate_record_content,
                columns_to_exclude=columns_to_exclude,
            )
            snapshot_context += f"RECORDS:\n{records_summary}\n"
        else:
            snapshot_context += "Records: Not loaded\n"
        snapshot_context += "\n"

    snapshot_context += f"\n-- CURRENT SNAPSHOT DATA END --\n"

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
            focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
        focus_context += "\n"

    if write_focus:
        focus_context += "Write Focus Cells:\n"
        for cell in write_focus:
            focus_context += f"- Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}\n"
        focus_context += "\n"

    return focus_context
