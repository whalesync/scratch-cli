'use client';

import { TextRegularXs } from '@/app/components/base/text';
import { Button } from '@mantine/core';
import { ChevronDownIcon } from 'lucide-react';

interface CapabilitiesButtonProps {
  selectedCapabilities: string[];
  availableCapabilitiesCount: number;
  onClick: () => void;
}

export default function CapabilitiesButton({
  selectedCapabilities,
  availableCapabilitiesCount,
  onClick,
}: CapabilitiesButtonProps) {
  return (
    <Button
      variant="transparent"
      onClick={onClick}
      size="xs"
      c="gray"
      rightSection={<ChevronDownIcon size={12} color="gray" />}
      styles={{ root: { border: 'none' } }}
    >
      <TextRegularXs c="dimmed">
        {selectedCapabilities.length} / {availableCapabilitiesCount} Tools
      </TextRegularXs>
    </Button>
  );
}
