import { BadgeBase, BadgeError, BadgeOK } from '@/app/components/base/badges';
import { TextSmBook, TextTitle2, TextTitle3 } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LabelValuePair } from '@/app/components/LabelValuePair';
import { UserDetails } from '@/types/server-entities/dev-tools';
import { User } from '@/types/server-entities/users';
import { getBuildFlavor } from '@/utils/build';
import { Anchor, Card, CloseButton, Group, Stack, Table, Tooltip } from '@mantine/core';
import { CreditCardIcon, HatGlassesIcon } from 'lucide-react';
import { clerkUserUrl, stripeCustomerUrl } from '../utils';

export const UserDetailsCard = ({ details, onClose }: { details: UserDetails; onClose: () => void }) => {
  return (
    <Card withBorder shadow="sm" radius="xs">
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <TextTitle2>User Details: {details.user.name}</TextTitle2>
          <CloseButton onClick={onClose} />
        </Group>
      </Card.Section>
      <Card.Section mt="sm" p="xs" withBorder>
        <Stack>
          <LabelValuePair label="ID" value={details.user.id} canCopy />
          <LabelValuePair label="Name" value={details.user.name} />
          <LabelValuePair label="Email" value={details.user.email} canCopy />
          <Group align="center" gap="xs">
            <LabelValuePair label="Clerk ID" value={details.user.clerkId} canCopy />
            <Tooltip label="View in Clerk">
              <Anchor href={clerkUserUrl(details.user.clerkId, getBuildFlavor())} target="_blank" rel="noreferrer">
                <StyledLucideIcon Icon={HatGlassesIcon} size={16} />
              </Anchor>
            </Tooltip>
          </Group>
          <Group align="center" gap="xs">
            <LabelValuePair label="Stripe Customer ID" value={details.user.stripeCustomerId} canCopy />
            {details.user.stripeCustomerId && (
              <Tooltip label="View in Stripe">
                <Anchor
                  href={stripeCustomerUrl(details.user.stripeCustomerId, getBuildFlavor())}
                  target="_blank"
                  rel="noreferrer"
                >
                  <StyledLucideIcon Icon={CreditCardIcon} size={16} />
                </Anchor>
              </Tooltip>
            )}
          </Group>
          <LabelValuePair label="Created" value={new Date(details.user.createdAt).toLocaleString()} />
          <LabelValuePair label="Subscription Status" value={<SubscriptionInfo user={details.user} />} />
        </Stack>
      </Card.Section>
      <Card.Section p="xs" withBorder>
        <Stack>
          <TextTitle3>Organization</TextTitle3>
          <LabelValuePair label="ID" value={details.user.organization?.id} canCopy />
          <LabelValuePair label="Clerk ID" value={details.user.organization?.clerkId} canCopy />
          <LabelValuePair label="Name" value={details.user.organization?.name} />
        </Stack>
      </Card.Section>
      <Card.Section p="xs" withBorder>
        <Stack>
          <TextTitle3>Connections</TextTitle3>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="120px">ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Service</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.connections.map((connection) => (
                <Table.Tr key={connection.id}>
                  <Table.Td>{connection.id}</Table.Td>
                  <Table.Td>{connection.name}</Table.Td>
                  <Table.Td>{connection.service}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card.Section>
      <Card.Section p="xs" withBorder>
        <Stack>
          <TextTitle3>Workbooks</TextTitle3>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="120px">ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Tables</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.workbooks?.map((workbook) => (
                <Table.Tr key={workbook.id}>
                  <Table.Td>{workbook.id}</Table.Td>
                  <Table.Td>{workbook.name}</Table.Td>
                  <Table.Td>{workbook.numTables}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card.Section>
      <Card.Section p="xs" withBorder>
        <Stack>
          <TextTitle3>Audit Logs</TextTitle3>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.auditLogs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>{new Date(log.createdAt).toLocaleString()}</Table.Td>
                  <Table.Td>{log.message}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card.Section>
    </Card>
  );
};

const SubscriptionInfo = ({ user }: { user: User }) => {
  const subscriptionBadge = () => {
    if (user.subscription?.status === 'valid') {
      return <BadgeOK>Active</BadgeOK>;
    } else if (user.subscription?.status === 'expired') {
      return <BadgeError>Expired</BadgeError>;
    } else {
      return <BadgeBase>None</BadgeBase>;
    }
  };

  return (
    <Group>
      {subscriptionBadge()}
      {user.subscription?.status === 'valid' && (
        <TextSmBook>
          {user.subscription?.planDisplayName} - {user.subscription?.daysRemaining} days remaining
        </TextSmBook>
      )}
    </Group>
  );
};
