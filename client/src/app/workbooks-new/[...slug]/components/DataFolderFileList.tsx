'use client';

import '@/ag-grid-css';
import { Text13Regular, TextMono12Regular } from '@/app/components/base/text';
import { ErrorInfo } from '@/app/components/InfoPanel';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { useDataFolderFiles } from '@/hooks/use-data-folder-files';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Box, Center, Group, LoadingOverlay, useMantineColorScheme } from '@mantine/core';
import { DataFolderId, FileId } from '@spinner/shared-types';
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
import { FileIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataFolder } from '../../../../hooks/use-data-folder';
import styles from './DataFolderFileList.module.css';

const LOCK_POLL_INTERVAL_MS = 1000;

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// AG Grid constants (matching SnapshotGrid)
const AG = {
  grid: {
    defaultMinWidth: 150,
    defaultFlex: 1,
  },
} as const;

interface DataFolderFileListProps {
  dataFolderId: DataFolderId | null;
}

// Type icon cell renderer
const typeIconRenderer = () => {
  return (
    <Group
      style={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: '8px',
        paddingRight: '8px',
      }}
    >
      <FileIcon size={16} color="var(--fg-secondary)" />
    </Group>
  );
};

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

export const DataFolderFileList = ({ dataFolderId }: DataFolderFileListProps) => {
  const { dataFolder, isLoading: folderLoading, refresh: refreshFolder } = useDataFolder(dataFolderId);
  const { files, isLoading: filesLoading, error, refresh: refreshFiles } = useDataFolderFiles(dataFolderId);
  const { colorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);

  const handleFileClick = useCallback(
    (fileId: FileId, fileName: string, filePath: string) => {
      openFileTab({ id: fileId, type: 'file', title: fileName, path: filePath });
    },
    [openFileTab],
  );

  // Track previous lock state to detect transitions
  const prevLockRef = useRef(dataFolder?.lock);

  // Poll for folder updates while download is in progress
  useEffect(() => {
    // Check if lock transitioned from 'download' to null
    if (prevLockRef.current === 'download' && dataFolder?.lock === null) {
      refreshFiles();
    }
    prevLockRef.current = dataFolder?.lock;
  }, [dataFolder?.lock, refreshFiles]);

  useEffect(() => {
    if (dataFolder?.lock !== 'download') {
      return;
    }

    const intervalId = setInterval(() => {
      refreshFolder();
    }, LOCK_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [dataFolder?.lock, refreshFolder]);

  // Create column definitions for AGGrid
  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        field: 'itemType',
        headerName: '',
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        resizable: false,
        sortable: false,
        cellRenderer: typeIconRenderer,
        suppressHeaderMenuButton: true,
      },
      {
        field: 'filename',
        headerName: 'Name',
        minWidth: AG.grid.defaultMinWidth,
        flex: AG.grid.defaultFlex,
        cellRenderer: cellRenderer,
        headerComponent: CustomHeaderComponent,
      },
    ];
  }, []);

  // Transform files into row data format
  const rowData = useMemo(() => {
    return files
      .map((file) => ({
        id: file.fileId,
        fileId: file.fileId,
        filename: file.filename,
        path: file.path,
        itemType: 'file' as const,
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename));
  }, [files]);

  if (error) {
    return (
      <Center h="100%">
        <ErrorInfo title="Error loading folder contents" description={error.message} />
      </Center>
    );
  }

  if (folderLoading || filesLoading) {
    return (
      <Center h="100%">
        <LoaderWithMessage message="Loading folder details..." centered />
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: 'relative' }}>
      <LoadingOverlay
        visible={dataFolder?.lock === 'download'}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 2 }}
        loaderProps={{ children: 'Download in progress...' }}
      />
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
          overlayNoRowsTemplate="<span>No files in this folder</span>"
          onRowClicked={(event: RowClickedEvent) => {
            if (event.data?.fileId) {
              handleFileClick(event.data.fileId, event.data.filename, event.data.path);
            }
          }}
        />
      </div>
    </Box>
  );
};
