from scratchpad_api import ColumnSpec, SnapshotRecord, RecordId, TableSpec
from agents.data_agent.models import ChatRunContext


### Context Utils

def find_table_by_name(chatRunContext: ChatRunContext, table_name: str) -> TableSpec | None:
    if not chatRunContext.snapshot:
        return None
    
    for table in chatRunContext.snapshot.tables:
        if table.name.lower() == table_name.lower():
            return table
    return None

def find_column_by_name(table: TableSpec, column_name: str) -> ColumnSpec | None:
    for column in table.columns:
        if column.name.lower() == column_name.lower():
            return column
    return None 

def is_in_write_focus(chatRunContext: ChatRunContext, column_id: str, rec_id: str) -> bool:
    # if the write focus is not provided, then we don't care
    if not chatRunContext.write_focus:
        return True
    
    for focus in chatRunContext.write_focus:
        if focus.columnWsId == column_id and focus.recordWsId == rec_id:
            return True
    return False

def is_in_read_focus(chatRunContext: ChatRunContext, column_id: str, rec_id: str) -> bool:
    # if the read focus is not provided, then we don't care
    if not chatRunContext.read_focus:
        return True
    
    for focus in chatRunContext.read_focus:
        if focus.columnWsId == column_id and focus.recordWsId == rec_id:
            return True
    return False


# Extract a specific record from the preloaded records in the context
def find_record_by_wsId(chatRunContext: ChatRunContext, table_id: str, rec_id: str) -> SnapshotRecord | None:
    if not chatRunContext.preloaded_records:
        return None

    # records are stored in lists, keyed to table ID
    records = chatRunContext.preloaded_records[table_id]

    if not records:
        return None

    for record in records:
        if record['id']['wsId'] == rec_id:
            return SnapshotRecord(
                id=RecordId(wsId=record['id']['wsId'], remoteId=record['id']['remoteId']),
                fields=record['fields'],
                edited_fields=record['edited_fields'],
                suggested_fields=record['suggested_fields'],
                dirty=record['dirty']   
            )
    return None


# Error Generators

def missing_table_error(chatRunContext: ChatRunContext, missing_table_name: str) -> str:
    available_tables = [t.name for t in chatRunContext.snapshot.tables]
    return f"Error: Table '{missing_table_name}' not found. Available tables: {available_tables}"