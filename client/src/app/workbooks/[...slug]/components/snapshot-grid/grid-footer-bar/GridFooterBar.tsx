'use client';

import { SnapshotTable } from '@/types/server-entities/workbook';
import { Box, Group } from '@mantine/core';
import { ColumnsFooterButton } from './buttons/ColumnsFooterButton';
import { DevWebocketFooterButton } from './buttons/DevWebocketFooterButton';
import { FilterFooterButton } from './buttons/FilterFooterButton';
import { HelpMenuFooterButton } from './buttons/HelpMenuFooterButton';
import { LastUpdatedFooterButton } from './buttons/LastUpdatedFooterButton';
import { NewRecordFooterButton } from './buttons/NewRecordFooterButton';
import { PageSizeFooterButton } from './buttons/PageSizeFooterButton';
import { UnpublishedChangesFooterButton } from './buttons/UnpublishedChangesFooterButton';
import styles from './GridFooterBar.module.css';

export const GridFooterBar = ({ table }: { table: SnapshotTable }) => {
  return (
    <>
      <Group className={styles.toolbar}>
        <NewRecordFooterButton table={table} />
        <FilterFooterButton table={table} />
        <PageSizeFooterButton table={table} />
        <ColumnsFooterButton table={table} />
        {/* Add as soon as we have some table-specific menu items. */}
        {/* <MoreFooterMenuButton table={table} /> */}
        <Box flex={1}>{/* Whitespace */}</Box>
        <UnpublishedChangesFooterButton table={table} />
        <LastUpdatedFooterButton table={table} />
        <HelpMenuFooterButton />
        <DevWebocketFooterButton />
      </Group>
    </>
  );
};
