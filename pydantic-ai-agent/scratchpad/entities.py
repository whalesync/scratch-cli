from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from logging import getLogger

logger = getLogger(__name__)


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
    ignoredColumns: List[str]
    readOnlyColumns: List[str]


@dataclass
class SnapshotColumnSettings:
    dataConverter: Optional[str] = None


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
class SnapshotTable:
    id: str
    createdAt: str
    updatedAt: str
    workbookId: str
    connectorAccountId: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    tableSpec: TableSpec
    tableContext: Optional[TableContext]
    columnSettings: Optional[Dict[str, SnapshotColumnSettings]] = None
    activeRecordSqlFilter: Optional[str] = None
    hiddenColumns: Optional[List[str]] = None
    pageSize: Optional[int] = None
    hidden: Optional[bool] = None
    syncInProgress: Optional[bool] = None
    hiddenColumns: Optional[List[str]] = None


@dataclass
class ScratchpadWorkbook:
    id: str
    name: Optional[str]
    createdAt: str
    updatedAt: str
    userId: str
    organizationId: str
    snapshotTables: Optional[List[SnapshotTable]] = None


@dataclass
class CreateWorkbookDto:
    connectorAccountId: str
    tableIds: List[EntityId]


@dataclass
class RecordOperation:
    op: str  # "create" | "update" | "delete" | "undelete"
    wsId: Optional[str] = (
        None  # Required for update/delete/undelete, not used for create
    )
    data: Optional[Dict[str, Any]] = None


@dataclass
class BulkUpdateRecordsDto:
    ops: List[RecordOperation]


@dataclass
class ListRecordsResponse:
    records: List[SnapshotRecord]
    nextCursor: Optional[str] = None
    prevCursor: Optional[str] = None
    count: int = 0
    filteredCount: int = 0
    startIndex: Optional[int] = None
    endIndex: Optional[int] = None
    # Deprecated field for backwards compatibility
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


@dataclass
class AgentCredential:
    id: str
    userId: str
    service: str
    apiKey: str
    label: str
    name: str
    createdAt: str
    updatedAt: str
    source: str
    default: bool
    metadata: Optional[Dict[str, Any]] = None
    tokenUsageWarningLimit: Optional[int] = None


@dataclass
class ViewColumnConfig:
    wsId: str
    hidden: Optional[bool]
    protected: Optional[bool]


@dataclass
class ViewTableConfig:
    hidden: Optional[bool]
    protected: Optional[bool]
    columns: List[ViewColumnConfig]


@dataclass
class ColumnView:
    id: str
    name: Optional[str]
    workbookId: str
    config: Dict[str, ViewTableConfig]  # ViewConfig type from TypeScript
    createdAt: str
    updatedAt: str
