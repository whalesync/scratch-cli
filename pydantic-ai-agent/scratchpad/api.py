from typing import Dict, List, Optional, Any
import requests
from logging import getLogger

from scratchpad.config import API_CONFIG
from scratchpad.entities import (
    AgentCredential,
    BulkUpdateRecordsDto,
    ColumnView,
    RecordOperation,
    ScratchpadSnapshot,
    ListRecordsResponse,
    RecordId,
    SnapshotRecord,
)

logger = getLogger(__name__)


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


class ScratchpadApi:
    @staticmethod
    def get_snapshot(user_id: str, snapshot_id: str) -> ScratchpadSnapshot:
        """Get snapshot details"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}"
        response = requests.get(
            url,
            headers=API_CONFIG.get_api_headers(user_id),
        )
        data = _handle_response(response, "Failed to fetch snapshot")
        return ScratchpadSnapshot(**data)

    @staticmethod
    def list_records_for_ai(
        user_id: str,
        snapshot_id: str,
        table_id: str,
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
            url, headers=API_CONFIG.get_api_headers(user_id), params=params, json=body
        )
        data = _handle_response(response, "Failed to list records for AI")

        # Convert raw record dictionaries to SnapshotRecord objects
        records = []
        for i, record_dict in enumerate(data.get("records", [])):
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
            records.append(snapshot_record)

        result = ListRecordsResponse(
            records=records,
            nextCursor=data.get("nextCursor"),
            filteredRecordsCount=data.get("filteredRecordsCount", 0),
        )
        logger.info(
            f"🔍 Returning ListRecordsResponse with {len(result.records)} records of type {type(result.records[0]) if result.records else 'None'}"
        )
        return result

    @staticmethod
    def get_record(
        user_id: str, snapshot_id: str, table_id: str, record_id: str
    ) -> SnapshotRecord:
        """Get a single record from a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/{record_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get record")
        return build_snapshot_record(data)

    @staticmethod
    def bulk_update_records(
        user_id: str,
        snapshot_id: str,
        table_id: str,
        operations: List[RecordOperation],
        view_id: Optional[str] = None,
    ) -> None:
        """Bulk update records in a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/records/bulk-suggest"
        params = {}
        if view_id:
            params["viewId"] = view_id
        payload = {
            "ops": [
                {"op": op.op, "wsId": op.wsId, "data": op.data} for op in operations
            ]
        }
        response = requests.post(
            url,
            headers=API_CONFIG.get_api_headers(user_id),
            json=payload,
            params=params,
        )
        _handle_response(response, "Failed to bulk update records")

    @staticmethod
    def add_records_to_active_filter(
        user_id: str, snapshot_id: str, table_id: str, record_ids: List[str]
    ) -> None:
        """Add records to the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/add-records-to-active-filter"
        payload = {"recordIds": record_ids}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to add records to active filter: {response.status_code} - {response.text}"
            )

    @staticmethod
    def set_active_records_filter(
        user_id: str, snapshot_id: str, table_id: str, sql_where_clause: Optional[str]
    ) -> None:
        """Set the active records filter for a table using SQL WHERE clause (replaces existing filter)"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/set-active-records-filter"
        payload = {"sqlWhereClause": sql_where_clause}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to set active records filter: {response.status_code} - {response.text}"
            )

    @staticmethod
    def clear_active_record_filter(
        user_id: str, snapshot_id: str, table_id: str
    ) -> None:
        """Clear the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/snapshot/{snapshot_id}/tables/{table_id}/clear-active-record-filter"
        response = requests.post(url, headers=API_CONFIG.get_api_headers(user_id))
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to clear active record filter: {response.status_code} - {response.text}"
            )

    @staticmethod
    def get_agent_credentials(user_id: str) -> List[AgentCredential]:
        """Get agent credentials"""
        url = f"{API_CONFIG.get_api_url()}/user/credentials"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get agent credentials")
        return [AgentCredential(**credential) for credential in data]

    @staticmethod
    def get_agent_credentials_by_id(
        user_id: str,
        credential_id: str,
    ) -> AgentCredential:
        """Get agent credentials"""
        url = f"{API_CONFIG.get_api_url()}/user/credentials/{credential_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get agent credentials")
        return AgentCredential(**data) if data else None

    @staticmethod
    def track_token_usage(
        user_id: str,
        model: str,
        num_requests: int,
        request_tokens: int,
        response_tokens: int,
        total_tokens: int,
        usage_context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Get AI agent token usage events"""
        url = f"{API_CONFIG.get_api_url()}/agent-token-usage/track"
        payload = {
            "model": model,
            "requests": num_requests,
            "requestTokens": request_tokens,
            "responseTokens": response_tokens,
            "totalTokens": total_tokens,
            "context": usage_context,
        }
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        _handle_response(response, "Failed to track token usage")

    @staticmethod
    def get_column_view(user_id: str, view_id: str) -> ColumnView:
        """Get a specific column view by ID"""
        url = f"{API_CONFIG.get_api_url()}/views/{view_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get column view")
        return ColumnView(**data)
