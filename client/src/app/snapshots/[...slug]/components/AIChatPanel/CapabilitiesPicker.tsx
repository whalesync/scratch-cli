'use client';

import { TextRegularXs } from '@/app/components/base/text';
import { Capability } from '@/types/server-entities/chat-session';
import { Button, Checkbox, Divider, Group, Modal, Stack, Text } from '@mantine/core';
import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CapabilitiesPickerProps {
  availableCapabilities: Capability[];
  selectedCapabilities: string[];
  onCapabilitiesChange: (capabilities: string[]) => void;
}

export default function CapabilitiesPicker({
  availableCapabilities,
  selectedCapabilities,
  onCapabilitiesChange,
}: CapabilitiesPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelectedCapabilities, setTempSelectedCapabilities] = useState<string[]>([]);

  const handleSave = () => {
    onCapabilitiesChange(tempSelectedCapabilities);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSelectedCapabilities(selectedCapabilities);
    setIsOpen(false);
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
  }, [selectedCapabilities]);

  return (
    <>
      {/* Summary Display */}
      <Button
        variant="transparent"
        onClick={() => setIsOpen(true)}
        size="xs"
        c="gray.6"
        rightSection={<ChevronDownIcon size={12} color="var(--mantine-color-gray-7)" />}
        styles={{ root: { border: 'none' } }}
      >
        <TextRegularXs c="dimmed">
          {selectedCapabilities.length} / {availableCapabilities.length} Tools
        </TextRegularXs>
      </Button>
      {/* Modal */}
      <Modal opened={isOpen} onClose={handleCancel} title="Configure Capabilities" size="sm" zIndex={1003}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select which capabilities the AI agent should have access to:
          </Text>
          <Stack gap="md">
            {Object.entries(groupedCapabilities).map(([groupName, capabilities], groupIndex) => (
              <Stack key={groupName} gap="xs">
                {groupIndex > 0 && <Divider />}
                <Text size="sm" fw={500} c="blue">
                  {groupName.charAt(0).toUpperCase() + groupName.slice(1)}
                </Text>
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
            <Button variant="subtle" onClick={handleCancel} size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
