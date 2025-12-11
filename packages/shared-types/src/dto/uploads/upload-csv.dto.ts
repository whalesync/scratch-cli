import { PostgresColumnType } from '../../connector-types';

export interface CsvAdvancedSettings {
  relaxColumnCount?: boolean;
}

export type UploadCsvDto = {
  uploadName: string;
  columnNames: string[];
  columnTypes: PostgresColumnType[];
  columnIndices: number[]; // Original column indices in the CSV (for handling IGNORE columns)
  firstRowIsHeader: boolean;
  advancedSettings: CsvAdvancedSettings;
};

export class UploadCsvResponseDto {
  uploadId?: string;
  tableId?: string;
  rowCount?: number;
}
