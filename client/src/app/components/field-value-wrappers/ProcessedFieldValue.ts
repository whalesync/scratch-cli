import { ColumnSpec, formatFieldValue, SnapshotRecord } from '@/types/server-entities/workbook';
import { ChangeObject, diffWordsWithSpace } from 'diff';

export type ProcessedFieldValue = {
  value: unknown;
  existingChangeTypes: ExistingChangeTypes;
  formattedValue: string;
  suggestedValue?: unknown;
  changes: ChangeObject<string>[] | null;
};

export type ExistingChangeTypes = {
  hasSuggestedAdditions?: boolean;
  hasSuggestedDeletions?: boolean;
  hasAcceptedAdditions?: boolean;
  hasAcceptedDeletions?: boolean;
};

export const processFieldValue = (
  value: unknown,
  record: SnapshotRecord,
  columnDef: ColumnSpec,
): ProcessedFieldValue => {
  const formattedValue = formatFieldValue(value, columnDef);
  const suggestedValue = record?.__suggested_values?.[columnDef.id.wsId];
  const existingChangeTypes = getExistingChangeTypes(value, record, columnDef);

  if (record?.__edited_fields?.[columnDef.id.wsId]) {
    existingChangeTypes.hasAcceptedAdditions = true;
    existingChangeTypes.hasAcceptedDeletions = true;
  }

  let changes: ChangeObject<string>[] | null = null;

  if (suggestedValue) {
    changes = diffWordsWithSpace(formattedValue, String(suggestedValue));
    const hasSuggestedAdditions = changes.some((change) => change.added);
    const hassuggestedDeletions = changes.some((change) => change.removed);
    if (hasSuggestedAdditions) {
      existingChangeTypes.hasSuggestedAdditions = true;
    }
    if (hassuggestedDeletions) {
      existingChangeTypes.hasSuggestedDeletions = true;
    }
  }

  return {
    value,
    changes,
    formattedValue,
    suggestedValue,
    existingChangeTypes,
  };
};

export const getExistingChangeTypes = (value: unknown, record: SnapshotRecord, columnDef: ColumnSpec) => {
  const formattedValue = formatFieldValue(value, columnDef);
  const suggestedValue = record?.__suggested_values?.[columnDef.id.wsId];
  const existingChangeTypes: ExistingChangeTypes = {};
  if (record?.__edited_fields?.[columnDef.id.wsId]) {
    existingChangeTypes.hasAcceptedAdditions = true;
    existingChangeTypes.hasAcceptedDeletions = true;
  }

  if (suggestedValue) {
    const changes = diffWordsWithSpace(formattedValue, String(suggestedValue));
    const hasSuggestedAdditions = changes.some((change) => change.added);
    const hassuggestedDeletions = changes.some((change) => change.removed);
    if (hasSuggestedAdditions) {
      existingChangeTypes.hasSuggestedAdditions = true;
    }
    if (hassuggestedDeletions) {
      existingChangeTypes.hasSuggestedDeletions = true;
    }
  }
  return existingChangeTypes;
};

export const getChangeTypeColors = (existingChangeTypes: ExistingChangeTypes) => {
  const additionColor = existingChangeTypes.hasSuggestedAdditions
    ? 'var(--fg-added)'
    : existingChangeTypes.hasAcceptedAdditions
      ? 'black'
      : 'transparent';
  const additionShadowColor = existingChangeTypes.hasSuggestedAdditions
    ? 'var(--bg-added)'
    : existingChangeTypes.hasAcceptedAdditions
      ? 'rgba(0, 0, 0, 0.2)'
      : 'transparent';

  const deletionColor = existingChangeTypes.hasSuggestedDeletions
    ? 'var(--fg-removed)'
    : existingChangeTypes.hasAcceptedDeletions
      ? 'black'
      : 'transparent';
  const deletionShadowColor = existingChangeTypes.hasSuggestedDeletions
    ? 'var(--bg-removed)'
    : existingChangeTypes.hasAcceptedDeletions
      ? 'rgba(0, 0, 0, 0.2)'
      : 'transparent';

  return {
    additionColor,
    additionShadow: `0 0 0 1px ${additionShadowColor}`,
    deletionColor,
    deletionShadow: `0 0 0 1px ${deletionShadowColor}`,
  };
};
