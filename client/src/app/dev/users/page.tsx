'use client';

import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { TextMdRegular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import MainContent from '@/app/components/layouts/MainContent';
import { useUserDevTools } from '@/hooks/use-user-dev-tools';
import { Alert, Code, Group, Stack, Table, TextInput } from '@mantine/core';
import { AlertCircleIcon, Search } from 'lucide-react';
import { useState } from 'react';

const UsersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { users, isLoading, error, search, retrieveUserDetails, userDetails } = useUserDevTools();

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
              disabled={isLoading}
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
                    <Table.Th>Admin</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
                    <Table.Tr key={user.id} onClick={() => retrieveUserDetails(user.id)} style={{ cursor: 'pointer' }}>
                      <Table.Td>{user.id}</Table.Td>
                      <Table.Td>{user.email || 'N/A'}</Table.Td>
                      <Table.Td>{user.name || 'N/A'}</Table.Td>
                      <Table.Td>{user.isAdmin ? 'Yes' : 'No'}</Table.Td>
                      <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
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
