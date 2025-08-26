from scratchpad.entities import ColumnSpec, SnapshotRecord, RecordId, TableSpec
from agents.data_agent.models import ChatRunContext


### Context Utils


def find_table_by_name(
    chatRunContext: ChatRunContext, table_name: str
) -> TableSpec | None:
    if not chatRunContext.snapshot:
        return None

    for table in chatRunContext.snapshot.tables:
        if table.name.lower() == table_name.lower():
            return table
        elif table.id.wsId == table_name:
            return table
    return None


def find_column_by_name(table: TableSpec, column_name: str) -> ColumnSpec | None:
    for column in table.columns:
        if column.name.lower() == column_name.lower():
            return column
        elif column.id.wsId == column_name:
            return column
    return None


def find_column_by_id(table: TableSpec, column_id: str) -> ColumnSpec | None:
    for column in table.columns:
        if column.id.wsId == column_id:
            return column
    return None


def is_in_write_focus(
    chatRunContext: ChatRunContext, column_id: str, rec_id: str
) -> bool:
    # if the write focus is not provided, then we don't care
    if not chatRunContext.write_focus:
        return True

    for focus in chatRunContext.write_focus:
        if focus.columnWsId == column_id and focus.recordWsId == rec_id:
            return True
    return False


def is_in_read_focus(
    chatRunContext: ChatRunContext, column_id: str, rec_id: str
) -> bool:
    # if the read focus is not provided, then we don't care
    if not chatRunContext.read_focus:
        return True

    for focus in chatRunContext.read_focus:
        if focus.columnWsId == column_id and focus.recordWsId == rec_id:
            return True
    return False


# Extract a specific record from the preloaded records in the context
def find_record_by_wsId(
    chatRunContext: ChatRunContext, table_name: str, rec_id: str
) -> SnapshotRecord | None:
    if not chatRunContext.preloaded_records:
        return None

    # records are stored in lists, keyed to table ID
    records = chatRunContext.preloaded_records.get(table_name)

    if records is None or len(records) == 0:
        return None

    for record in records:
        if record["id"]["wsId"] == rec_id:
            return SnapshotRecord(
                id=RecordId(
                    wsId=record["id"]["wsId"], remoteId=record["id"]["remoteId"]
                ),
                fields=record["fields"],
                edited_fields=record["edited_fields"],
                suggested_fields=record["suggested_fields"],
                dirty=record["dirty"],
            )
    return None


def update_record_in_context(
    chatRunContext: ChatRunContext, table_id: str, record: SnapshotRecord
) -> None:
    if not chatRunContext.preloaded_records:
        return

    records = chatRunContext.preloaded_records.get(table_id)
    if records is None:
        return

    for cached_record in records:
        if cached_record["id"]["wsId"] == record.id.wsId:
            # update the values in the cached record with new data
            cached_record["fields"] = record.fields
            cached_record["edited_fields"] = record.edited_fields
            cached_record["suggested_fields"] = record.suggested_fields
            cached_record["dirty"] = record.dirty
            break


def get_active_table(chatRunContext: ChatRunContext) -> TableSpec | None:
    if (
        not chatRunContext.snapshot
        or not chatRunContext.snapshot.tables
        or len(chatRunContext.snapshot.tables) == 0
    ):
        return None

    if chatRunContext.active_table_id:
        for table in chatRunContext.snapshot.tables:
            if table.id.wsId == chatRunContext.active_table_id:
                return table

    return chatRunContext.snapshot.tables[0]


# Error Generators
def missing_table_error(chatRunContext: ChatRunContext, missing_table_name: str) -> str:
    available_tables = [t.name for t in chatRunContext.snapshot.tables]
    return f"Error: Table '{missing_table_name}' not found. Available tables: {available_tables}"


def missing_field_error(table: TableSpec, missing_field_name: str) -> str:
    available_fields = [c.name for c in table.columns]
    return f"Error: Field '{missing_field_name}' not found. Available fields: {available_fields}"


def unable_to_identify_active_table_error(chatRunContext: ChatRunContext) -> str:
    return f"Error: Unable to identify the active table from the context. The snapshot may not be loaded or the active table may not be set."


def unable_to_identify_active_field_error(chatRunContext: ChatRunContext) -> str:
    return f"Error: Unable to identify the active field from the context. The snapshot may not be loaded or the active field may not be set."


def unable_to_identify_active_record_error(chatRunContext: ChatRunContext) -> str:
    return f"Error: Unable to identify the active record from the context. The snapshot may not be loaded or the active record may not be set."


def unable_to_identify_active_snapshot_error(chatRunContext: ChatRunContext) -> str:
    return "Error: No active snapshot. Please connect to a snapshot first using connect_snapshot."


def not_in_write_focus_error(
    chatRunContext: ChatRunContext, column_id: str, rec_id: str
) -> str:
    return f"Error: Field '{column_id}' of record '{rec_id}' is not in write focus."


def record_not_in_context_error(chatRunContext: ChatRunContext, rec_id: str) -> str:
    return f"Error: Record '{rec_id}' not found in the context."
