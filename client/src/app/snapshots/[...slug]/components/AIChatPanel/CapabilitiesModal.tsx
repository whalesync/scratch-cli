'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextTitle3 } from '@/app/components/base/text';
import { Capability } from '@/types/server-entities/chat-session';
import { Checkbox, Divider, Group, Modal, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

interface CapabilitiesModalProps {
  opened: boolean;
  onClose: () => void;
  availableCapabilities: Capability[];
  selectedCapabilities: string[];
  onCapabilitiesChange: (capabilities: string[]) => void;
}

export default function CapabilitiesModal({
  opened,
  onClose,
  availableCapabilities,
  selectedCapabilities,
  onCapabilitiesChange,
}: CapabilitiesModalProps) {
  const [tempSelectedCapabilities, setTempSelectedCapabilities] = useState<string[]>([]);

  const handleSave = () => {
    onCapabilitiesChange(tempSelectedCapabilities);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedCapabilities(selectedCapabilities);
    onClose();
  };

  const handleCapabilityToggle = (capabilityCode: string, checked: boolean) => {
    if (checked) {
      setTempSelectedCapabilities((prev) => [...prev, capabilityCode]);
    } else {
      setTempSelectedCapabilities((prev) => prev.filter((code) => code !== capabilityCode));
    }
  };

  // Group capabilities by the part before the colon
  const groupedCapabilities = availableCapabilities.reduce(
    (groups, capability) => {
      const [groupName] = capability.code.split(':');
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(capability);
      return groups;
    },
    {} as Record<string, Capability[]>,
  );

  useEffect(() => {
    setTempSelectedCapabilities(selectedCapabilities);
  }, [selectedCapabilities, opened]);

  return (
    <Modal opened={opened} onClose={handleCancel} title="Configure Capabilities" size="sm" zIndex={1003}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select which capabilities the AI agent should have access to:
        </Text>
        <Stack gap="md">
          {Object.entries(groupedCapabilities).map(([groupName, capabilities], groupIndex) => (
            <Stack key={groupName} gap="xs">
              {groupIndex > 0 && <Divider />}
              <TextTitle3 c="primary">{groupName.charAt(0).toUpperCase() + groupName.slice(1)}</TextTitle3>
              <Stack gap="xs">
                {capabilities.map((capability) => (
                  <Checkbox
                    key={capability.code}
                    label={capability.code}
                    checked={tempSelectedCapabilities.includes(capability.code)}
                    onChange={(event) => handleCapabilityToggle(capability.code, event.currentTarget.checked)}
                    description={capability.description}
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
        <Group justify="flex-end" gap="xs">
          <ButtonSecondaryOutline onClick={handleCancel}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleSave}>Save</ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
}
