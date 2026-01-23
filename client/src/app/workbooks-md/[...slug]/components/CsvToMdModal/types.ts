import type { FileId, FolderId, WorkbookId } from '@spinner/shared-types';

export type { CsvColumnInfo, ParsedCsv, MarkdownPreview } from './csv-utils';

/**
 * User's column selections for CSV to MD conversion
 */
export interface CsvConversionConfig {
  includedColumns: string[];
  nameColumn: string;
  contentColumns: string[]; // ordered
}

/**
 * Modal step states
 */
export type ModalStep =
  | 'loading'
  | 'error'
  | 'select-columns'
  | 'select-name'
  | 'select-content'
  | 'order-content'
  | 'preview'
  | 'creating';

/**
 * Props for the main CsvToMdModal component
 */
export interface CsvToMdModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
  fileId: FileId;
  fileName: string;
  parentFolderId: FolderId | null;
  onSuccess: () => void;
}

/**
 * Common props for step components
 */
export interface StepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Props for SelectColumnsStep
 */
export interface SelectColumnsStepProps extends StepProps {
  columns: import('./csv-utils').CsvColumnInfo[];
  selectedColumns: string[];
  onSelectionChange: (columns: string[]) => void;
}

/**
 * Props for SelectNameColumnStep
 */
export interface SelectNameColumnStepProps extends StepProps {
  columns: import('./csv-utils').CsvColumnInfo[];
  includedColumns: string[];
  selectedColumn: string;
  onSelectionChange: (column: string) => void;
}

/**
 * Props for SelectContentStep
 */
export interface SelectContentStepProps extends StepProps {
  columns: import('./csv-utils').CsvColumnInfo[];
  includedColumns: string[];
  nameColumn: string;
  selectedColumns: string[];
  onSelectionChange: (columns: string[]) => void;
}

/**
 * Props for OrderContentStep
 */
export interface OrderContentStepProps extends StepProps {
  contentColumns: string[];
  onOrderChange: (columns: string[]) => void;
}

/**
 * Props for PreviewStep
 */
export interface PreviewStepProps extends StepProps {
  previews: import('./csv-utils').MarkdownPreview[];
  totalRows: number;
  folderName: string;
}
