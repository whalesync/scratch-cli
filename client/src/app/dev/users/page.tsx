'use client';

import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { TextMdRegular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import MainContent from '@/app/components/layouts/MainContent';
import { useUserDevTools } from '@/hooks/use-user-dev-tools';
import { getBuildFlavor } from '@/utils/build';
import { ActionIcon, Alert, Anchor, Badge, CopyButton, Group, Stack, Table, TextInput, Tooltip } from '@mantine/core';
import { AlertCircleIcon, CheckIcon, CopyIcon, HatGlassesIcon, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { UserDetailsCard } from './components/UserDetails';
import { clerkUserUrl } from './utils';

const UsersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { users, isLoading, error, search, retrieveUserDetails, currentUserDetails, clearCurrentUserDetails } =
    useUserDevTools();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      search(searchQuery.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRefreshUserDetails = (userId: string) => {
    retrieveUserDetails(userId);
  };

  // sort newest first
  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return users.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [users]);

  return (
    <MainContent>
      <MainContent.BasicHeader title="User management" />
      <MainContent.Body>
        <Stack>
          <TextMdRegular>Search for users by ID, email, name, or Clerk ID</TextMdRegular>

          <Group>
            <TextInput
              placeholder="Enter search query..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <ButtonPrimaryLight
              onClick={handleSearch}
              leftSection={<StyledLucideIcon Icon={Search} size={16} />}
              loading={isLoading}
              disabled={searchQuery.trim().length < 3}
            >
              Search
            </ButtonPrimaryLight>
          </Group>

          {error && (
            <Alert title="Error" color="red" radius="md" icon={<AlertCircleIcon />}>
              {error.message}
            </Alert>
          )}

          <Group align="flex-start" justify="space-between" wrap="nowrap">
            {users.length > 0 && (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Clerk</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Created</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedUsers.map((user) => (
                    <Table.Tr key={user.id} onClick={() => retrieveUserDetails(user.id)} style={{ cursor: 'pointer' }}>
                      <Table.Td>
                        {user.id}{' '}
                        <CopyButton value={user?.id || ''} timeout={2000}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : `${user?.id}`} withArrow position="right">
                              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                        {user.isAdmin && <Badge size="xs">Admin</Badge>}
                      </Table.Td>
                      <Table.Td>{user.name || '-'}</Table.Td>

                      <Table.Td>
                        <Group>
                          {user.clerkId}
                          <Anchor href={clerkUserUrl(user.clerkId, getBuildFlavor())} target="_blank" rel="noreferrer">
                            <StyledLucideIcon Icon={HatGlassesIcon} size={16} />
                          </Anchor>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {user.email || '-'}
                        <CopyButton value={user?.email || ''} timeout={2000}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : `${user?.email}`} withArrow position="right">
                              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Table.Td>
                      <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {currentUserDetails && (
              <Stack miw="40%">
                <UserDetailsCard
                  details={currentUserDetails}
                  onClose={clearCurrentUserDetails}
                  onRefreshUser={handleRefreshUserDetails}
                />
              </Stack>
            )}
          </Group>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default UsersPage;
