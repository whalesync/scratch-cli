#!/usr/bin/env python3
"""
Python API client for Scratchpad server - equivalent to mcp/src/lib/api/snapshot.ts
"""

import os
import json
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from datetime import datetime
import requests


# Data models equivalent to TypeScript interfaces
@dataclass
class EntityId:
    wsId: str
    remoteId: List[str]


@dataclass
class ColumnSpec:
    id: EntityId
    name: str
    type: str  # "text" | "number" | "json"


@dataclass
class TableSpec:
    id: EntityId
    name: str
    columns: List[ColumnSpec]


@dataclass
class TableContext:
    id: EntityId
    activeViewId: Optional[str]
    ignoredColumns: List[str]
    readOnlyColumns: List[str]


# Type aliases for metadata fields
SuggestedFields = Dict[str, str]
EditedFieldsMetadata = Dict[
    str, str
]  # Field name -> timestamp, plus special __created/__deleted keys


@dataclass
class RecordId:
    wsId: str
    remoteId: Optional[str]


@dataclass
class SnapshotRecord:
    id: RecordId
    fields: Dict[str, Any]
    edited_fields: Optional[EditedFieldsMetadata] = None
    suggested_fields: Optional[SuggestedFields] = None
    dirty: bool = False


@dataclass
class ScratchpadSnapshot:
    id: str
    name: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    createdAt: str
    updatedAt: str
    connectorAccountId: str
    tables: List[TableSpec]
    tableContexts: List[TableContext]
    activeRecordSqlFilter: Optional[Dict[str, str]] = None


@dataclass
class CreateSnapshotDto:
    connectorAccountId: str
    tableIds: List[EntityId]


@dataclass
class RecordOperation:
    op: str  # "create" | "update" | "delete"
    wsId: str
    data: Optional[Dict[str, Any]] = None


@dataclass
class BulkUpdateRecordsDto:
    ops: List[RecordOperation]


@dataclass
class ListRecordsResponse:
    records: List[SnapshotRecord]
    nextCursor: Optional[str] = None
    filteredRecordsCount: int = 0


@dataclass
class CreateSnapshotTableViewDto:
    source: str  # 'ui' or 'agent'
    name: Optional[str]
    recordIds: List[str]


@dataclass
class SnapshotTableView:
    id: str
    name: str
    updatedAt: str
    recordIds: List[str]


class ScratchpadApiConfig:
    """Configuration for Scratchpad API calls"""

    def __init__(self):
        self.api_url = os.getenv("SCRATCHPAD_SERVER_URL", "http://localhost:3010")

    def get_api_url(self) -> str:
        return self.api_url

    def get_api_headers(self, api_token: str) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "scratchpad-pydantic-ai-agent",
        }
        if api_token:
            headers["Authorization"] = f"API-Token {api_token}"
        return headers

    def get_api_server_health_url(self) -> str:
        return f"{self.api_url}/health"


# Global config instance (no longer stores API token)
API_CONFIG = ScratchpadApiConfig()


class ScratchpadApiError(Exception):
    """Custom exception for Scratchpad API errors"""

    pass


def _handle_response(response: requests.Response, error_message: str) -> Any:
    """Handle API response and raise appropriate errors"""
    if not response.ok:
        raise ScratchpadApiError(
            f"{error_message}: {response.status_code} - {response.text}"
        )
    return response.json()


