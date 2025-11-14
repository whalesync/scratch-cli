import { Box, Group, Stack } from '@mantine/core';
import { Text13Book, Text13Regular } from '../../components/base/text';
import classes from './settings-panel.module.css';

export const SettingsPanel = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode | React.ReactNode[];
}) => {
  return (
    <Group className={classes.settingsPanel}>
      <Stack className={classes.settingsPanelLeft}>
        <Text13Regular>{title}</Text13Regular>
        <Text13Book c="dimmed">{subtitle}</Text13Book>
      </Stack>
      <Box className={classes.settingsPanelRight}>{children}</Box>
    </Group>
  );
};
