export * from './csv-row-meta-columns';
export * from './snapshot-record-meta-columns';

import { CSV_META_COLUMNS } from './csv-row-meta-columns';
import { SNAPSHOT_META_COLUMNS } from './snapshot-record-meta-columns';

export const RESERVED_COLUMN_NAMES = [...CSV_META_COLUMNS, ...SNAPSHOT_META_COLUMNS];
