'use client';

import MainContent from '../components/MainContent';
import { ApiImport } from './components/ai-connector-builder';
import { AiConnectorBuilderProvider } from './components/ai-connector-builder-context';

export default function ApiImportDemoPage() {
  return (
    <MainContent>
      <MainContent.BasicHeader title="AI Connector Builder" />
      <MainContent.Body>
        <AiConnectorBuilderProvider>
          <ApiImport />
        </AiConnectorBuilderProvider>
      </MainContent.Body>
    </MainContent>
  );
}
