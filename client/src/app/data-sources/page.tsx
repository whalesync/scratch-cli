'use client';

import MainContent from '../components/layouts/MainContent';
import ConnectorTable from './components/ConnectorTable';
import UploadsTable from './components/UploadsTable';

export default function DataSourcesPage() {
  return (
    <MainContent>
      <MainContent.BasicHeader title="Data sources" />
      <MainContent.Body>
        <ConnectorTable />
        <UploadsTable />
      </MainContent.Body>
    </MainContent>
  );
}
