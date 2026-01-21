'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextTitle3 } from '@/app/components/base/text';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { capabilitiesForGroup, Capability, CapabilityGroup, capabilityGroupDisplayName } from '@spinner/shared-types';
import { Fragment, useEffect, useState } from 'react';

export interface ToolsModalProps {
  opened: boolean;
  onClose: () => void;
  selectedCapabilities: string[];
  availableCapabilities: Capability[];
  onCapabilitiesChange: (capabilities: string[]) => void;
}

export default function ToolsModal({
  opened,
  onClose,
  selectedCapabilities,
  availableCapabilities,
  onCapabilitiesChange,
}: ToolsModalProps) {
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
      <Fragment key={groupName}>
        <TextTitle3 c="primary">{capabilityGroupDisplayName(groupName as CapabilityGroup)}</TextTitle3>
        <Stack gap="xs">
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
      </Fragment>
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
            {/* Extract unique groups from available capabilities and render each */}
            {Array.from(new Set(availableCapabilities.map((cap) => cap.code.split(':')[0]))).map((groupName) =>
              renderCapabilityGroup(
                groupName,
                capabilitiesForGroup(groupName as CapabilityGroup, availableCapabilities),
              ),
            )}
          </Stack>
        </Group>
      </Stack>
    </ModalWrapper>
  );
}
