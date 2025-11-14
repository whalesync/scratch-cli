import { PostgresColumnType } from 'src/remote-service/connectors/types';

export interface CsvAdvancedSettings {
  relaxColumnCount?: boolean;
}

export class UploadCsvDto {
  uploadName: string;
  columnNames: string[];
  columnTypes: PostgresColumnType[];
  columnIndices: number[]; // Original column indices in the CSV (for handling IGNORE columns)
  firstRowIsHeader: boolean;
  advancedSettings: CsvAdvancedSettings;
}

export class UploadCsvResponseDto {
  uploadId: string;
  tableId: string;
  rowCount: number;
}
