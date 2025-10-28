'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextMdRegular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import MainContent from '@/app/components/layouts/MainContent';
import { useUserDevTools } from '@/hooks/use-user-dev-tools';
import { ActionIcon, Alert, Badge, Code, CopyButton, Group, Stack, Table, TextInput, Tooltip } from '@mantine/core';
import { AlertCircleIcon, CheckIcon, CopyIcon, Search } from 'lucide-react';
import { useState } from 'react';

const UsersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { users, isLoading, error, search, retrieveUserDetails, userDetails, resetStripeForUser } = useUserDevTools();

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
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Tools</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
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
                      <Table.Td>
                        {user.email || 'N/A'}
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
                      <Table.Td>{user.name || 'N/A'}</Table.Td>
                      <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
                      <Table.Td>
                        <ButtonSecondaryOutline
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            resetStripeForUser(user.id);
                          }}
                          loading={isLoading}
                          size="xs"
                        >
                          Reset Stripe
                        </ButtonSecondaryOutline>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {userDetails && (
              <Stack miw="40%">
                <TextMdRegular>User details</TextMdRegular>
                <Code block>{JSON.stringify(userDetails, null, 2)}</Code>
              </Stack>
            )}
          </Group>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default UsersPage;
