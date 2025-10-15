import { PostgresColumnType } from 'src/remote-service/connectors/types';

export class UploadCsvDto {
  uploadName: string;
  columnNames: string[];
  columnTypes: PostgresColumnType[];
  columnIndices: number[]; // Original column indices in the CSV (for handling IGNORE columns)
  firstRowIsHeader: boolean;
}

export class UploadCsvResponseDto {
  uploadId: string;
  tableId: string;
  rowCount: number;
}
