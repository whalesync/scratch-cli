import { SnapshotRecord } from '@/types/server-entities/workbook';
import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { ChangeObject, diffWordsWithSpace } from 'diff';
import { Maximize2Icon } from 'lucide-react';
import { FC, useState } from 'react';
import { ChangeLinesStack } from '../ChangeLinesStack/ChangeLinesStack';
import { ExistingChangeTypes } from '../ProcessedFieldValue';
import styles from './FieldValueWrapper.module.css';
type IdValueWrapperProps = {
  record?: SnapshotRecord;
  onOpenOverlay?: () => void;
  isOverlayOpen?: boolean;
};

export const IdValueWrapper: FC<IdValueWrapperProps> = ({ record, onOpenOverlay, isOverlayOpen }) => {
  const [isHovered, setIsHovered] = useState(false);
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
        if (changes.some((c: ChangeObject<unknown>) => c.added)) existingChangeTypes.suggestedAdditions = true;
        if (changes.some((c: ChangeObject<unknown>) => c.removed)) existingChangeTypes.suggestedDeletions = true;
      });
    }

    // Check for edits
    if (record.__edited_fields && Object.keys(record.__edited_fields).length > 0) {
      existingChangeTypes.acceptedAdditions = true;
      existingChangeTypes.acceptedDeletions = true;
    }
  }

  return (
    <Group
      className={styles.idValueWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor }}
    >
      {/* Lines stacked vertically on the left */}
      <ChangeLinesStack changeTypes={existingChangeTypes} />

      <Box
        className={styles.fieldValueContentWrapper}
        style={{
          overflow: 'hidden',
        }}
      >
        <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(record?.id?.remoteId)}
        </Text>
      </Box>

      {/* Hover button */}
      {isHovered && onOpenOverlay && !isOverlayOpen && (
        <ActionIcon
          size="sm"
          variant="filled"
          onClick={(e) => {
            e.stopPropagation();
            onOpenOverlay();
          }}
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--mantine-color-gray-0)',
            color: 'var(--mantine-color-gray-7)',
          }}
        >
          <Maximize2Icon size={16} />
        </ActionIcon>
      )}
    </Group>
  );
};
