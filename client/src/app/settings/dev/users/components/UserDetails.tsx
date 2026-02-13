import { Badge, BadgeError, BadgeOK } from '@/app/components/base/badge';
import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { Text13Book, TextTitle2, TextTitle3 } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LabelValuePair } from '@/app/components/LabelValuePair';
import { ConfirmDialog, useConfirmDialog } from '@/app/components/modals/ConfirmDialog';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { devToolsApi } from '@/lib/api/dev-tools';
import { UserDetails } from '@/types/server-entities/dev-tools';
import { User } from '@/types/server-entities/users';
import { getBuildFlavor } from '@/utils/build';
import { Accordion, Anchor, Card, Checkbox, CloseButton, Group, Stack, Table, TextInput, Tooltip } from '@mantine/core';
import { IdPrefixes } from '@spinner/shared-types';
import { CreditCardIcon, HatGlassesIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { clerkUserUrl, stripeCustomerUrl } from '../utils';

export const UserDetailsCard = ({
  details,
  onClose,
  onRefreshUser,
}: {
  details: UserDetails;
  onClose: () => void;
  onRefreshUser: (userId: string) => void;
}) => {
  const [saving, setSaving] = useState(false);
  const [newOrgId, setNewOrgId] = useState('');
  const [deleteOldOrg, setDeleteOldOrg] = useState(false);
  const { open: openConfirm, dialogProps } = useConfirmDialog();
  const orgIdError =
    newOrgId.trim() && !newOrgId.trim().startsWith(IdPrefixes.ORGANIZATION)
      ? 'Organization ID must start with "org_"'
      : undefined;

  const handleChangeOrganization = useCallback(() => {
    if (!newOrgId.trim() || !newOrgId.trim().startsWith(IdPrefixes.ORGANIZATION)) return;

    openConfirm({
      title: 'Change Organization',
      message: `Move user "${details.user.name}" to organization "${newOrgId}"?${deleteOldOrg ? ' The old organization will be deleted if no other users remain.' : ''}`,
      confirmLabel: 'Change Organization',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setSaving(true);
          await devToolsApi.changeUserOrganization({
            userId: details.user.id,
            newOrganizationId: newOrgId.trim(),
            deleteOldOrganization: deleteOldOrg,
          });
          ScratchpadNotifications.success({
            title: 'Organization changed',
            message: 'The user organization has been updated successfully',
          });
          setNewOrgId('');
          setDeleteOldOrg(false);
          onRefreshUser(details.user.id);
        } catch (error) {
          console.error('Failed to change organization', error);
          ScratchpadNotifications.error({
            title: 'Failed to change organization',
            message: 'The user organization has not been updated',
          });
        } finally {
          setSaving(false);
        }
      },
    });
  }, [newOrgId, deleteOldOrg, details, openConfirm, onRefreshUser]);

  const handleRemoveSetting = useCallback(
    async (key: string) => {
      try {
        setSaving(true);
        await devToolsApi.updateUserSettings(details.user.id, { updates: { [key]: null } });
        ScratchpadNotifications.success({
          title: 'Setting removed successfully',
          message: 'The setting has been removed successfully',
        });
        onRefreshUser(details.user.id);
      } catch (error) {
        console.error('Failed to remove setting', key, error);
        ScratchpadNotifications.error({
          title: 'Failed to remove setting',
          message: 'The setting has not been removed',
        });
      } finally {
        setSaving(false);
      }
    },
    [details, onRefreshUser],
  );

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
          <Accordion variant="contained" defaultValue={null} chevronPosition="right">
            <Accordion.Item value="change-org">
              <Accordion.Control icon={<SquarePenIcon size={12} />}>Change Organization</Accordion.Control>
              <Accordion.Panel>
                <Group gap="xs" grow justify="space-between" align="center">
                  <TextInput
                    placeholder="Enter organization ID"
                    size="xs"
                    value={newOrgId}
                    onChange={(e) => setNewOrgId(e.currentTarget.value)}
                    error={orgIdError}
                    disabled={saving}
                    miw="50%"
                  />
                  <Checkbox
                    label="Remove old org"
                    checked={deleteOldOrg}
                    onChange={(e) => setDeleteOldOrg(e.currentTarget.checked)}
                    disabled={saving}
                  />

                  <ButtonPrimaryLight
                    onClick={handleChangeOrganization}
                    loading={saving}
                    disabled={!newOrgId.trim() || !!orgIdError}
                    size="xs"
                  >
                    Change Organization
                  </ButtonPrimaryLight>
                </Group>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
        <ConfirmDialog {...dialogProps} />
      </Card.Section>
      <Card.Section p="xs" withBorder>
        <Stack>
          <TextTitle3>Settings</TextTitle3>
          {Object.entries(details.user.settings ?? {}).map(([key, value]) => (
            <LabelValuePair
              key={key}
              label={key}
              value={
                <Group justify="space-between" w="100%">
                  <Text13Book>{value}</Text13Book>
                  <ToolIconButton
                    icon={Trash2Icon}
                    onClick={() => handleRemoveSetting(key)}
                    tooltip="Remove this setting"
                    disabled={saving}
                  />
                </Group>
              }
            />
          ))}
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
      return <Badge>None</Badge>;
    }
  };

  return (
    <Group>
      {subscriptionBadge()}
      {user.subscription?.status === 'valid' && (
        <Text13Book>
          {user.subscription?.planDisplayName} - {user.subscription?.daysRemaining} days remaining
        </Text13Book>
      )}
    </Group>
  );
};
