import { SnapshotRecord } from '@/types/server-entities/workbook';
import { Box, Text } from '@mantine/core';
import { ChangeObject, diffWordsWithSpace } from 'diff';
import { FC } from 'react';
import { ChangeLinesStack } from './ChangeLinesStack/ChangeLinesStack';
import { ExistingChangeTypes } from './ProcessedFieldValue';
type IdValueWrapperProps = {
  record?: SnapshotRecord;
};

export const IdValueWrapper: FC<IdValueWrapperProps> = ({ record }) => {
  const existingChangeTypes: ExistingChangeTypes = {};
  const backgroundColor = record?.__edited_fields?.__deleted ? 'var(--bg-removed)' : 'transparent';

  if (record) {
    // Check for suggestions
    if (record.__suggested_values) {
      Object.entries(record.__suggested_values).forEach(([fieldId, suggestedValue]) => {
        // Get current value from record.fields (where the actual field data is stored)
        const currentValue = record.fields?.[fieldId];
        // We don't have column defs here so we do a raw string comparison
        const changes = diffWordsWithSpace(String(currentValue ?? ''), String(suggestedValue ?? ''));
        if (changes.some((c: ChangeObject<unknown>) => c.added)) existingChangeTypes.hasSuggestedAdditions = true;
        if (changes.some((c: ChangeObject<unknown>) => c.removed)) existingChangeTypes.hasSuggestedDeletions = true;
      });
    }

    // Check for edits
    if (record.__edited_fields && Object.keys(record.__edited_fields).length > 0) {
      existingChangeTypes.hasAcceptedAdditions = true;
      existingChangeTypes.hasAcceptedDeletions = true;
    }
  }

  return (
    <Box display="flex" h="100%" className="field-value-wrapper" style={{ backgroundColor, overflow: 'hidden' }}>
      {/* Lines stacked vertically on the left */}
      <ChangeLinesStack changeTypes={existingChangeTypes} />

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <Text className="cell-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(record?.id?.remoteId)}
        </Text>
      </Box>
    </Box>
  );
};
