'use client';

import '@/ag-grid-css';
import { Text13Regular, TextMono12Regular } from '@/app/components/base/text';
import { ErrorInfo } from '@/app/components/InfoPanel';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { useFileDetailsList } from '@/hooks/use-file-details-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Box, Center, Group, Text, useMantineColorScheme } from '@mantine/core';
import { FileDetailsEntity, FileId, FolderId, WorkbookId } from '@spinner/shared-types';
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  IHeaderParams,
  ModuleRegistry,
  RowClickedEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import matter from 'gray-matter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './FolderDetailViewer.module.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// AG Grid constants (matching SnapshotGrid)
const AG = {
  grid: {
    defaultMinWidth: 150,
    defaultFlex: 1,
  },
} as const;

interface FileWithMetadata extends FileDetailsEntity {
  metadata: Record<string, unknown>;
}

interface FolderDetailViewerProps {
  workbookId: WorkbookId;
  folderId: FolderId | null;
}

// Minimal cell renderer matching FieldValueWrapper styling
const cellRenderer = (params: ICellRendererParams) => {
  const value = params.value;
  const formattedValue = value !== null && value !== undefined ? String(value) : '';

  return (
    <Group
      style={{
        height: '100%',
        alignItems: 'center',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '8px',
      }}
    >
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <TextMono12Regular
          c="var(--fg-primary)"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {formattedValue}
        </TextMono12Regular>
      </Box>
    </Group>
  );
};

// Custom header component matching SnapshotGrid header styling
const CustomHeaderComponent = (props: IHeaderParams) => {
  const [currentSort, setCurrentSort] = useState(props.column.getSort());

  // Monitor sort changes and update local state
  useEffect(() => {
    const sortState = props.column.getSort();
    setCurrentSort(sortState);
  }, [props.column]);

  // Listen for sort changes from grid API
  useEffect(() => {
    if (props.api) {
      const handleSortChanged = () => {
        const actualSort = props.column.getSort();
        setCurrentSort(actualSort);
      };

      props.api.addEventListener('sortChanged', handleSortChanged);

      return () => {
        props.api?.removeEventListener('sortChanged', handleSortChanged);
      };
    }
  }, [props.api, props.column]);

  const handleHeaderClick = () => {
    if (!props.enableSorting) return;

    // Toggle sort when clicking on header text
    let newSort: 'asc' | 'desc' | null;
    if (currentSort === 'asc') {
      newSort = 'desc';
    } else if (currentSort === 'desc') {
      newSort = null;
    } else {
      newSort = 'asc';
    }

    props.setSort(newSort);
    setCurrentSort(newSort);
  };

  return (
    <Group
      wrap="nowrap"
      gap="xs"
      onClick={handleHeaderClick}
      style={{
        position: 'relative',
        display: 'flex',
        height: '100%',
        width: '100%',
        alignItems: 'center',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '8px',
        flex: 1,
        cursor: props.enableSorting ? 'pointer' : 'default',
      }}
    >
      <Text13Regular
        c="var(--fg-secondary)"
        style={{
          overflow: 'hidden',
          minWidth: 0,
          flexShrink: 1,
          flexGrow: 0,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {props.displayName}
      </Text13Regular>

      {props.enableSorting && (currentSort === 'asc' || currentSort === 'desc') && (
        <Box c="var(--fg-secondary)" style={{ flexShrink: 0 }}>
          {currentSort === 'asc' && '↑'}
          {currentSort === 'desc' && '↓'}
        </Box>
      )}
    </Group>
  );
};

export const FolderDetailViewer = ({ workbookId, folderId }: FolderDetailViewerProps) => {
  const { files, isLoading, error } = useFileDetailsList(workbookId, folderId);
  const { colorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);

  // Parse front matter from all files and extract metadata
  const { processedFiles, metadataColumns } = useMemo(() => {
    if (!files?.files) {
      return { processedFiles: [], metadataColumns: [] };
    }

    const metadataKeys = new Set<string>();
    const processed: FileWithMetadata[] = files.files.map((file) => {
      let metadata: Record<string, unknown> = {};

      if (file.content) {
        try {
          const parsed = matter(file.content);
          metadata = parsed.data;

          // Collect all unique metadata keys
          Object.keys(metadata).forEach((key) => metadataKeys.add(key));
        } catch (err) {
          console.debug(`Failed to parse front matter for ${file.ref.name}:`, err);
        }
      }

      return {
        ...file,
        metadata,
      };
    });

    // Sort metadata keys alphabetically for consistent column order
    const sortedKeys = Array.from(metadataKeys).sort();

    return { processedFiles: processed, metadataColumns: sortedKeys };
  }, [files]);

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const handleFileClick = useCallback(
    (fileId: FileId, fileName: string) => {
      openFileTab({ id: fileId, type: 'file', title: fileName });
    },
    [openFileTab],
  );

  // Create column definitions for AGGrid
  const columnDefs = useMemo<ColDef[]>(() => {
    const baseColumns: ColDef[] = [
      {
        field: 'fileName',
        headerName: 'File Name',
        minWidth: AG.grid.defaultMinWidth,
        flex: AG.grid.defaultFlex,
        cellRenderer: cellRenderer,
        headerComponent: CustomHeaderComponent,
      },
    ];

    const metadataCols: ColDef[] = metadataColumns.map((key) => ({
      field: `metadata.${key}`,
      headerName: key.charAt(0).toUpperCase() + key.slice(1),
      minWidth: AG.grid.defaultMinWidth,
      flex: AG.grid.defaultFlex,
      cellRenderer: cellRenderer,
      headerComponent: CustomHeaderComponent,
      valueGetter: (params) => {
        return params.data?.metadata?.[key];
      },
      valueFormatter: (params) => formatValue(params.value),
    }));

    return [...baseColumns, ...metadataCols];
  }, [metadataColumns]);

  // Transform processed files into row data format
  const rowData = useMemo(() => {
    return processedFiles.map((file) => ({
      id: file.ref.id,
      fileName: file.ref.name,
      fileId: file.ref.id as FileId,
      updatedAt: file.updatedAt,
      createdAt: file.createdAt,
      metadata: file.metadata,
    }));
  }, [processedFiles]);

  if (error) {
    return (
      <Center h="100%">
        <ErrorInfo title="Error loading folder details" description={error.message} />
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center h="100%">
        <LoaderWithMessage message="Loading folder details..." centered />
      </Center>
    );
  }

  if (!files) {
    return (
      <Center h="100%">
        <Text>No files found</Text>
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: 'relative' }}>
      <div
        className={`${isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} my-grid ${styles['ag-grid-container']}`}
        style={{
          height: '100%',
          width: '100%',
          overflow: 'auto',
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => params.data.id}
          defaultColDef={{
            flex: AG.grid.defaultFlex,
            minWidth: AG.grid.defaultMinWidth,
            resizable: true,
            sortable: true,
            filter: false,
          }}
          rowHeight={36}
          headerHeight={35}
          animateRows={false}
          suppressColumnMoveAnimation={true}
          suppressAnimationFrame={true}
          rowSelection="multiple"
          theme="legacy"
          suppressCellFocus={false}
          enableCellTextSelection={true}
          suppressContextMenu={false}
          suppressFocusAfterRefresh={true}
          maintainColumnOrder={true}
          stopEditingWhenCellsLoseFocus={false}
          onRowClicked={(event: RowClickedEvent) => {
            if (event.data?.fileId) {
              handleFileClick(event.data.fileId, event.data.fileName);
            }
          }}
        />
      </div>
    </Box>
  );
};
