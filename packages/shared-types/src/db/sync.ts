import { SyncState } from '../enums/enums';
import { DataFolderId, SyncId } from '../ids';
import { SyncMapping } from '../sync';

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma Sync model
/// Begin "keep in sync" section
///

export interface Sync {
  id: SyncId;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  displayOrder: number;
  sourceDataFolderId: DataFolderId;
  destinationDataFolderId: DataFolderId;
  mappings: SyncMapping;
  syncState: SyncState;
  syncStateLastChanged: string | null;
  lastSyncTime: string | null;
}

///
/// End "keep in sync" section
///
