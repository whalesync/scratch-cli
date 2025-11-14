import { Transform, TransformCallback } from 'stream';

export class FormatterTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: string[], encoding: BufferEncoding, callback: TransformCallback) {
    try {
      // Convert to CSV format for COPY
      const csvRow = chunk
        .map((field) => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const escaped = String(field).replace(/"/g, '""');
          if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
            return `"${escaped}"`;
          }
          return escaped;
        })
        .join(',');

      callback(null, csvRow + '\n');
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
