'use client';

import MainContent from '../components/layouts/MainContent';
import ConnectorTable from './components/ConnectorTable';

export default function DataSourcesPage() {
  return (
    <MainContent>
      <MainContent.BasicHeader title="Data sources" />
      <MainContent.Body>
        <ConnectorTable />
      </MainContent.Body>
    </MainContent>
  );
}
