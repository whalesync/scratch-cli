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
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
class Snapshot:
    id: str
    createdAt: str
    updatedAt: str
    connectorAccountId: str
    tables: List[TableSpec]

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
    records: List[Dict[str, Any]]  # SnapshotRecord[]
    nextCursor: Optional[str] = None

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
    def list_records(snapshot_id: str, table_id: str, cursor: Optional[str] = None, take: Optional[int] = None) -> ListRecordsResponse:
        """List records for a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records"
        params = {}
        if cursor:
            params["cursor"] = cursor
        if take:
            params["take"] = str(take)
        
        response = requests.get(url, headers=API_CONFIG.get_api_headers(), params=params)
        data = _handle_response(response, "Failed to list records")
        return ListRecordsResponse(**data)
    
    @staticmethod
    def bulk_update_records(snapshot_id: str, table_id: str, dto: BulkUpdateRecordsDto) -> None:
        """Bulk update records in a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/bulk"
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
        _handle_response(response, "Failed to bulk update records")

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

def check_server_health() -> bool:
    """Check if the Scratchpad server is healthy"""
    try:
        url = API_CONFIG.get_api_server_health_url()
        response = requests.get(url, timeout=5)
        return response.ok
    except Exception:
        return False 