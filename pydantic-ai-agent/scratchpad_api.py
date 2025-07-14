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
EditedFieldsMetadata = Dict[str, str]  # Field name -> timestamp, plus special __created/__deleted keys

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
class Snapshot:
    id: str
    name: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    createdAt: str
    updatedAt: str
    connectorAccountId: str
    tables: List[TableSpec]
    tableContexts: List[TableContext]

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
        self.api_token = os.getenv("SCRATCHPAD_API_TOKEN", "")
    
    def get_api_url(self) -> str:
        return self.api_url
    
    def set_api_token(self, token: str) -> None:
        self.api_token = token
    
    def get_api_token(self) -> str:
        return self.api_token
    
    def get_api_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_token:
            headers["Authorization"] = f"API-Token {self.api_token}"
        return headers
    
    def get_api_server_health_url(self) -> str:
        return f"{self.api_url}/health"

# Global config instance
API_CONFIG = ScratchpadApiConfig()

class ScratchpadApiError(Exception):
    """Custom exception for Scratchpad API errors"""
    pass

def _handle_response(response: requests.Response, error_message: str) -> Any:
    """Handle API response and raise appropriate errors"""
    if not response.ok:
        raise ScratchpadApiError(f"{error_message}: {response.status_code} - {response.text}")
    return response.json()

class SnapshotApi:
    """Python equivalent of the TypeScript snapshotApi"""
    
    @staticmethod
    def list(connector_account_id: str) -> List[Snapshot]:
        """List snapshots for a connector account"""
        url = f"{API_CONFIG.get_api_url()}/snapshot?connectorAccountId={connector_account_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers())
        data = _handle_response(response, "Failed to fetch snapshots")
        return [Snapshot(**snapshot) for snapshot in data]
    
    @staticmethod
    def detail(snapshot_id: str) -> Snapshot:
        """Get snapshot details"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers())
        data = _handle_response(response, "Failed to fetch snapshot")
        return Snapshot(**data)
    
    @staticmethod
    def create(dto: CreateSnapshotDto) -> Snapshot:
        """Create a new snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot"
        payload = {
            "connectorAccountId": dto.connectorAccountId,
            "tableIds": [{"wsId": tid.wsId, "remoteId": tid.remoteId} for tid in dto.tableIds]
        }
        response = requests.post(url, headers=API_CONFIG.get_api_headers(), json=payload)
        data = _handle_response(response, "Failed to create snapshot")
        return Snapshot(**data)
    
    @staticmethod
    def update(snapshot_id: str) -> Snapshot:
        """Update a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.patch(url, headers=API_CONFIG.get_api_headers())
        data = _handle_response(response, "Failed to update snapshot")
        return Snapshot(**data)
    
    @staticmethod
    def download(snapshot_id: str) -> None:
        """Start snapshot download"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/download"
        response = requests.post(url, headers=API_CONFIG.get_api_headers())
        _handle_response(response, "Failed to start download")
    
    @staticmethod
    def delete(snapshot_id: str) -> None:
        """Delete a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.delete(url, headers=API_CONFIG.get_api_headers())
        _handle_response(response, "Failed to delete snapshot")
    
    @staticmethod
    def list_records(snapshot_id: str, table_id: str, cursor: Optional[str] = None, take: Optional[int] = None, view_id: Optional[str] = None) -> ListRecordsResponse:
        """List records for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records"
        params = {}
        if cursor:
            params["cursor"] = cursor
        if take:
            params["take"] = str(take)
        if view_id:
            params["viewId"] = view_id
        response = requests.get(url, headers=API_CONFIG.get_api_headers(), params=params)
        data = _handle_response(response, "Failed to list records")
        
        print(f"🔍 DEBUG: Raw server response has {len(data.get('records', []))} records")
        
        # Convert raw record dictionaries to SnapshotRecord objects
        records = []
        for i, record_dict in enumerate(data.get("records", [])):
            print(f"🔍 DEBUG: Converting record {i}: {type(record_dict)}")
            
            record_id = RecordId(
                wsId=record_dict["id"]["wsId"],
                remoteId=record_dict["id"]["remoteId"]
            )
            
            snapshot_record = SnapshotRecord(
                id=record_id,
                fields=record_dict.get("fields", {}),
                edited_fields=record_dict.get("__edited_fields"),
                suggested_fields=record_dict.get("__suggested_values"),  # Note: server uses __suggested_values
                dirty=record_dict.get("__dirty", False)
            )
            print(f"🔍 DEBUG: Created SnapshotRecord: {type(snapshot_record)}")
            records.append(snapshot_record)
        
        result = ListRecordsResponse(
            records=records,
            nextCursor=data.get("nextCursor")
        )
        print(f"🔍 DEBUG: Returning ListRecordsResponse with {len(result.records)} records of type {type(result.records[0]) if result.records else 'None'}")
        return result
    
    @staticmethod
    def bulk_update_records(snapshot_id: str, table_id: str, dto: BulkUpdateRecordsDto) -> None:
        """Bulk update records in a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/bulk-suggest"
        payload = {
            "ops": [
                {
                    "op": op.op,
                    "wsId": op.wsId,
                    "data": op.data
                } for op in dto.ops
            ]
        }
        response = requests.post(url, headers=API_CONFIG.get_api_headers(), json=payload)
        # _handle_response(response, "Failed to bulk update records")

    @staticmethod
    def activate_view(snapshot_id: str, table_id: str, dto: CreateSnapshotTableViewDto) -> str:
        """Activate a view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/activate-view"
        payload = {
            "source": dto.source,
            "name": dto.name,
            "recordIds": dto.recordIds,
        }
        response = requests.post(url, headers=API_CONFIG.get_api_headers(), json=payload)
        data = _handle_response(response, "Failed to activate view")
        return data["id"]

    @staticmethod
    def list_views(snapshot_id: str, table_id: str) -> List[SnapshotTableView]:
        """List all views for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views"
        response = requests.post(url, headers=API_CONFIG.get_api_headers())
        data = _handle_response(response, "Failed to list views")
        return [SnapshotTableView(**view) for view in data]

    @staticmethod
    def delete_view(snapshot_id: str, table_id: str, view_id: str) -> None:
        """Delete a view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views/{view_id}"
        response = requests.delete(url, headers=API_CONFIG.get_api_headers())
        if not response.ok:
            raise ScratchpadApiError(f"Failed to delete view: {response.status_code} - {response.text}")

    @staticmethod
    def get_view(snapshot_id: str, table_id: str, view_id: str) -> SnapshotTableView:
        """Get a specific view for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/views/{view_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers())
        data = _handle_response(response, "Failed to get view")
        return SnapshotTableView(**data)

    @staticmethod
    def clear_active_view(snapshot_id: str, table_id: str) -> None:
        """Clear the active view for a table in a snapshot (revert to default view)"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/clear-activate-view"
        response = requests.post(url, headers=API_CONFIG.get_api_headers())
        if not response.ok:
            raise ScratchpadApiError(f"Failed to clear active view: {response.status_code} - {response.text}")

