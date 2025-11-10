from copy import deepcopy
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from scratchpad.entities import ColumnView, ScratchpadSnapshot, SnapshotTable
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
    required: bool = False
    metadata: Optional[Dict[str, Any]] = None


class TableSpecForAi(BaseModel):
    id: EntityId
    name: str
    columns: List[ColumnSpecForAi]


class SnapshotForAi(BaseModel):
    id: str
    name: Optional[str]
    createdAt: str
    updatedAt: str
    tables: List[TableSpecForAi]


def convert_scratchpad_snapshot_to_ai_snapshot(
    snapshot_data: ScratchpadSnapshot,
    chatSession: ChatSession,
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
    for i, snapshotTable in enumerate[SnapshotTable](snapshot_data.snapshotTables):
        logger.debug(f"🔍 Converting table: {snapshotTable}")
        table = snapshotTable["tableSpec"]  # type: ignore

        # Convert columns for this table
        converted_columns = []
        for j, col in enumerate(table["columns"]):  # type: ignore
            logger.debug(f"🔍 Checking column: {col['id']['wsId']}")
            if (
                snapshotTable["hiddenColumns"]
                and len(snapshotTable["hiddenColumns"]) > 0
                and col["id"]["wsId"] in snapshotTable["hiddenColumns"]
            ):
                logger.debug(f"🔍 Skipping hidden column: {col['id']['wsId']}")
                continue

            column_spec = ColumnSpecForAi(
                id=EntityId(wsId=col["id"]["wsId"], remoteId=col["id"]["remoteId"]),  # type: ignore
                name=col["name"],  # type: ignore
                type=col["pgType"],  # type: ignore
                required=col.get("required", False),  # type: ignore
                metadata=col.get("metadata", None),  # type: ignore
            )
            converted_columns.append(column_spec)

        # Create table spec
        table_spec = TableSpecForAi(
            id=EntityId(wsId=table["id"]["wsId"], remoteId=table["id"]["remoteId"]),  # type: ignore
            name=table["name"],  # type: ignore
            columns=converted_columns,
        )
        converted_tables.append(table_spec)

    # Create the snapshot
    logger.debug(f"🔍 Creating Snapshot object...")
    snapshot = SnapshotForAi(
        id=snapshot_data.id,
        name=snapshot_data.name,
        createdAt=snapshot_data.createdAt,
        updatedAt=snapshot_data.updatedAt,
        tables=converted_tables,
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


def find_column_by_id(
    table: TableSpecForAi, column_id: str
) -> Optional[ColumnSpecForAi]:
    for column in table.columns:
        if column.id.wsId == column_id:
            return column
    return None
