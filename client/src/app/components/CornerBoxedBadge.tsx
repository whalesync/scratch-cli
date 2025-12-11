'use client';

import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { CloseButton, Group, Text, Tooltip } from '@mantine/core';
import { ReactNode } from 'react';
import styles from './CornerBoxedBadge.module.css';

export const CornerBoxedBadge = ({
  label,
  tooltip,
  tooltipAlwaysVisible,
  icon,
  onClose,
  onClick,
}: {
  label: ReactNode;
  tooltip?: React.ReactNode;
  tooltipAlwaysVisible?: boolean;
  icon?: React.ReactNode;
  onClose?: () => void;
  onClick?: () => void;
}) => {
  const content = (
    <Group
      gap={4}
      wrap="nowrap"
      className={`${customBordersClasses.cornerBorders} ${styles.badge}`}
      align="center"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {icon}
      {typeof label === 'string' ? (
        <Text fz="12px" lh={1} c="gray.9">
          {label}
        </Text>
      ) : (
        label
      )}

      {onClose && (
        <CloseButton
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        />
      )}
    </Group>
  );

  // Always render Tooltip to maintain consistent hook count, but conditionally show it
  return (
    <Tooltip
      data-onboarding-tooltip
      label={tooltip}
      opened={tooltip && tooltipAlwaysVisible ? true : undefined}
      data-always-dark
      disabled={!tooltip}
    >
      {content}
    </Tooltip>
  );
};