# Convenience functions for easy access
def list_snapshots(connector_account_id: str) -> List[Snapshot]:
    """List snapshots for a connector account"""
    return SnapshotApi.list(connector_account_id)

def get_snapshot(snapshot_id: str) -> Snapshot:
    """Get snapshot details"""
    return SnapshotApi.detail(snapshot_id)

def create_snapshot(connector_account_id: str, table_ids: List[EntityId]) -> Snapshot:
    """Create a new snapshot"""
    dto = CreateSnapshotDto(connectorAccountId=connector_account_id, tableIds=table_ids)
    return SnapshotApi.create(dto)

def update_snapshot(snapshot_id: str) -> Snapshot:
    """Update a snapshot"""
    return SnapshotApi.update(snapshot_id)

def download_snapshot(snapshot_id: str) -> None:
    """Start snapshot download"""
    SnapshotApi.download(snapshot_id)

def delete_snapshot(snapshot_id: str) -> None:
    """Delete a snapshot"""
    SnapshotApi.delete(snapshot_id)

def list_records(snapshot_id: str, table_id: str, cursor: Optional[str] = None, take: Optional[int] = None) -> ListRecordsResponse:
    """List records for a table in a snapshot"""
    return SnapshotApi.list_records(snapshot_id, table_id, cursor, take)

def bulk_update_records(snapshot_id: str, table_id: str, operations: List[RecordOperation]) -> None:
    """Bulk update records in a table"""
    dto = BulkUpdateRecordsDto(ops=operations)
    SnapshotApi.bulk_update_records(snapshot_id, table_id, dto)

def activate_view(snapshot_id: str, table_id: str, dto: CreateSnapshotTableViewDto) -> str:
    """Activate a view for a table in a snapshot"""
    return SnapshotApi.activate_view(snapshot_id, table_id, dto)

def list_views(snapshot_id: str, table_id: str) -> List[SnapshotTableView]:
    """List all views for a table in a snapshot"""
    return SnapshotApi.list_views(snapshot_id, table_id)

def delete_view(snapshot_id: str, table_id: str, view_id: str) -> None:
    """Delete a view for a table in a snapshot"""
    SnapshotApi.delete_view(snapshot_id, table_id, view_id)

def get_view(snapshot_id: str, table_id: str, view_id: str) -> SnapshotTableView:
    """Get a specific view for a table in a snapshot"""
    return SnapshotApi.get_view(snapshot_id, table_id, view_id)

def clear_active_view(snapshot_id: str, table_id: str) -> None:
    """Clear the active view for a table in a snapshot (revert to default view)"""
    SnapshotApi.clear_active_view(snapshot_id, table_id)

def check_server_health() -> bool:
    """Check if the Scratchpad server is healthy"""
    try:
        url = API_CONFIG.get_api_server_health_url()
        response = requests.get(url, timeout=5)
        return response.ok
    except Exception:
        return False 