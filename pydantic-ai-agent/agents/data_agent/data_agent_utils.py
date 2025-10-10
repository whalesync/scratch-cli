from copy import deepcopy
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from scratchpad.entities import ColumnView, ScratchpadSnapshot
from session import ChatSession
from logging import getLogger

logger = getLogger(__name__)


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


class ColumnViewConfig(BaseModel):
    hidden: bool = False
    protected: bool = False


class TableViewConfig(BaseModel):
    hidden: bool = False
    protected: bool = False
    columns: Dict[str, ColumnViewConfig]


class SnapshotForAi(BaseModel):
    id: str
    name: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    createdAt: str
    updatedAt: str
    connectorAccountId: Optional[str]
    tables: List[TableSpec]
    tableContexts: List[TableContext]
    tableViews: Dict[str, TableViewConfig]


def convert_scratchpad_snapshot_to_ai_snapshot(
    snapshot_data: ScratchpadSnapshot,
    chatSession: ChatSession,
    column_view: Optional[ColumnView] = None,
) -> SnapshotForAi:
    """
    Convert a ScratchpadSnapshot to SnapshotForAi format.

    Args:
        snapshot_data: The raw snapshot data from the API
        chatSession: The chat session object containing metadata

    Returns:
        SnapshotForAi: The converted snapshot object
    """
    logger.debug(f"🔍 Converting snapshot data...")
    logger.debug(f"📊 Snapshot ID: {snapshot_data.id}")
    logger.debug(f"📅 Created: {chatSession.created_at}")
    logger.debug(f"📅 Updated: {chatSession.last_activity}")

    # Convert tables one by one
    converted_tables = []
    for i, table in enumerate(snapshot_data.tables):
        logger.debug(f"🔍 Converting table {i+1}/{len(snapshot_data.tables)}: {table['name']}")  # type: ignore

        # Convert columns for this table
        converted_columns = []
        for j, col in enumerate(table["columns"]):  # type: ignore
            column_spec = ColumnSpecForAi(
                id=EntityId(wsId=col["id"]["wsId"], remoteId=col["id"]["remoteId"]),  # type: ignore
                name=col["name"],  # type: ignore
                type=col["pgType"],  # type: ignore
            )
            converted_columns.append(column_spec)

        # Create table spec
        table_spec = TableSpec(
            id=EntityId(wsId=table["id"]["wsId"], remoteId=table["id"]["remoteId"]),  # type: ignore
            name=table["name"],  # type: ignore
            columns=converted_columns,
        )
        converted_tables.append(table_spec)

    # Create table contexts
    tableViews = {}

    if column_view:
        for table_id, table_config in column_view.config.items():
            columns = {}
            for column_config in table_config.get("columns", []):
                column_id = column_config["wsId"]
                columns[column_id] = ColumnViewConfig(
                    hidden=column_config.get("hidden", False),
                    protected=column_config.get("protected", False),
                )

            table_view = TableViewConfig(
                hidden=table_config.get("hidden", False),
                protected=table_config.get("protected", False),
                columns=columns,
            )
            tableViews[table_id] = table_view

    converted_table_contexts = []
    for i, table_context in enumerate(snapshot_data.tableContexts):
        table_context_spec = TableContext(
            id=EntityId(wsId=table_context["id"]["wsId"], remoteId=table_context["id"]["remoteId"]),  # type: ignore
            activeViewId=table_context["activeViewId"],  # type: ignore
            ignoredColumns=table_context["ignoredColumns"],  # type: ignore
            readOnlyColumns=table_context["readOnlyColumns"],  # type: ignore
        )
        converted_table_contexts.append(table_context_spec)

    # Create the snapshot
    logger.debug(f"🔍 Creating Snapshot object...")
    snapshot = SnapshotForAi(
        id=snapshot_data.id,
        name=snapshot_data.name,
        connectorDisplayName=snapshot_data.connectorDisplayName,
        connectorService=snapshot_data.connectorService,
        createdAt=snapshot_data.createdAt,
        updatedAt=snapshot_data.updatedAt,
        connectorAccountId=snapshot_data.connectorAccountId,
        tables=converted_tables,
        tableContexts=converted_table_contexts,  # note, may be deprecated
        tableViews=tableViews,
    )
    logger.debug(f"✅ Snapshot object created successfully")

    return snapshot


def format_records_for_prompt(
    records: List[Dict[str, Any]],
    limit: int = 100,
    truncate_record_content: bool = True,
    columns_to_exclude: Optional[List[str]] = None,
) -> str:
    """Format records for display in a consistent way for both prompt and tool output"""
    if not records:
        return "No records found"

    records_summary = []
    for i, record in enumerate(records[:limit]):
        # Map from flat structure to our desired format
        # make sure to deepcopy so we don't modify the original record in the context
        record_data = {
            "wsid": record.get("id", {}).get("wsId", record.get("wsId", "unknown")),
            "id": record.get("id", {}).get("wsId", record.get("wsId", "unknown")),
            "fields": deepcopy(record.get("fields", {})),
            "suggested_fields": deepcopy(record.get("suggested_fields", {})),
        }

        # Remove any fields on the exclude list
        if columns_to_exclude and len(columns_to_exclude) > 0:
            new_fields = {}
            new_suggested_fields = {}
            for column_id in record_data["fields"]:
                if column_id not in columns_to_exclude:
                    new_fields[column_id] = record_data["fields"][column_id]
            for column_id in record_data["suggested_fields"]:
                if column_id not in columns_to_exclude:
                    new_suggested_fields[column_id] = record_data["suggested_fields"][
                        column_id
                    ]
            record_data["fields"] = new_fields
            record_data["suggested_fields"] = new_suggested_fields

        # Truncate long string values in fields for readability
        if truncate_record_content:
            for key, value in record_data["fields"].items():
                if isinstance(value, str) and len(value) > 200:
                    record_data["fields"][key] = value[:200] + "..."

        records_summary.append(record_data)

    return str(records_summary)


def get_table_context(snapshot: SnapshotForAi, table_id: str) -> Optional[TableContext]:
    for table_context in snapshot.tableContexts:
        if table_context.id.wsId == table_id:
            return table_context
    return None
