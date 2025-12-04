'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextTitle3 } from '@/app/components/base/text';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { capabilitiesForGroup, Capability } from '@/types/server-entities/agent';
import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { capitalize } from 'lodash';
import { useEffect, useState } from 'react';

interface ToolsModalProps {
  opened: boolean;
  onClose: () => void;
  selectedCapabilities: string[];
  onCapabilitiesChange: (capabilities: string[]) => void;
}

export default function ToolsModal({ opened, onClose, selectedCapabilities, onCapabilitiesChange }: ToolsModalProps) {
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

  useEffect(() => {
    setTempSelectedCapabilities(selectedCapabilities);
  }, [selectedCapabilities, opened]);

  const renderCapabilityGroup = (groupName: string, capabilities: Capability[]) => {
    return (
      <>
        <TextTitle3 c="primary">{capitalize(groupName)}</TextTitle3>
        <Stack gap="xs" key={groupName}>
          {capabilities.map((capability) => (
            <Checkbox
              key={capability.code}
              label={capability.displayName}
              checked={tempSelectedCapabilities.includes(capability.code)}
              onChange={(event) => handleCapabilityToggle(capability.code, event.currentTarget.checked)}
              description={capability.description}
            />
          ))}
        </Stack>
      </>
    );
  };

  return (
    <ModalWrapper
      title="Configure tools"
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={handleCancel}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleSave}>Save changes</ButtonPrimaryLight>
          </>
        ),
      }}
      opened={opened}
      onClose={handleCancel}
      zIndex={1001}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select which tools the AI agent should have access to:
        </Text>
        <Group gap="md" grow align="flex-start">
          <Stack>
            {renderCapabilityGroup('data', capabilitiesForGroup('data'))}
            {renderCapabilityGroup('views', capabilitiesForGroup('views'))}
            {renderCapabilityGroup('table', capabilitiesForGroup('table'))}
            {renderCapabilityGroup('other', capabilitiesForGroup('other'))}
          </Stack>
        </Group>
      </Stack>
    </ModalWrapper>
  );
}
