import { EntityId } from 'src/remote-service/connectors/types';

/**
 * Persitant configuration for a table within a snapshot that is shared between the UI and the AI agent.
 * Defines how the table can be used in the context and how it should be displayed.
 */
export type SnapshotTableContext = {
  // The id of the table in the snapshot.
  id: EntityId;

  activeViewId: string | null;

  // Columns that should not be considered in the context for the AI agent
  ignoredColumns: string[];

  // Columns that should be read only in the UI.
  readOnlyColumns: string[];
};

// TODO - find a better place for this to live
export type SnapshotTableViewConfig = {
  ids: string[]; // wsIds of the records to include in the view
};
