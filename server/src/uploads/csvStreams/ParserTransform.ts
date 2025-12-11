import { CsvAdvancedSettings } from '@spinner/shared-types';
import { Parser } from 'csv-parse';

export interface ParserOptions {
  relaxColumnCount?: boolean;
}

export class ParserTransform extends Parser {
  constructor(options: CsvAdvancedSettings) {
    super({
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: options.relaxColumnCount ?? true,
    });
  }
}
