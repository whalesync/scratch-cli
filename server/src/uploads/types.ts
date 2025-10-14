import { UploadId } from 'src/types/ids';

/**
 * Upload type enum (used internally)
 */
export enum UploadType {
  CSV = 'CSV',
  MD = 'MD',
}

/**
 * Upload entity
 */
export interface Upload {
  id: UploadId;
  userId: string;
  name: string;
  type: string; // UploadType as string
  typeId: string; // CSV table name or MD record id
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Markdown upload data (stored in MdUploads table)
 */
export interface MdUploadData {
  id: string; // MdUpload ID (same as typeId in Upload)
  PAGE_CONTENT: string; // The markdown content
  data: Record<string, unknown>; // Front matter as JSON
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CSV row data
 */
export interface CsvRow {
  wsId: string;
  [key: string]: unknown;
  createdAt?: Date;
}
