'use client';

import { Box, Center, List, Stack, Text, Title } from '@mantine/core';
import MainContent from './components/layouts/MainContent';
import { PageLayout } from './components/layouts/PageLayout';

export default function HomePage() {
  return (
    <PageLayout>
      {' '}
      <MainContent>
        <MainContent.BasicHeader title="Getting started" />
        <MainContent.Body>
          <GetStartedContent />
        </MainContent.Body>
      </MainContent>
    </PageLayout>
  );
}

const GetStartedContent = () => {
  return (
    <Center w="100%" p="3rem">
      <Stack gap="lg" w="100%" mb="20px">
        <Title order={1}>Welcome to Scratchpaper.ai</Title>
        <Box>
          <Text>
            Welcome to an early look at a new way of working with content. This guide skips the fluff and gets straight
            to what matters: putting these tools to work.
          </Text>
        </Box>

        <Stack gap="sm">
          <Title order={2} w="100%">
            The core principle: a safe sandbox for live data
          </Title>
          <Text>
            Scratchpaper works by creating a temporary, isolated copy of your live data. The AI agent only ever
            interacts with this safe copy.
          </Text>
          <Text fw={600}>
            No changes are ever made to your live data until you explicitly review, approve, and click
            &quot;Publish&quot;.
          </Text>
          <Text>
            This architecture puts a human-in-the-loop by design. You can experiment with powerful AI edits, knowing
            your original source is untouched until you give the final command.
          </Text>
        </Stack>

        <Stack gap="sm">
          <Title order={2}>Getting started fast</Title>
          <List type="ordered" spacing="sm" size="md" center>
            <List.Item>
              <Text component="span" fw={600}>
                Connect:
              </Text>
              Click on &quot;Connections&quot; to link a live data source (Notion, YouTube, etc.).
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Create:
              </Text>{' '}
              Open that connection and create a new &quot;Scratchpaper&quot;.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Edit:
              </Text>{' '}
              Open the Scratchpaper and start giving the AI instructions.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Reset:
              </Text>{' '}
              Want to start over? Click &quot;Download&quot; to refresh the content from the live connection.
            </List.Item>
          </List>
        </Stack>

        <Stack gap="sm">
          <Title order={2}>Key concepts for powerful editing</Title>

          <Title order={3}>Work at the right context level</Title>
          <Text mb="md">
            You can operate on your entire content library or on a single piece of content. The AI has access to both
            views:
          </Text>
          <List spacing="sm" size="md" mb="lg">
            <List.Item>
              <Text component="span" fw={600}>
                Library View:
              </Text>{' '}
              See all your content in a list. From here, you can ask the AI to perform broad tasks like categorizing
              records, generating summaries for multiple items, or even creating new records based on the context of the
              entire library.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Single-Record View:
              </Text>{' '}
              Focus on a single piece of content for deep, detailed edits.
            </List.Item>
          </List>

          <Title order={3}>Accelerate the AI-human workflow</Title>
          <Text mb="md">
            These tools are designed to make the &quot;AI suggests, you approve&quot; loop as fast and efficient as
            possible.
          </Text>
          <List spacing="sm" size="md" mb="lg">
            <List.Item>
              <Text component="span" fw={600}>
                Provide lasting context with resources:
              </Text>{' '}
              Add reusable instructions, style guides, or content from URLs (.md, sitemaps, etc.) to the chat. The AI
              will use this context for its tasks, ensuring consistency and accuracy.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Choose the right AI model:
              </Text>{' '}
              Select a fast, lightweight model for simple tasks like tagging, or a more powerful model for complex
              writing and editing.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Filter with precision:
              </Text>{' '}
              Use natural language or SQL queries to instantly filter records and give the AI a focused set of data to
              work on.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Review changes instantly:
              </Text>{' '}
              The UI shows all AI suggestions as string-level diffs, so you can see exactly what changed at a glance.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Approve or reject:
              </Text>{' '}
              Accept or discard suggestions for a single cell, an entire record, or the whole library.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Make surgical edits:
              </Text>{' '}
              Use precise tools for targeted changes without needing the AI to rewrite the whole text:
              <List withPadding spacing="xs" size="sm" mt="xs">
                <List.Item>
                  <Text component="span" fw={600}>
                    Find and replace:
                  </Text>{' '}
                  For targeted substitutions.
                </List.Item>
                <List.Item>
                  <Text component="span" fw={600}>
                    Append:
                  </Text>{' '}
                  To add content to the end of a field.
                </List.Item>
                <List.Item>
                  <Text component="span" fw={600}>
                    Insert:
                  </Text>{' '}
                  Use <Text component="code">@@</Text> to mark the exact spot for new content.
                </List.Item>
              </List>
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Stay in control:
              </Text>{' '}
              You can stop an agent loop at any time if it&apos;s not doing what you want.
            </List.Item>
          </List>
        </Stack>

        <Stack gap="sm">
          <Title order={3}>Navigate like a pro: keyboard shortcuts</Title>
          <List spacing="sm" size="md">
            <List.Item>
              <Text component="span" fw={600}>
                Move around the library:
              </Text>{' '}
              Use the keyboard arrow keys.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Sort columns:
              </Text>{' '}
              Use <Text component="code">[</Text> and <Text component="code">]</Text> to sort by the currently selected
              column.
            </List.Item>
            <List.Item>
              <Text component="span" fw={600}>
                Edit cells:
              </Text>{' '}
              In the record view, press <Text component="code">Enter</Text> to open/edit a cell and{' '}
              <Text component="code">Esc</Text> to close it.
            </List.Item>
          </List>
        </Stack>
      </Stack>
    </Center>
  );
};
