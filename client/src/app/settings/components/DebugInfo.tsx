import { TextRegularSm, TextRegularXs, TextTitleSm } from '@/app/components/base/text';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ClientFlag, FLAGS } from '@/utils/flags-dev';
import { ActionIcon, Badge, Card, Checkbox, CopyButton, Grid, Group, PasswordInput, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Fragment, JSX, useState } from 'react';

export const DevToolsPanel = () => {
  const { user, isAdmin } = useScratchPadUser();

  return (
    <Card shadow="sm" padding="sm" radius="sm" withBorder style={{ borderColor: 'var(--mantine-color-purple-5)' }}>
      <TextTitleSm mb="xs">Dev Tools</TextTitleSm>
      <Group wrap="nowrap" gap="xs">
        <TextRegularSm miw={200}>User ID</TextRegularSm>

        <TextRegularSm>{user?.id || 'No user ID found'}</TextRegularSm>
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
        <TextRegularSm miw={200}>Created</TextRegularSm>
        <TextRegularSm>
          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'No created at found'}
        </TextRegularSm>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <TextRegularSm miw={200}>Agent Token</TextRegularSm>
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
        <TextRegularSm miw={200}>UI Websocket Key</TextRegularSm>
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
        <TextRegularSm miw={200}>Flags</TextRegularSm>
        <Grid w="100%">
          <Grid.Col span={6}>
            <TextRegularXs>Skip paywall on localhost</TextRegularXs>
          </Grid.Col>
          <Grid.Col span={6}>
            <FlagCheckboxOption flag={FLAGS.SKIP_PAYWALL_FOR_LOCALHOST} />
          </Grid.Col>
          {user?.experimentalFlags &&
            Object.entries(user.experimentalFlags).map(([flag, value]) => (
              <Fragment key={flag}>
                <Grid.Col span={6}>
                  <TextRegularXs>{flag}</TextRegularXs>
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextRegularXs>{value.toString()}</TextRegularXs>
                </Grid.Col>
              </Fragment>
            ))}
        </Grid>
      </Group>
    </Card>
  );
};

const FlagCheckboxOption = (props: { flag: ClientFlag }): JSX.Element => {
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
