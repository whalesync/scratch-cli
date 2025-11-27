import { SnapshotRecord } from '@/types/server-entities/workbook';
import { Box, Text } from '@mantine/core';
import { ChangeObject, diffWordsWithSpace } from 'diff';
import { FC } from 'react';

type IdValueWrapperProps = {
  record?: SnapshotRecord;
};

export const IdValueWrapper: FC<IdValueWrapperProps> = ({ record }) => {
  // Calculate line colors
  let topColor = 'transparent';
  let bottomColor = 'transparent';
  let topBoxShadow = 'none';
  let bottomBoxShadow = 'none';

  if (record) {
    let hasAnyAdditions = false;
    let hasAnyDeletions = false;
    let hasAnyEdits = false;

    // Check for suggestions
    if (record.__suggested_values) {
      Object.entries(record.__suggested_values).forEach(([fieldId, suggestedValue]) => {
        // Get current value from record.fields (where the actual field data is stored)
        const currentValue = record.fields?.[fieldId];
        // We don't have column defs here so we do a raw string comparison
        const changes = diffWordsWithSpace(String(currentValue ?? ''), String(suggestedValue ?? ''));
        if (changes.some((c: ChangeObject<unknown>) => c.added)) hasAnyAdditions = true;
        if (changes.some((c: ChangeObject<unknown>) => c.removed)) hasAnyDeletions = true;
      });
    }

    // Check for edits
    if (record.__edited_fields && Object.keys(record.__edited_fields).length > 0) {
      hasAnyEdits = true;
    }

    // Determine colors based on logic:
    // Green (Top): Active if any field has suggested additions
    if (hasAnyAdditions) {
      topColor = 'var(--fg-added)';
      topBoxShadow = '0 0 0 1px var(--bg-added)';
    } else if (hasAnyEdits) {
      topColor = 'black';
      topBoxShadow = '0 0 0 1px rgba(0, 0, 0, 0.2)';
    }

    // Red (Bottom): Active if any field has suggested deletions
    if (hasAnyDeletions) {
      bottomColor = 'var(--fg-removed)';
      bottomBoxShadow = '0 0 0 1px var(--bg-removed)';
    } else if (hasAnyEdits) {
      bottomColor = 'black';
      bottomBoxShadow = '0 0 0 1px rgba(0, 0, 0, 0.2)';
    }
  }

  return (
    <Box display="flex" h="100%" className="field-value-wrapper">
      {/* Lines stacked vertically on the left */}
      <Box
        display="flex"
        style={{
          flexDirection: 'column',
          alignSelf: 'center',
          height: '60%',
          gap: '2px',
          marginRight: '4px',
        }}
      >
        <Box
          style={{
            width: '2px',
            flex: 1,
            backgroundColor: topColor,
            boxShadow: topBoxShadow,
          }}
        />
        <Box
          style={{
            width: '2px',
            flex: 1,
            backgroundColor: bottomColor,
            boxShadow: bottomBoxShadow,
          }}
        />
      </Box>

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
        className="field-value-content"
      >
        <Box display="flex" h="100%" style={{ alignItems: 'center' }}>
          <Text className="cell-text">{String(record?.id?.remoteId)}</Text>
        </Box>
      </Box>
    </Box>
  );
};
