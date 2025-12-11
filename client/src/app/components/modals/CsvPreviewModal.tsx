'use client';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { SWR_KEYS } from '@/lib/api/keys';
import { CsvPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { PostgresColumnType } from '@/types/server-entities/workbook';
import { getColumnTypeIcon } from '@/utils/columns';
import {
  Checkbox,
  ComboboxData,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { RESERVED_COLUMN_NAMES } from '@spinner/shared-types';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { FC, useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { RouteUrls } from '../../../utils/route-urls';
import { ModalWrapper } from '../ModalWrapper';
import { ButtonPrimarySolid } from '../base/buttons';

// Custom type for modal that includes IGNORE option
type ModalColumnType = PostgresColumnType | 'IGNORE';

interface CsvPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  data: CsvPreviewResponse | null;
  fileName: string | null;
  file: File | null;
  previewError?: string | null;
  disableNavigation?: boolean; // If true, don't navigate after upload
}

// Function to get icon for modal column type (includes IGNORE)
const getModalColumnTypeIcon = (type: ModalColumnType) => {
  if (type === 'IGNORE') {
    return <StyledLucideIcon Icon={X} size={14} c="#ff0000" />;
  }
  return getColumnTypeIcon(type as PostgresColumnType);
};

export const CsvPreviewModal: FC<CsvPreviewModalProps> = ({
  opened,
  onClose,
  data,
  fileName,
  file,
  previewError,
  disableNavigation = false,
}) => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [columnTypes, setColumnTypes] = useState<ModalColumnType[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [relaxColumnCount, setRelaxColumnCount] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const { markStepCompleted } = useOnboardingUpdate();

  // Initialize column names and types when data changes
  useEffect(() => {
    if (data && data.rows.length > 0) {
      // Find the first success row to determine column count
      const firstSuccessRow = data.rows.find((row) => row.type === 'success');
      if (firstSuccessRow && firstSuccessRow.type === 'success') {
        const numColumns = firstSuccessRow.values.length;

        if (firstRowIsHeader) {
          // Use first success row as column names
          setColumnNames([...firstSuccessRow.values]);
        } else {
          // Use default column names
          setColumnNames(Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`));
        }

        // Initialize column types as text (default) - only when data changes, not when checkbox changes
        setColumnTypes(Array.from({ length: numColumns }, () => PostgresColumnType.TEXT));
      }
    }
  }, [data, firstRowIsHeader]); // Removed firstRowIsHeader from dependencies

  // Let the user override the filename.
  useEffect(() => {
    if (fileName) {
      setNewFileName(fileName);
    }
  }, [fileName]);

  // Update column names when checkbox changes
  useEffect(() => {
    if (data && data.rows.length > 0) {
      // Find the first success row to determine column count
      const firstSuccessRow = data.rows.find((row) => row.type === 'success');
      if (firstSuccessRow && firstSuccessRow.type === 'success') {
        const numColumns = firstSuccessRow.values.length;

        if (firstRowIsHeader) {
          setColumnNames([...firstSuccessRow.values]);
        } else {
          setColumnNames(Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`));
        }
      }
    }
  }, [firstRowIsHeader, data]);

  const handleColumnNameChange = (index: number, value: string) => {
    const newColumnNames = [...columnNames];
    newColumnNames[index] = value;
    setColumnNames(newColumnNames);
  };

  const handleColumnTypeChange = (index: number, value: string) => {
    const newColumnTypes = [...columnTypes];
    newColumnTypes[index] = value as ModalColumnType;
    setColumnTypes(newColumnTypes);
  };

  // Check for forbidden column names (excluding IGNORED columns)
  const forbiddenColumnIndices = useMemo(() => {
    return columnNames
      .map((name, index) => ({ name, index, type: columnTypes[index] }))
      .filter(({ name, type }) => type !== 'IGNORE' && RESERVED_COLUMN_NAMES.includes(name))
      .map(({ index }) => index);
  }, [columnNames, columnTypes]);

  const hasForbiddenColumns = forbiddenColumnIndices.length > 0;

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      // Filter out IGNORE columns before sending to server
      const filteredData = columnNames
        .map((name, index) => ({ name, type: columnTypes[index], index }))
        .filter(({ type }) => type !== 'IGNORE');

      const filteredColumnNames = filteredData.map(({ name }) => name);
      const filteredColumnTypes = filteredData.map(({ type }) => type as PostgresColumnType);
      const filteredColumnIndices = filteredData.map(({ index }) => index);

      const result = await uploadsApi.uploadCsv({
        file,
        uploadName: newFileName,
        columnNames: filteredColumnNames,
        columnTypes: filteredColumnTypes,
        columnIndices: filteredColumnIndices,
        firstRowIsHeader,
        advancedSettings: {
          relaxColumnCount,
        },
      });

      console.debug('CSV uploaded successfully:', result);

      // Optimistically complete the onboarding step
      markStepCompleted('gettingStartedV1', 'dataSourceConnected');

      // Invalidate uploads list cache (this will refresh the page if using SWR)
      await mutate(SWR_KEYS.uploads.list());

      // Close modal
      onClose();

      // Navigate to uploads page only if not already there and navigation is enabled
      if (!disableNavigation && pathname !== RouteUrls.dataSourcesPageUrl) {
        router.push(RouteUrls.dataSourcesPageUrl);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload CSV file';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  if (!data || data.rows.length === 0) return null;

  const { rows } = data;
  // When firstRowIsHeader is true: show rows 1 to N (skip first row, show all data rows)
  // When firstRowIsHeader is false: show rows 0 to N-1 (ignore last row to maintain consistent preview)
  const displayRows = firstRowIsHeader ? rows.slice(1) : rows.slice(0, -1);

  // Count error rows for display
  const errorRows = displayRows.filter((row) => row.type === 'error');
  // const successRows = displayRows.filter((row) => row.type === 'success');

  return (
    <>
      <style jsx>{`
        :global(.custom-select-dropdown) {
          width: 150px !important;
        }
      `}</style>
      <ModalWrapper
        customProps={{
          footer: (
            <>
              <Text size="sm" fw={500} style={{ minWidth: '120px' }}>
                Upload as:
              </Text>
              <TextInput
                value={newFileName}
                onChange={(event) => setNewFileName(event.currentTarget.value)}
                placeholder="Enter new name"
                style={{ flex: 1 }}
              />
              <Tooltip
                label="Some column names are reserved and cannot be used. Please rename or ignore them."
                disabled={!hasForbiddenColumns}
                withArrow
              >
                <div>
                  <ButtonPrimarySolid
                    onClick={handleUpload}
                    loading={isUploading}
                    size="md"
                    disabled={hasForbiddenColumns}
                  >
                    Upload
                  </ButtonPrimarySolid>
                </div>
              </Tooltip>
            </>
          ),
        }}
        opened={opened}
        onClose={onClose}
        title="Uploading CSV data source"
        size="80%"
      >
        <Stack gap="xl">
          {/* Preview error - shows if CSV parsing failed */}
          {previewError && (
            <div
              style={{ padding: '12px', border: '2px solid #d63031', backgroundColor: '#ffe5e5', borderRadius: '4px' }}
            >
              <Text size="sm" fw={600} c="#d63031">
                ❌ CSV Parsing Error
              </Text>
              <Text size="sm" c="#d63031" mt={4}>
                {previewError}
              </Text>
            </div>
          )}

          {/* Upload error - shows if upload/import failed */}
          {uploadError && (
            <div
              style={{ padding: '12px', border: '2px solid #d63031', backgroundColor: '#ffe5e5', borderRadius: '4px' }}
            >
              <Text size="sm" fw={600} c="#d63031">
                ❌ Upload Error
              </Text>
              <Text size="sm" c="#d63031" mt={4}>
                {uploadError}
              </Text>
            </div>
          )}

          {/* Error summary for rows with parsing issues */}
          {errorRows.length > 0 && (
            <div style={{ padding: '8px', border: '0.5px solid #ffeaa7' }}>
              <Text size="sm" fw={500}>
                ⚠️ {errorRows.length} of {displayRows.length} rows had parsing issues and might be skipped during import
              </Text>
            </div>
          )}

          {/* Header checkbox and advanced settings toggle */}
          <Group justify="space-between" align="center">
            <Checkbox
              checked={firstRowIsHeader}
              onChange={(event) => setFirstRowIsHeader(event.currentTarget.checked)}
              label="First row is a header"
            />
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              {showAdvancedSettings ? 'Hide' : 'Show'} advanced settings
            </Text>
          </Group>

          {/* Advanced settings section */}
          {showAdvancedSettings && (
            <Stack gap="xs" p="md" style={{ border: '0.5px solid #e0e0e0', borderRadius: '4px' }}>
              <Text size="sm" fw={600}>
                Advanced Settings
              </Text>
              <Checkbox
                checked={relaxColumnCount}
                onChange={(event) => setRelaxColumnCount(event.currentTarget.checked)}
                label="Relax column count (allow rows with different number of columns)"
              />
            </Stack>
          )}

          {/* Combined header table with column types and names */}
          <div
            style={{
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <Table highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                {/* Combined column type and name row */}
                <Table.Tr>
                  {columnNames.map((name, index) => {
                    const isForbidden = forbiddenColumnIndices.includes(index);
                    return (
                      <Table.Th
                        key={`header-${index}`}
                        style={{
                          padding: '4px',
                          backgroundColor: isForbidden
                            ? '#ffe5e5'
                            : colorScheme === 'dark'
                              ? theme.colors.dark[6]
                              : theme.colors.gray[1],
                          borderBottom: `2px solid ${isForbidden ? '#d63031' : colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                          minWidth: '100px',
                          maxWidth: '200px',
                          width: '150px',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Tooltip
                          label={`"${name}" is a reserved column name. Please rename or set to ignore.`}
                          disabled={!isForbidden}
                          withArrow
                          color="red"
                        >
                          <Group gap={2} align="center" wrap="nowrap" style={{ width: '100%' }}>
                            {/* Column name input */}
                            <TextInput
                              value={name}
                              onChange={(event) => handleColumnNameChange(index, event.currentTarget.value)}
                              size="xs"
                              style={{ flex: 1, minWidth: 0 }}
                              styles={{
                                input: {
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  padding: '2px 4px',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  color: isForbidden ? '#d63031' : undefined,
                                  fontWeight: isForbidden ? 600 : undefined,
                                },
                              }}
                            />
                            {/* Type selector with icon in dropdown only */}
                            <Select
                              value={columnTypes[index]}
                              onChange={(value) => value && handleColumnTypeChange(index, value)}
                              data={[
                                ...Object.values(PostgresColumnType).map((type) => ({
                                  value: type,
                                  label: type,
                                  leftSection: getColumnTypeIcon(type),
                                })),
                                {
                                  value: 'IGNORE',
                                  label: 'ignore',
                                  leftSection: <StyledLucideIcon Icon={X} size={14} c="#ff0000" />,
                                } as ComboboxData[0],
                              ]}
                              size="xs"
                              renderOption={(option) => (
                                <Group>
                                  {getModalColumnTypeIcon(option.option.value as ModalColumnType)} {option.option.label}
                                </Group>
                              )}
                              w={50}
                              styles={{
                                input: {
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  padding: '2px 4px',
                                  color: 'transparent', // Hide the text
                                },
                              }}
                              classNames={{
                                dropdown: 'custom-select-dropdown',
                              }}
                              leftSection={getModalColumnTypeIcon(columnTypes[index])}
                            />
                          </Group>
                        </Tooltip>
                      </Table.Th>
                    );
                  })}
                </Table.Tr>
              </Table.Thead>
              {/* Data rows */}
              <Table.Tbody>
                {displayRows.map((row, rowIndex) => {
                  if (row.type === 'error') {
                    // Error row - span all columns
                    return (
                      <Table.Tr key={rowIndex} style={{ backgroundColor: '#fff3cd' }}>
                        <Table.Td
                          colSpan={columnNames.length}
                          style={{
                            padding: '8px',
                            textAlign: 'center',
                            color: '#d63031',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          ⚠️ {row.error.join('; ')}
                        </Table.Td>
                      </Table.Tr>
                    );
                  } else {
                    // Success row - show values
                    return (
                      <Table.Tr key={rowIndex}>
                        {row.values.map((value, colIndex) => (
                          <Table.Td
                            key={colIndex}
                            style={{
                              minWidth: '140px',
                              maxWidth: '200px',
                              width: '150px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {value || ''}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    );
                  }
                })}
              </Table.Tbody>
            </Table>
          </div>
        </Stack>
      </ModalWrapper>
    </>
  );
};
