import { formatFieldValue, SnapshotRecord } from '@/types/server-entities/workbook';
import { ColumnSpec } from '@spinner/shared-types';
import { ChangeObject, diffWordsWithSpace } from 'diff';

export type ProcessedFieldValue = {
  value: unknown;
  formattedValue: string;
  suggestedValue?: unknown;
  changes: ChangeObject<string>[] | null;
  existingChangeTypes: ExistingChangeTypes;
};

export type ExistingChangeTypes = {
  suggestedAdditions?: boolean;
  suggestedDeletions?: boolean;
  acceptedAdditions?: boolean;
  acceptedDeletions?: boolean;
};

export const hasAnyChange = (existingChangeTypes: ExistingChangeTypes) => {
  return (
    existingChangeTypes.suggestedAdditions ||
    existingChangeTypes.suggestedDeletions ||
    existingChangeTypes.acceptedAdditions ||
    existingChangeTypes.acceptedDeletions
  );
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
    existingChangeTypes.acceptedAdditions = true;
    existingChangeTypes.acceptedDeletions = true;
  }

  let changes: ChangeObject<string>[] | null = null;

  if (suggestedValue) {
    changes = diffWordsWithSpace(formattedValue, String(suggestedValue));
    const hasSuggestedAdditions = changes.some((change) => change.added);
    const hassuggestedDeletions = changes.some((change) => change.removed);
    if (hasSuggestedAdditions) {
      existingChangeTypes.suggestedAdditions = true;
    }
    if (hassuggestedDeletions) {
      existingChangeTypes.suggestedDeletions = true;
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
    existingChangeTypes.acceptedAdditions = true;
    existingChangeTypes.acceptedDeletions = true;
  }

  if (suggestedValue) {
    const changes = diffWordsWithSpace(formattedValue, String(suggestedValue));
    const hasSuggestedAdditions = changes.some((change) => change.added);
    const hassuggestedDeletions = changes.some((change) => change.removed);
    if (hasSuggestedAdditions) {
      existingChangeTypes.suggestedAdditions = true;
    }
    if (hassuggestedDeletions) {
      existingChangeTypes.suggestedDeletions = true;
    }
  }
  return existingChangeTypes;
};

export const getChangeTypeColors = (existingChangeTypes: ExistingChangeTypes) => {
  const additionColor = existingChangeTypes.suggestedAdditions
    ? 'var(--fg-added)'
    : existingChangeTypes.acceptedAdditions
      ? 'var(--fg-muted)'
      : 'transparent';
  const additionShadowColor = existingChangeTypes.suggestedAdditions
    ? 'var(--bg-added)'
    : existingChangeTypes.acceptedAdditions
      ? 'color-mix(in srgb, var(--fg-muted) 40%, transparent)'
      : 'transparent';

  const deletionColor = existingChangeTypes.suggestedDeletions
    ? 'var(--fg-removed)'
    : existingChangeTypes.acceptedDeletions
      ? 'var(--fg-muted)'
      : 'transparent';
  const deletionShadowColor = existingChangeTypes.suggestedDeletions
    ? 'var(--bg-removed)'
    : existingChangeTypes.acceptedDeletions
      ? 'color-mix(in srgb, var(--fg-muted) 40%, transparent)'
      : 'transparent';

  return {
    additionColor,
    additionShadow: `0 0 0 1px ${additionShadowColor}`,
    deletionColor,
    deletionShadow: `0 0 0 1px ${deletionShadowColor}`,
  };
};
