import { Badge } from '@/app/components/base/badge';
import { Text12Book, Text12Regular, Text13Regular } from '@/app/components/base/text';
import { ConfigSection } from '@/app/components/ConfigSection';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { FLAGS, LocalStorageFlag } from '@/utils/flags-dev';
import { ActionIcon, Checkbox, CopyButton, Divider, Grid, Group, PasswordInput, Stack, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Fragment, JSX, useState } from 'react';

export const UserDevToolsSection = () => {
  const { user, isAdmin } = useScratchPadUser();

  return (
    <ConfigSection title="Dev Tools" description="Developer tools and information.">
      <Stack gap="xs">
        <Group wrap="nowrap" gap="xs">
          <Text13Regular miw={150}>User ID</Text13Regular>
          <Text13Regular>{user?.id || 'No user ID found'}</Text13Regular>
          <CopyButton value={user?.id || ''} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : `${user?.id}`} withArrow position="right">
                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                  {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
          {isAdmin && <Badge>Admin</Badge>}
        </Group>
        <Group wrap="nowrap" gap="xs">
          <Text13Regular miw={150}>Clerk ID</Text13Regular>
          <Text13Regular>{user?.clerkId || 'No clerk ID found'}</Text13Regular>
          <CopyButton value={user?.clerkId || ''} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : `${user?.clerkId}`} withArrow position="right">
                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                  {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>

        <Group wrap="nowrap" gap="xs">
          <Text13Regular miw={150}>Agent Token</Text13Regular>
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
          <Text13Regular miw={150}>UI Websocket Key</Text13Regular>
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
        <Divider />
        <Group wrap="nowrap" gap="xs" align="flex-start">
          <Text13Regular miw={150}>Feature Flags</Text13Regular>
          <Grid w="100%">
            {user?.experimentalFlags &&
              Object.entries(user.experimentalFlags).map(([flag, value]) => (
                <Fragment key={flag}>
                  <Grid.Col span={4}>
                    <Text12Book>{flag}</Text12Book>
                  </Grid.Col>
                  <Grid.Col span={8}>
                    <Text12Regular
                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                    >
                      {value.toString()}
                    </Text12Regular>
                  </Grid.Col>
                </Fragment>
              ))}
          </Grid>
        </Group>
        <Divider />
        <Group wrap="nowrap" gap="xs" align="flex-start">
          <Text13Regular miw={150}>Local Flags</Text13Regular>
          <Grid w="100%">
            <Grid.Col span={4}>
              <Text12Regular>Dev tools visible</Text12Regular>
            </Grid.Col>
            <Grid.Col span={8}>
              <FlagCheckboxOption flag={FLAGS.DEV_TOOLS_VISIBLE} />
            </Grid.Col>
          </Grid>
        </Group>
        <Divider />
        <Group wrap="nowrap" gap="xs" align="flex-start">
          <Text13Regular miw={150}>User Settings</Text13Regular>
          <Grid w="100%">
            {user?.settings &&
              Object.entries(user.settings).map(([key, value]) => (
                <Fragment key={key}>
                  <Grid.Col span={4}>
                    <Text12Regular>{key}</Text12Regular>
                  </Grid.Col>
                  <Grid.Col span={8}>
                    <Text12Regular>{value}</Text12Regular>
                  </Grid.Col>
                </Fragment>
              ))}
          </Grid>
        </Group>
      </Stack>
    </ConfigSection>
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
