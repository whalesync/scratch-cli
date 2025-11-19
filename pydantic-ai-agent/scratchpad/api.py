from typing import Dict, List, Optional, Any
import requests
from logging import getLogger

from scratchpad.config import API_CONFIG
from scratchpad.entities import (
    AgentCredential,
    ColumnView,
    RecordOperation,
    ScratchpadWorkbook,
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
    def get_workbook(user_id: str, workbook_id: str) -> ScratchpadWorkbook:
        """Get workbook details"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}"
        response = requests.get(
            url,
            headers=API_CONFIG.get_api_headers(user_id),
        )
        data = _handle_response(response, "Failed to fetch workbook")
        return ScratchpadWorkbook(**data)

    @staticmethod
    def list_records_for_ai(
        user_id: str,
        workbook_id: str,
        table_id: str,
        cursor: Optional[str] = None,
        take: Optional[int] = None,
    ) -> ListRecordsResponse:
        """List records for a table in a snapshot for AI processing"""
        url = f"{API_CONFIG.get_api_url()}/ai-snapshot/{workbook_id}/tables/{table_id}/records/active-view"
        params = {}
        if cursor:
            params["cursor"] = cursor
        # if take:
        #     params["take"] = str(take)

        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), params=params
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
        user_id: str, workbook_id: str, table_id: str, record_id: str
    ) -> SnapshotRecord:
        """Get a single record from a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/records/{record_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get record")
        return build_snapshot_record(data)

    @staticmethod
    def get_records_by_ids(
        user_id: str, workbook_id: str, table_id: str, record_ids: List[str]
    ) -> List[SnapshotRecord]:
        """Get multiple records by their IDs from a table in a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/ai-snapshot/{workbook_id}/tables/{table_id}/records/by-ids"
        body = {"recordIds": record_ids}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=body
        )
        data = _handle_response(response, "Failed to get records by IDs")

        # Convert raw record dictionaries to SnapshotRecord objects
        records = []
        for record_dict in data.get("records", []):
            records.append(build_snapshot_record(record_dict))

        return records

    @staticmethod
    def bulk_suggest_record_updates(
        user_id: str,
        workbook_id: str,
        table_id: str,
        operations: List[RecordOperation],
    ) -> None:
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/records/bulk-suggest"
        params = {}

        # Build operation payload - only include wsId if it exists (not needed for create operations)
        ops_payload = {"creates": [], "updates": [], "deletes": [], "undeletes": []}
        for op in operations:
            op_dict = {"op": op.op}
            if op.wsId is not None:
                op_dict["wsId"] = op.wsId
            if op.data is not None:
                op_dict["data"] = op.data
            if op.op == "create":
                ops_payload["creates"].append(op_dict)
            elif op.op == "update":
                ops_payload["updates"].append(op_dict)
            elif op.op == "delete":
                ops_payload["deletes"].append(op_dict)
            elif op.op == "undelete":
                ops_payload["undeletes"].append(op_dict)

        logger.debug(f"Bulk update records payload: {ops_payload}")

        response = requests.post(
            url,
            headers=API_CONFIG.get_api_headers(user_id),
            json=ops_payload,
            params=params,
        )

        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to bulk update records: {response.status_code} - {response.text}"
            )

    @staticmethod
    def add_records_to_active_filter(
        user_id: str, workbook_id: str, table_id: str, record_ids: List[str]
    ) -> None:
        """Add records to the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/add-records-to-active-filter"
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
        user_id: str, workbook_id: str, table_id: str, sql_where_clause: Optional[str]
    ) -> None:
        """Set the active records filter for a table using SQL WHERE clause (replaces existing filter)"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/set-active-records-filter"
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
        user_id: str, workbook_id: str, table_id: str
    ) -> None:
        """Clear the active record filter for a table"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/clear-active-record-filter"
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
    def get_agent_credentials_by_service(
        user_id: str, service: str
    ) -> Optional[AgentCredential]:
        """Get agent credentials by service"""
        url = f"{API_CONFIG.get_api_url()}/user/credentials/active/{service}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))

        if not response.ok and response.status_code == 404:
            # 404 means no credentials found
            return None

        data = _handle_response(response, "Failed to get agent credentials")
        return AgentCredential(**data) if data else None

    @staticmethod
    def get_agent_credentials_by_id(
        user_id: str,
        credential_id: str,
    ) -> Optional[AgentCredential]:
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
    def get_agent_session(user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """Get an agent session by session ID"""
        url = f"{API_CONFIG.get_api_url()}/agent-sessions/{session_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))

        if not response.ok and response.status_code == 404:
            # 404 means no session found
            return None

        data = _handle_response(response, "Failed to get agent session")
        return data

    @staticmethod
    def save_agent_session(
        user_id: str, session_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save an agent session (upsert)"""
        url = f"{API_CONFIG.get_api_url()}/agent-sessions/{session_id}/upsert"
        payload = {"data": data}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        data = _handle_response(response, "Failed to save agent session")
        return data

    @staticmethod
    def delete_agent_session(user_id: str, session_id: str) -> None:
        """Delete an agent session"""
        url = f"{API_CONFIG.get_api_url()}/agent-sessions/{session_id}"
        response = requests.delete(url, headers=API_CONFIG.get_api_headers(user_id))
        _handle_response(response, "Failed to delete agent session")

    @staticmethod
    def list_agent_sessions_by_user(user_id: str) -> List[Dict[str, Any]]:
        """List all agent sessions for a user"""
        url = f"{API_CONFIG.get_api_url()}/agent-sessions/user/{user_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to list agent sessions by user")
        return data

    @staticmethod
    def list_agent_sessions_by_snapshot(
        user_id: str, workbook_id: str
    ) -> List[Dict[str, Any]]:
        """List all agent sessions for a snapshot"""
        url = f"{API_CONFIG.get_api_url()}/agent-sessions/workbook/{workbook_id}"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to list agent sessions by snapshot")
        return data

    @staticmethod
    def get_upload_content(user_id: str, upload_id: str) -> Dict[str, Any]:
        """Get upload content by upload ID"""
        url = f"{API_CONFIG.get_api_url()}/uploads/md/{upload_id}/data"
        response = requests.get(url, headers=API_CONFIG.get_api_headers(user_id))
        data = _handle_response(response, "Failed to get upload content")
        return data

    @staticmethod
    def add_scratch_column(
        user_id: str, workbook_id: str, table_id: str, column_name: str, data_type: str
    ) -> None:
        """Add a scratch column to a table"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/add-scratch-column"
        payload = {"columnName": column_name, "dataType": data_type}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to add scratch column: {response.status_code} - {response.text}"
            )

    @staticmethod
    def remove_scratch_column(
        user_id: str, workbook_id: str, table_id: str, column_id: str
    ) -> None:
        """Remove a scratch column from a table"""
        url = f"{API_CONFIG.get_api_url()}/workbook/{workbook_id}/tables/{table_id}/remove-scratch-column"
        payload = {"columnId": column_id}
        response = requests.post(
            url, headers=API_CONFIG.get_api_headers(user_id), json=payload
        )
        if not response.ok:
            raise ScratchpadApiError(
                f"Failed to remove scratch column: {response.status_code} - {response.text}"
            )
