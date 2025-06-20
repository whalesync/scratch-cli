import { Center } from "@mantine/core";
import { HouseIcon } from "@phosphor-icons/react/ssr";

export default function HomePage() {
  return (
<<<<<<< HEAD
    <Center h="100vh">
      <HouseIcon size={500} weight="thin" color="#00A2E9" />
    </Center>
=======
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>
          Scratchpad
        </Title>
      </Group>

      <Tabs defaultValue="edit">
        <Tabs.List>
          <Tabs.Tab value="fetch">Fetch</Tabs.Tab>
          <Tabs.Tab value="edit">Edit</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="fetch" pt="md">
          <ApiImportWithNoSSR />
        </Tabs.Panel>

        <Tabs.Panel value="edit" pt="md">
          <Group justify="space-between" mb="xl">
            <Button onClick={pushChanges}>Push Changes</Button>
          </Group>

          {error && (
            <Text color="red" size="sm" mb="md">
              {error}
            </Text>
          )}

          {!loading && !error && records && 
          <RecordsGridWithNoSSR
            records={records}
            onUpdate={updateRecord}
            onDelete={deleteRecord}
          />}
          {loading && (
            <Text ta="center" mt="md">
              Loading...
            </Text>
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
>>>>>>> 97c58c7 (wip)
  );
}
