export type CsvPreviewRow =
  | {
      type: 'success';
      values: string[];
    }
  | {
      type: 'error';
      error: string[];
    };

export type PreviewCsvResponseDto = {
  rows: CsvPreviewRow[];
};
