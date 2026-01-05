'use client';

import '@/ag-grid-css';
import { useFileDetailsList } from '@/hooks/use-file-details-list';
import { Box, Center, Text, useMantineColorScheme } from '@mantine/core';
import { FileDetailsEntity, WorkbookId } from '@spinner/shared-types';
import { AllCommunityModule, ColDef, ModuleRegistry, RowClickedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import matter from 'gray-matter';
import { useCallback, useMemo } from 'react';
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
  folderPath: string;
  // NOTE: these should all go into the workbook editor UI store
  setOpenTabs: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const FolderDetailViewer = ({
  workbookId,
  folderPath,
  setOpenTabs,
  setActiveTabId,
}: FolderDetailViewerProps) => {
  const { files, isLoading, error } = useFileDetailsList(workbookId, folderPath);
  const { colorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';

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
    (filePath: string) => {
      setOpenTabs((prev) => {
        if (!prev.includes(filePath)) {
          return [...prev, filePath];
        }
        return prev;
      });
      setActiveTabId(filePath);
    },
    [setOpenTabs, setActiveTabId],
  );

  // Create column definitions for AGGrid
  const columnDefs = useMemo<ColDef[]>(() => {
    const baseColumns: ColDef[] = [
      {
        field: 'fileName',
        headerName: 'File Name',
        minWidth: AG.grid.defaultMinWidth,
        flex: AG.grid.defaultFlex,
      },
      {
        field: 'updatedAt',
        headerName: 'Updated Date',
        minWidth: AG.grid.defaultMinWidth,
        flex: AG.grid.defaultFlex,
        valueFormatter: (params) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleString();
        },
      },
      {
        field: 'createdAt',
        headerName: 'Created Date',
        minWidth: AG.grid.defaultMinWidth,
        flex: AG.grid.defaultFlex,
        valueFormatter: (params) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleString();
        },
      },
    ];

    const metadataCols: ColDef[] = metadataColumns.map((key) => ({
      field: `metadata.${key}`,
      headerName: key.charAt(0).toUpperCase() + key.slice(1),
      minWidth: AG.grid.defaultMinWidth,
      flex: AG.grid.defaultFlex,
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
      filePath: file.ref.path,
      updatedAt: file.updatedAt,
      createdAt: file.createdAt,
      metadata: file.metadata,
    }));
  }, [processedFiles]);

  if (error) {
    return (
      <Center h="100%">
        <Text>Error: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center h="100%">
        <Text>Loading...</Text>
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
        className={`${isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} my-grid ${styles.agGridContainer}`}
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
            if (event.data?.filePath) {
              handleFileClick(event.data.filePath);
            }
          }}
        />
      </div>
    </Box>
  );
};
