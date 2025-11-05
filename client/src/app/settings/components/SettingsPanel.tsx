import { Box, Group, Stack } from '@mantine/core';
import { TextSmBook, TextSmRegular } from '../../components/base/text';
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
        <TextSmRegular>{title}</TextSmRegular>
        <TextSmBook c="dimmed">{subtitle}</TextSmBook>
      </Stack>
      <Box className={classes.settingsPanelRight}>{children}</Box>
    </Group>
  );
};
