import { SnapshotRecord } from 'src/remote-service/connectors/types';

export interface PaginatedRecordsResponse {
  records: SnapshotRecord[];
  pagination: {
    total: number;
    filteredTotal: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  cursors: {
    next?: string;
    prev?: string;
  };
}
