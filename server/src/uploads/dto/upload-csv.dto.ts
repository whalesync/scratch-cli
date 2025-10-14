import { PostgresColumnType } from 'src/remote-service/connectors/types';

export class UploadCsvDto {
  uploadName: string;
  columnNames: string[];
  columnTypes: PostgresColumnType[];
  firstRowIsHeader: boolean;
}

export class UploadCsvResponseDto {
  uploadId: string;
  tableId: string;
  rowCount: number;
}
