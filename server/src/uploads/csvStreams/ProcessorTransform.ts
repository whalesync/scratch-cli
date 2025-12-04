import { createCsvFileRecordId } from '@spinner/shared-types';
import { Transform, TransformCallback } from 'stream';

export class ProcessorTransform extends Transform {
  private recordCount = 0;
  private rowIndex = 0;
  private isFirstRow = true;

  constructor(
    private readonly firstRowIsHeader: boolean,
    private readonly columnIndices: number[],
  ) {
    super({ objectMode: true });
  }

  _transform(chunk: string[], encoding: BufferEncoding, callback: TransformCallback) {
    try {
      const currentIndex = this.rowIndex++;

      // Skip header row if firstRowIsHeader is true
      if (this.firstRowIsHeader && this.isFirstRow) {
        this.isFirstRow = false;
        callback();
        return;
      }

      // Extract only the columns we want to keep, using the original indices
      // This handles IGNORE columns by skipping them at the correct positions
      const filteredRecord = this.columnIndices.map((originalIndex) => {
        return chunk[originalIndex] !== undefined ? chunk[originalIndex] : '';
      });

      // Generate a unique remoteId for this record (CSV upload table represents the remote source)
      const remoteId = createCsvFileRecordId();

      // Create the full record with remoteId as first column, then index, then the filtered data columns
      const fullRecord = [remoteId, currentIndex, ...filteredRecord];

      this.recordCount++;

      // Pass the processed record through to the next stream
      callback(null, fullRecord);
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getRecordCount(): number {
    return this.recordCount;
  }
}
