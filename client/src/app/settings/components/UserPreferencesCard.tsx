import { Text12Book, Text13Regular } from '@/app/components/base/text';
import ModelPicker from '@/app/components/ModelPicker';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { DEFAULT_AGENT_MODEL_CONTEXT_LENGTH, DEFAULT_AGENT_MODEL_ID } from '@/types/common';
import { UserSetting } from '@/types/server-entities/users';
import { Grid, Group, Modal, Stack, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PencilLineIcon } from 'lucide-react';
import { useState } from 'react';
import { SettingsPanel } from './SettingsPanel';

export const UserPreferencesCard = () => {
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
    <SettingsPanel title="Preferences" subtitle="Manage your user preferences.">
      <Grid align="flex-start">
        <Grid.Col span={2}>
          <Text13Regular>Default Model</Text13Regular>
        </Grid.Col>
        <Grid.Col span={10}>
          <Stack gap="xs">
            <Group>
              <UnstyledButton onClick={openModelPicker}>
                <Text13Regular>
                  {getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_AGENT_MODEL_ID) as string}
                </Text13Regular>
              </UnstyledButton>
              <ToolIconButton size="md" icon={PencilLineIcon} onClick={openModelPicker} loading={saving} />
            </Group>
            <Text12Book c="dimmed">Set the default LLM to use in your conversations in new workbooks</Text12Book>
          </Stack>
        </Grid.Col>
      </Grid>

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
    </SettingsPanel>
  );
};
