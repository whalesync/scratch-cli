import { workbookApi } from '@/lib/api/workbook';
import { Autocomplete, Button, Code, Group, Modal, Select, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { FileRefEntity, TestTransformerResponse, TransformerType, WorkbookId } from '@spinner/shared-types';
import { ArrowRightIcon, FlaskRoundIcon } from 'lucide-react';
import { useState } from 'react';

interface TestTransformerModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
  file: FileRefEntity;
}

const TRANSFORMER_TYPES: { value: TransformerType; label: string }[] = [
  { value: 'notion_to_html', label: 'Notion to HTML' },
  { value: 'string_to_number', label: 'String to Number' },
  { value: 'source_fk_to_dest_fk', label: 'Foreign Key Mapping' },
  { value: 'lookup_field', label: 'Lookup Field' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      keys.push(newKey);
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          // For arrays, maybe add index 0 to show structure, or just the array itself
          // keys.push(...flattenKeys(obj[key], newKey));
          // Arrays index notation like [0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          obj[key].forEach((item: any, index: number) => {
            if (typeof item === 'object' && item !== null) {
              keys.push(...flattenKeys(item, `${newKey}[${index}]`));
            } else {
              keys.push(`${newKey}[${index}]`);
            }
          });
        } else {
          keys.push(...flattenKeys(obj[key], newKey));
        }
      }
    }
  }
  return keys;
}

export function TestTransformerModal({ opened, onClose, workbookId, file }: TestTransformerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestTransformerResponse | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [fetchingPaths, setFetchingPaths] = useState(false);

  // Fetch file content when opened
  useState(() => {
    if (opened) {
      setFetchingPaths(true);
      workbookApi
        .getRepoFile(workbookId, file.path)
        .then((res) => {
          try {
            const json = JSON.parse(res.content);
            const flattened = flattenKeys(json);
            setPaths(flattened);
          } catch (e) {
            console.warn('Failed to parse file content or flatten keys', e);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch file content', err);
        })
        .finally(() => {
          setFetchingPaths(false);
        });
    }
  }); // Note: using useEffect would be better but useState lazy init or useEffect with dependency is fine.
  // Actually, I should use useEffect.

  const form = useForm({
    initialValues: {
      path: '',
      transformerType: 'notion_to_html' as TransformerType,
    },
    validate: {
      path: (value) => (value ? null : 'Path is required'),
      transformerType: (value) => (value ? null : 'Transformer type is required'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setResult(null);
    try {
      const response = await workbookApi.testTransformer(workbookId, {
        workbookId,
        fileId: file.path, // Using path as ID for now as per server implementation
        path: values.path,
        transformerConfig: {
          type: values.transformerType,
          options: {}, // Default options for now
          // For complex transformers, we'd need more inputs here
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
      setResult(response);
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error',
        message: 'Failed to test transformer',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <FlaskRoundIcon size={20} />
          <Title order={4}>Test Transformer</Title>
        </Group>
      }
      size="lg"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Testing on file: <Code>{file.name}</Code>
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Autocomplete
              label="JSON Path"
              placeholder={fetchingPaths ? 'Loading paths...' : 'e.g. properties.Name.title[0].plain_text'}
              description="Dot notation path to the value in the JSON file"
              data={paths}
              disabled={fetchingPaths}
              {...form.getInputProps('path')}
            />

            <Select label="Transformer" data={TRANSFORMER_TYPES} {...form.getInputProps('transformerType')} />

            <Button type="submit" loading={isLoading}>
              Apply
            </Button>
          </Stack>
        </form>

        {result && (
          <Stack gap="xs" mt="md" p="md" bg="var(--mantine-color-gray-0)" style={{ borderRadius: 8 }}>
            <Text size="sm" fw={500}>
              Result:
            </Text>
            {result.success ? (
              <>
                <Group align="flex-start">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed">
                      Original
                    </Text>
                    <Code block>{JSON.stringify(result.originalValue, null, 2)}</Code>
                  </Stack>
                  <ArrowRightIcon size={20} style={{ marginTop: 24 }} />
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed">
                      Transformed
                    </Text>
                    <Code block>{JSON.stringify(result.value, null, 2)}</Code>
                    {/* If HTML, maybe show preview? */}
                  </Stack>
                </Group>
              </>
            ) : (
              <Text c="red" size="sm">
                {result.error}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
