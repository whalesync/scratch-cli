'use client';

import { ButtonSecondaryInline } from '@/app/components/base/buttons';
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
    <ButtonSecondaryInline onClick={onClick} rightSection={<ChevronDownIcon size={12} />} style={{ flexShrink: 0 }}>
      {selectedCapabilities.length} / {availableCapabilitiesCount} Tools
    </ButtonSecondaryInline>
  );
}
