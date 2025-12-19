/* eslint-disable @typescript-eslint/no-unused-vars */
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { encodingForModel, Tiktoken, TiktokenModel } from 'js-tiktoken';
import { PersistedModelOption } from '../types/common';
import { SnapshotTable } from '@spinner/shared-types';

// Stats about how many tokens a list of records takes.
type TokenCountResult = {
  tokenCount: number;
  charCount: number;

  // Debugging:
  method: 'tiktoken' | 'estimate' | 'sampling' | 'empty_array' | 'missing_data';
  accuracy: 'estimate' | 'exact';
};

// Stats about our usage of the available context space.
export type TokenUsageStats = {
  tokens: TokenCountResult;
  avgTokensPerRecord: number;
  visibleRecords: number;
  visibleColumns: number;

  // Model limits:
  modelMaxTokens: number | null;

  // Combined limits:
  usagePercentage: number | null;
  maxRecordsFit: number;
};

// Cache encoding instances per model to avoid recreating them on every call
const encodingCache = new Map<string, Tiktoken>();

export function tokenUsageStats(
  model: PersistedModelOption,
  table: SnapshotTable,
  records: ProcessedSnapshotRecord[],
): TokenUsageStats {
  const recordTokenCount = calculateTokensForRecords(records, model.value);

  const usagePercentage = model.contextLength
    ? Math.round((recordTokenCount.tokenCount / model.contextLength) * 100)
    : null;
  const avgTokensPerRecord = records.length > 0 ? Math.round(recordTokenCount.tokenCount / records.length) : 0;

  return {
    tokens: recordTokenCount,
    avgTokensPerRecord,
    visibleRecords: records.length,
    visibleColumns: table.tableSpec.columns.length - table.hiddenColumns.length,

    // Model limits:
    modelMaxTokens: model.contextLength ?? null,

    // Combined limits:
    usagePercentage,
    maxRecordsFit: model.contextLength && avgTokensPerRecord ? Math.floor(model.contextLength / avgTokensPerRecord) : 0,
  };
}

/**
 * Count tokens for a list of records by JSON stringifying them
 * TODO: This is super inefficient. We should probably calculate tokens ONCE per field
 * on the server when it changes and then just aggregate the tokens here
 * Or at least not clone them to just remove the __processed_fields (but that is cheaper compared to tokanization)
 */
function calculateTokensForRecords(records: ProcessedSnapshotRecord[], model: string): TokenCountResult {
  if (!records) return { tokenCount: 0, charCount: 0, method: 'missing_data', accuracy: 'exact' };
  if (records.length === 0) return { tokenCount: 0, charCount: 0, method: 'empty_array', accuracy: 'exact' };
  const [provider, modelName] = model.split('/');
  const encoding = provider === 'openai' ? getEncoding(provider, modelName) : null;
  // Clone records and remove __processed_fields to avoid counting them
  const cleanRecords = records.map((r) => {
    const { __processed_fields, ...rest } = r;
    return rest;
  });
  const allRecordsStringified = JSON.stringify(cleanRecords);
  if (!encoding) {
    return {
      tokenCount: estimateTokens(allRecordsStringified),
      charCount: allRecordsStringified.length,
      method: 'estimate',
      accuracy: 'estimate',
    };
  }
  // For small arrays, use exact tiktoken counting
  if (records.length <= 10) {
    const encoded = encoding.encode(JSON.stringify(cleanRecords));
    return {
      tokenCount: encoded.length,
      charCount: allRecordsStringified.length,
      method: 'tiktoken',
      accuracy: 'exact',
    };
  }
  // For large arrays, use sampling strategy
  // Sample 10 records relatively equally spaced
  const sampleSize = 10;
  const sampledRecords: unknown[] = [];
  const step = (cleanRecords.length - 1) / (sampleSize - 1);
  for (let i = 0; i < sampleSize; i++) {
    const index = Math.round(i * step);
    sampledRecords.push(cleanRecords[index]);
  }
  // Calculate tokens for the sample
  const sampleJsonStr = JSON.stringify(sampledRecords);
  const sampleEncoded = encoding.encode(sampleJsonStr);
  const sampleTokens = sampleEncoded.length;
  // Calculate tokens for all records
  const allLength = allRecordsStringified.length;
  const sampleLength = sampleJsonStr.length;
  // Extrapolate: tokens for all = (tokens for sample) * (length of all) / (length of sample)
  const estimatedTokens = Math.round((sampleTokens * allLength) / sampleLength);
  return { tokenCount: estimatedTokens, charCount: allLength, method: 'sampling', accuracy: 'estimate' };
  // return { tokenCount: 0, charCount: 0, method: 'sampling', accuracy: 'estimate' };
}

/**
 * Get or create a cached encoding for a model
 */
function getEncoding(provider: string, modelName: string): Tiktoken | null {
  if (!provider || provider != 'openai' || !modelName) return null;

  // Check cache first
  if (encodingCache.has(modelName)) {
    return encodingCache.get(modelName)!;
  }

  try {
    const encoding = encodingForModel(modelName as TiktokenModel);
    encodingCache.set(modelName, encoding);
    return encoding;
  } catch (error) {
    console.warn('Failed to get encoding for model:', error);
    return null;
  }
}

/**
 * Simple token estimation function
 * Uses the heuristic: word_count * 1.3
 *
 * This is a rough approximation based on empirical observations.
 * For more accurate counts, consider using a proper tokenizer like tiktoken.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Split on whitespace and count words
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;

  // Apply 1.3 multiplier and round up
  return Math.ceil(wordCount * 1.3);
}

/**
 * Format token count with K/M suffix
 * Examples: 1234 -> "1.2K", 1234567 -> "1.2M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  } else {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
}