class SnapshotApi:
    """Python equivalent of the TypeScript snapshotApi"""

    @staticmethod
    def list(connector_account_id: str, api_token: str) -> List[ScratchpadSnapshot]:
        """List snapshots for a connector account"""
        url = f"{API_CONFIG.get_api_url()}/snapshot?connectorAccountId={connector_account_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to fetch snapshots")
        return [ScratchpadSnapshot(**snapshot) for snapshot in data]

    @staticmethod
    def detail(snapshot_id: str, api_token: str) -> ScratchpadSnapshot:
        """Get snapshot details"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to fetch snapshot")
        return ScratchpadSnapshot(**data)

    @staticmethod
    def create(dto: CreateSnapshotDto, api_token: str) -> ScratchpadSnapshot:
        """Create a new snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot"
        payload = {
            "connectorAccountId": dto.connectorAccountId,
            "tableIds": [
                {"wsId": tid.wsId, "remoteId": tid.remoteId} for tid in dto.tableIds
            ],
        }
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(api_token), json=payload
        )
        data = _handle_response(response, "Failed to create snapshot")
        return ScratchpadSnapshot(**data)

    @staticmethod
    def update(snapshot_id: str, api_token: str) -> ScratchpadSnapshot:
        """Update a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.patch(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to update snapshot")
        return ScratchpadSnapshot(**data)

    @staticmethod
    def download(snapshot_id: str, api_token: str) -> None:
        """Start snapshot download"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/download"
        response = requests.post(url, headers=API_CONFIG.get_api_headers(api_token))
        _handle_response(response, "Failed to start download")

    @staticmethod
    def delete(snapshot_id: str, api_token: str) -> None:
        """Delete a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.delete(url, headers=API_CONFIG.get_api_headers(api_token))
        _handle_response(response, "Failed to delete snapshot")

    @staticmethod
    def list_records(
        snapshot_id: str,
        table_id: str,
        api_token: str,
        cursor: Optional[str] = None,
        take: Optional[int] = None,
        view_id: Optional[str] = None,
    ) -> ListRecordsResponse:
        """List records for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records"
        params = {}
        if cursor:
            params["cursor"] = cursor
        if take:
            params["take"] = str(take)
        if view_id:
            params["viewId"] = view_id
        response = requests.get(
            url, headers=API_CONFIG.get_api_headers(api_token), params=params
        )
        data = _handle_response(response, "Failed to list records")

        print(
            f"🔍 DEBUG: Raw server response has {len(data.get('records', []))} records"
        )

        # Convert raw record dictionaries to SnapshotRecord objects
        records = []
        for i, record_dict in enumerate(data.get("records", [])):
            print(f"🔍 DEBUG: Converting record {i}: {type(record_dict)}")

            record_id = RecordId(
                wsId=record_dict["id"]["wsId"], remoteId=record_dict["id"]["remoteId"]
            )

            snapshot_record = SnapshotRecord(
                id=record_id,
                fields=record_dict.get("fields", {}),
                edited_fields=record_dict.get("__edited_fields"),
                suggested_fields=record_dict.get(
                    "__suggested_values"
                ),  # Note: server uses __suggested_values
                dirty=record_dict.get("__dirty", False),
            )
            print(f"🔍 DEBUG: Created SnapshotRecord: {type(snapshot_record)}")
            records.append(snapshot_record)

        result = ListRecordsResponse(
            records=records,
            nextCursor=data.get("nextCursor"),
            filteredRecordsCount=data.get("filteredRecordsCount", 0),
        )
        print(
            f"🔍 DEBUG: Returning ListRecordsResponse with {len(result.records)} records of type {type(result.records[0]) if result.records else 'None'}"
        )
        return result

    @staticmethod
    def list_records_for_ai(
        snapshot_id: str,
        table_id: str,
        api_token: str,
        cursor: Optional[str] = None,
        take: Optional[int] = None,
        view_id: Optional[str] = None,
        read_focus: Optional[List[Dict[str, str]]] = None,
        write_focus: Optional[List[Dict[str, str]]] = None,
    ) -> ListRecordsResponse:
        """List records for a table in a snapshot with focus arrays for AI processing"""
        url = f"{API_CONFIG.get_api_url()}/ai-snapshot/{snapshot_id}/tables/{table_id}/records/active-view"
        params = {}
        if cursor:
            params["cursor"] = cursor
        if take:
            params["take"] = str(take)
        if view_id:
            params["viewId"] = view_id

        # Prepare request body with focus arrays
        body = {}
        if read_focus:
            body["readFocus"] = read_focus
        if write_focus:
            body["writeFocus"] = write_focus

        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(api_token), params=params, json=body
        )
        data = _handle_response(response, "Failed to list records for AI")

        print(
            f"🔍 DEBUG: Raw server response has {len(data.get('records', []))} records"
        )

        # Convert raw record dictionaries to SnapshotRecord objects
        records = []
        for i, record_dict in enumerate(data.get("records", [])):
            print(f"🔍 DEBUG: Converting record {i}: {type(record_dict)}")

            record_id = RecordId(
                wsId=record_dict["id"]["wsId"], remoteId=record_dict["id"]["remoteId"]
            )

            snapshot_record = SnapshotRecord(
                id=record_id,
                fields=record_dict.get("fields", {}),
                edited_fields=record_dict.get("__edited_fields"),
                suggested_fields=record_dict.get(
                    "__suggested_values"
                ),  # Note: server uses __suggested_values
                dirty=record_dict.get("__dirty", False),
            )
            print(f"🔍 DEBUG: Created SnapshotRecord: {type(snapshot_record)}")
            records.append(snapshot_record)

        result = ListRecordsResponse(
            records=records,
            nextCursor=data.get("nextCursor"),
            filteredRecordsCount=data.get("filteredRecordsCount", 0),
        )
        print(
            f"🔍 DEBUG: Returning ListRecordsResponse with {len(result.records)} records of type {type(result.records[0]) if result.records else 'None'}"
        )
        return result

    @staticmethod
    def get_record(
        snapshot_id: str, table_id: str, record_id: str, api_token: str
    ) -> SnapshotRecord:
        """Get a single record from a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/{record_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to get record")
        return build_snapshot_record(data)

    @staticmethod
    def bulk_update_records(
        snapshot_id: str,
        table_id: str,
        dto: BulkUpdateRecordsDto,
        api_token: str,
        view_id: Optional[str] = None,
    ) -> None:
        """Bulk update records in a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/bulk-suggest"
        params = {}
        if view_id:
            params["viewId"] = view_id
        payload = {
            "ops": [{"op": op.op, "wsId": op.wsId, "data": op.data} for op in dto.ops]
        }
        response = requests.post(
            url,
            headers=API_CONFIG.get_api_headers(api_token),
            json=payload,
            params=params,
        )
        # _handle_response(response, "Failed to bulk update records")

    @staticmethod
    def activate_view(
        snapshot_id: str, table_id: str, dto: CreateSnapshotTableViewDto, api_token: str
    ) -> str:
        """Activate a view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/activate-view"
        payload = {
            "source": dto.source,
            "name": dto.name,
            "recordIds": dto.recordIds,
        }
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(api_token), json=payload
        )
        data = _handle_response(response, "Failed to activate view")
        return data["id"]

    @staticmethod
    def list_views(
        snapshot_id: str, table_id: str, api_token: str
    ) -> List[SnapshotTableView]:
        """List all views for a table in a snapshot"""
        url = (
            f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views"
        )
        response = requests.post(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to list views")
        return [SnapshotTableView(**view) for view in data]

    @staticmethod
    def delete_view(
        snapshot_id: str, table_id: str, view_id: str, api_token: str
    ) -> None:
        """Delete a view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views/{view_id}"
        response = requests.delete(url, headers=API_CONFIG.get_api_headers(api_token))
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to delete view: {response.status_code} - {response.text}"
            )

    @staticmethod
    def get_view(
        snapshot_id: str, table_id: str, view_id: str, api_token: str
    ) -> SnapshotTableView:
        """Get a specific view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views/{view_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(api_token))
        data = _handle_response(response, "Failed to get view")
        return SnapshotTableView(**data)

    @staticmethod
    def clear_active_view(snapshot_id: str, table_id: str, api_token: str) -> None:
        """Clear the active view for a table in a snapshot (revert to default view)"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/clear-activate-view"
        response = requests.post(url, headers=API_CONFIG.get_api_headers(api_token))
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to clear active view: {response.status_code} - {response.text}"
            )

    @staticmethod
    def add_records_to_active_filter(
        snapshot_id: str, table_id: str, record_ids: List[str], api_token: str
    ) -> None:
        """Add records to the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/add-records-to-active-filter"
        payload = {"recordIds": record_ids}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(api_token), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to add records to active filter: {response.status_code} - {response.text}"
            )

    @staticmethod
    def set_active_records_filter(
        snapshot_id: str, table_id: str, sql_where_clause: Optional[str], api_token: str
    ) -> None:
        """Set the active records filter for a table using SQL WHERE clause (replaces existing filter)"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/set-active-records-filter"
        payload = {"sqlWhereClause": sql_where_clause}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(api_token), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to set active records filter: {response.status_code} - {response.text}"
            )

    @staticmethod
    def clear_active_record_filter(
        snapshot_id: str, table_id: str, api_token: str
    ) -> None:
        """Clear the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/clear-active-record-filter"
        response = requests.post(url, headers=API_CONFIG.get_api_headers(api_token))
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to clear active record filter: {response.status_code} - {response.text}"
            )


# Convenience functions for easy access
def list_snapshots(
    connector_account_id: str, api_token: str
) -> List[ScratchpadSnapshot]:
    """List snapshots for a connector account"""
    return SnapshotApi.list(connector_account_id, api_token)


def get_snapshot(snapshot_id: str, api_token: str) -> ScratchpadSnapshot:
    """Get snapshot details"""
    return SnapshotApi.detail(snapshot_id, api_token)


def create_snapshot(
    connector_account_id: str, table_ids: List[EntityId], api_token: str
) -> ScratchpadSnapshot:
    """Create a new snapshot"""
    dto = CreateSnapshotDto(connectorAccountId=connector_account_id, tableIds=table_ids)
    return SnapshotApi.create(dto, api_token)


def update_snapshot(snapshot_id: str, api_token: str) -> ScratchpadSnapshot:
    """Update a snapshot"""
    return SnapshotApi.update(snapshot_id, api_token)


def download_snapshot(snapshot_id: str, api_token: str) -> None:
    """Start snapshot download"""
    SnapshotApi.download(snapshot_id, api_token)


def delete_snapshot(snapshot_id: str, api_token: str) -> None:
    """Delete a snapshot"""
    SnapshotApi.delete(snapshot_id, api_token)


def list_records(
    snapshot_id: str,
    table_id: str,
    api_token: str,
    cursor: Optional[str] = None,
    take: Optional[int] = None,
    view_id: Optional[str] = None,
) -> ListRecordsResponse:
    """List records for a table in a snapshot"""
    return SnapshotApi.list_records(
        snapshot_id, table_id, api_token, cursor, take, view_id
    )


def list_records_for_ai(
    snapshot_id: str,
    table_id: str,
    api_token: str,
    cursor: Optional[str] = None,
    take: Optional[int] = None,
    view_id: Optional[str] = None,
    read_focus: Optional[List[Dict[str, str]]] = None,
    write_focus: Optional[List[Dict[str, str]]] = None,
) -> ListRecordsResponse:
    """List records for a table in a snapshot with focus arrays for AI processing"""
    return SnapshotApi.list_records_for_ai(
        snapshot_id, table_id, api_token, cursor, take, view_id, read_focus, write_focus
    )


def bulk_update_records(
    snapshot_id: str,
    table_id: str,
    operations: List[RecordOperation],
    api_token: str,
    view_id: Optional[str] = None,
) -> None:
    """Bulk update records in a table"""
    dto = BulkUpdateRecordsDto(ops=operations)
    SnapshotApi.bulk_update_records(snapshot_id, table_id, dto, api_token, view_id)


def activate_view(
    snapshot_id: str, table_id: str, dto: CreateSnapshotTableViewDto, api_token: str
) -> str:
    """Activate a view for a table in a snapshot"""
    return SnapshotApi.activate_view(snapshot_id, table_id, dto, api_token)


def list_views(
    snapshot_id: str, table_id: str, api_token: str
) -> List[SnapshotTableView]:
    """List all views for a table in a snapshot"""
    return SnapshotApi.list_views(snapshot_id, table_id, api_token)


def delete_view(snapshot_id: str, table_id: str, view_id: str, api_token: str) -> None:
    """Delete a view for a table in a snapshot"""
    SnapshotApi.delete_view(snapshot_id, table_id, view_id, api_token)


def get_view(
    snapshot_id: str, table_id: str, view_id: str, api_token: str
) -> SnapshotTableView:
    """Get a specific view for a table in a snapshot"""
    return SnapshotApi.get_view(snapshot_id, table_id, view_id, api_token)


def clear_active_view(snapshot_id: str, table_id: str, api_token: str) -> None:
    """Clear the active view for a table in a snapshot (revert to default view)"""
    SnapshotApi.clear_active_view(snapshot_id, table_id, api_token)


def add_records_to_active_filter(
    snapshot_id: str, table_id: str, record_ids: List[str], api_token: str
) -> None:
    """Add records to the active record filter for a table"""
    SnapshotApi.add_records_to_active_filter(
        snapshot_id, table_id, record_ids, api_token
    )


def set_active_records_filter(
    snapshot_id: str, table_id: str, sql_where_clause: Optional[str], api_token: str
) -> None:
    """Set the active records filter for a table using SQL WHERE clause (replaces existing filter)"""
    SnapshotApi.set_active_records_filter(
        snapshot_id, table_id, sql_where_clause, api_token
    )


def clear_active_record_filter(snapshot_id: str, table_id: str, api_token: str) -> None:
    """Clear the active record filter for a table"""
    SnapshotApi.clear_active_record_filter(snapshot_id, table_id, api_token)


def get_record(
    snapshot_id: str, table_id: str, record_id: str, api_token: str
) -> SnapshotRecord:
    """Get a single record from a table in a snapshot"""
    return SnapshotApi.get_record(snapshot_id, table_id, record_id, api_token)


def check_server_health() -> bool:
    """Check if the Scratchpad server is healthy"""
    try:
        url = API_CONFIG.get_api_server_health_url()
        response = requests.get(url, timeout=5)
        return response.ok
    except Exception:
        return False


def build_snapshot_record(record_dict: Dict[str, Any]) -> SnapshotRecord:
    """Build a SnapshotRecord from a dictionary"""
    return SnapshotRecord(
        id=RecordId(
            wsId=record_dict["id"]["wsId"], remoteId=record_dict["id"]["remoteId"]
        ),
        fields=record_dict.get("fields", {}),
        edited_fields=record_dict.get("__edited_fields"),
        suggested_fields=record_dict.get(
            "__suggested_values"
        ),  # Note: server uses __suggested_values
        dirty=record_dict.get("__dirty", False),
    )
