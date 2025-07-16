from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from scratchpad_api import ScratchpadSnapshot

# Data types for Snapshot
class EntityId(BaseModel):
    wsId: str
    remoteId: List[str]

class ColumnSpecForAi(BaseModel):
    id: EntityId
    name: str
    type: str  # "text" | "number" | "json"

class TableSpec(BaseModel):
    id: EntityId
    name: str
    columns: List[ColumnSpecForAi]

class TableContext(BaseModel):
    id: EntityId
    activeViewId: Optional[str]
    ignoredColumns: List[str]
    readOnlyColumns: List[str]

class SnapshotForAi(BaseModel):
    id: str
    name: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    createdAt: str
    updatedAt: str
    connectorAccountId: str
    tables: List[TableSpec]
    tableContexts: List[TableContext]


def convert_scratchpad_snapshot_to_ai_snapshot(snapshot_data, chatSession) -> SnapshotForAi:
    """
    Convert a ScratchpadSnapshot to SnapshotForAi format.
    
    Args:
        snapshot_data: The raw snapshot data from the API
        chatSession: The chat session object containing metadata
        
    Returns:
        SnapshotForAi: The converted snapshot object
    """
    print(f"🔍 Converting snapshot data...")
    print(f"📊 Snapshot ID: {snapshot_data.id}")
    print(f"📅 Created: {chatSession.created_at}")
    print(f"📅 Updated: {chatSession.last_activity}")
    
    # Convert tables one by one
    converted_tables = []
    for i, table in enumerate(snapshot_data.tables):
        print(f"🔍 Converting table {i+1}/{len(snapshot_data.tables)}: {table['name']}")  # type: ignore
        
        # Convert columns for this table
        converted_columns = []
        for j, col in enumerate(table['columns']):  # type: ignore
            print(f"  🔍 Converting column {j+1}/{len(table['columns'])}: {col['name']}")  # type: ignore
            print(f"    📋 Column type: {col['pgType']}")  # type: ignore
            column_spec = ColumnSpecForAi(
                id=EntityId(wsId=col['id']['wsId'], remoteId=col['id']['remoteId']),  # type: ignore
                name=col['name'],  # type: ignore
                type=col['pgType']  # type: ignore
            )
            converted_columns.append(column_spec)
        
        # Create table spec
        table_spec = TableSpec(
            id=EntityId(wsId=table['id']['wsId'], remoteId=table['id']['remoteId']),  # type: ignore
            name=table['name'],  # type: ignore
            columns=converted_columns
        )
        converted_tables.append(table_spec)
    
    # Create table contexts
    converted_table_contexts = []
    for i, table_context in enumerate(snapshot_data.tableContexts):
        table_context_spec = TableContext(
            id=EntityId(wsId=table_context['id']['wsId'], remoteId=table_context['id']['remoteId']),  # type: ignore
            activeViewId=table_context['activeViewId'],  # type: ignore
            ignoredColumns=table_context['ignoredColumns'],  # type: ignore
            readOnlyColumns=table_context['readOnlyColumns']  # type: ignore
        )
        converted_table_contexts.append(table_context_spec)

    # Create the snapshot
    print(f"🔍 Creating Snapshot object...")
    snapshot = SnapshotForAi(
        id=snapshot_data.id,
        name=snapshot_data.name,
        connectorDisplayName=snapshot_data.connectorDisplayName,
        connectorService=snapshot_data.connectorService,
        createdAt=snapshot_data.createdAt,
        updatedAt=snapshot_data.updatedAt,
        connectorAccountId=snapshot_data.connectorAccountId,
        tables=converted_tables,
        tableContexts=converted_table_contexts
    )
    print(f"✅ Snapshot object created successfully")
    
    return snapshot


def format_records_for_display(records: List[Dict[str, Any]], limit: int = 100) -> str:
    """Format records for display in a consistent way for both prompt and tool output"""
    if not records:
        return "No records found"
    
    records_summary = []
    for i, record in enumerate(records[:limit]):
        # Map from flat structure to our desired format
        record_data = {
            "wsid": record.get('id', {}).get('wsId', record.get('wsId', 'unknown')),
            "id": record.get('id', {}).get('wsId', record.get('wsId', 'unknown')),
            "fields": record.get('fields', {}),
            "edited_fields": record.get('edited_fields', {}),
            "suggested_fields": record.get('suggested_fields', {})
        }
        
        # Truncate long string values in fields for readability
        for key, value in record_data["fields"].items():
            if isinstance(value, str) and len(value) > 100:
                record_data["fields"][key] = value[:100] + "..."
        
        records_summary.append(record_data)
    
    return str(records_summary)

