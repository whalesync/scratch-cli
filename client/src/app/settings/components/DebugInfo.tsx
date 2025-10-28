import { TextSmRegular, TextXsRegular } from '@/app/components/base/text';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { FLAGS, LocalStorageFlag } from '@/utils/flags-dev';
import { ActionIcon, Badge, Checkbox, CopyButton, Grid, Group, PasswordInput, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Fragment, JSX, useState } from 'react';
import { SettingsPanel } from './SettingsPanel';

export const DevToolsPanel = () => {
  const { user, isAdmin } = useScratchPadUser();

  return (
    <SettingsPanel title="Dev Tools" subtitle="Developer tools and information.">
      <Group wrap="nowrap" gap="xs">
        <TextSmRegular miw={200}>User ID</TextSmRegular>

        <TextSmRegular>{user?.id || 'No user ID found'}</TextSmRegular>
        <CopyButton value={user?.id || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `${user?.id}`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
        {isAdmin && <Badge size="xs">Admin</Badge>}
      </Group>
      <Group wrap="nowrap" gap="xs">
        <TextSmRegular miw={200}>Created</TextSmRegular>
        <TextSmRegular>
          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'No created at found'}
        </TextSmRegular>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <TextSmRegular miw={200}>Agent Token</TextSmRegular>
        <PasswordInput
          variant="unstyled"
          value={user?.agentJwt}
          placeholder="No API key found"
          readOnly
          inputWrapperOrder={['input', 'label', 'description', 'error']}
          flex={1}
        />
        <CopyButton value={user?.agentJwt || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `Copy Agent auth token`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <TextSmRegular miw={200}>UI Websocket Key</TextSmRegular>
        <PasswordInput
          variant="unstyled"
          value={user?.websocketToken}
          placeholder="No API key found"
          readOnly
          inputWrapperOrder={['input', 'label', 'description', 'error']}
          flex={1}
        />
        <CopyButton value={user?.websocketToken || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `Copy UI Websocket API key`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group wrap="nowrap" gap="xs" align="flex-start">
        <TextSmRegular miw={200}>Flags</TextSmRegular>
        <Grid w="100%">
          <Grid.Col span={6}>
            <TextXsRegular>Skip paywall on localhost</TextXsRegular>
          </Grid.Col>
          <Grid.Col span={6}>
            <FlagCheckboxOption flag={FLAGS.SKIP_PAYWALL_FOR_LOCALHOST} />
          </Grid.Col>
          {user?.experimentalFlags &&
            Object.entries(user.experimentalFlags).map(([flag, value]) => (
              <Fragment key={flag}>
                <Grid.Col span={6}>
                  <TextXsRegular>{flag}</TextXsRegular>
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextXsRegular>{value.toString()}</TextXsRegular>
                </Grid.Col>
              </Fragment>
            ))}
        </Grid>
      </Group>
    </SettingsPanel>
  );
};

const FlagCheckboxOption = (props: { flag: LocalStorageFlag }): JSX.Element => {
  const [checked, setChecked] = useState(props.flag.getLocalStorageValue());
  return (
    <Checkbox
      checked={checked}
      onChange={(e) => {
        props.flag.setLocalStorageValue(e.currentTarget.checked);
        setChecked(e.currentTarget.checked);
        window.location.reload();
      }}
    />
  );
};
