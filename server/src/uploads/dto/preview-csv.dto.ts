export type CsvPreviewRow =
  | {
      type: 'success';
      values: string[];
    }
  | {
      type: 'error';
      error: string[];
    };

export class PreviewCsvResponseDto {
  rows: CsvPreviewRow[];
}
