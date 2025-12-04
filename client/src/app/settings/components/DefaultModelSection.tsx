import { IconButtonGhost } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { ConfigSection } from '@/app/components/ConfigSection';
import { DecorativeBoxedIcon } from '@/app/components/Icons/DecorativeBoxedIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import ModelPicker from '@/app/components/ModelPicker';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { DEFAULT_AGENT_MODEL_CONTEXT_LENGTH, DEFAULT_AGENT_MODEL_ID } from '@/types/common';
import { UserSetting } from '@/types/server-entities/users';
import { Group, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BrainIcon, PenLineIcon } from 'lucide-react';
import { useState } from 'react';

export const DefaultModelSection = () => {
  const { updateUserSetting, getUserSetting } = useScratchPadUser();
  const [saving, setSaving] = useState(false);
  const [modelPickerOpen, { open: openModelPicker, close: closeModelPicker }] = useDisclosure();

  const handleModelChange = async (model: string) => {
    try {
      setSaving(true);
      await updateUserSetting(UserSetting.DEFAULT_LLM_MODEL, model);
      ScratchpadNotifications.success({
        message: 'Your default LLM was updated to ' + model,
      });
    } catch (error) {
      console.error('Error changing default model', error);
      ScratchpadNotifications.error({
        message: 'Error updating your default LLM, please try again.',
      });
    } finally {
      closeModelPicker();
      setSaving(false);
    }
  };

  return (
    <ConfigSection
      title="Default Model"
      description="Set the default LLM to use in your conversations in new workbooks."
    >
      <Group justify="space-between">
        <Group gap="xs" wrap="nowrap">
          <DecorativeBoxedIcon Icon={BrainIcon} size="sm" />
          <Text13Regular>
            {getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_AGENT_MODEL_ID) as string}
          </Text13Regular>
        </Group>
        <IconButtonGhost onClick={openModelPicker} loading={saving} size="xs">
          <StyledLucideIcon Icon={PenLineIcon} size={13} />
        </IconButtonGhost>
      </Group>
      <Modal opened={modelPickerOpen} onClose={closeModelPicker} title="Select Model" size="xl" centered>
        <ModelPicker
          currentModelOption={{
            value: getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_AGENT_MODEL_ID) as string,
            contextLength: DEFAULT_AGENT_MODEL_CONTEXT_LENGTH,
          }}
          onChange={(value) => {
            handleModelChange(value.value);
          }}
        />
      </Modal>
    </ConfigSection>
  );
};
