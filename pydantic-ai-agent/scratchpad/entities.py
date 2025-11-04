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
    activeViewId: Optional[str]
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
    snapshotId: str
    connectorAccountId: Optional[str]
    connectorDisplayName: Optional[str]
    connectorService: Optional[str]
    tableSpec: TableSpec
    tableContext: Optional[TableContext]
    columnContexts: Dict[str, SnapshotColumnSettings]
    activeRecordSqlFilter: Optional[str] = None


@dataclass
class ScratchpadSnapshot:
    id: str
    name: Optional[str]
    createdAt: str
    updatedAt: str
    userId: str
    organizationId: str
    columnContexts: Any
    snapshotTables: Optional[List[SnapshotTable]] = None


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


@dataclass
class AgentCredential:
    id: str
    userId: str
    service: str
    apiKey: str
    label: str
    description: str
    createdAt: str
    updatedAt: str
    source: str
    enabled: bool
    default: bool


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
    snapshotId: str
    config: Dict[str, ViewTableConfig]  # ViewConfig type from TypeScript
    createdAt: str
    updatedAt: str
