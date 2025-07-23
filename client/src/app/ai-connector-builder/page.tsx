'use client';

import { ApiImport } from './components/ai-connector-builder';
import { AiConnectorBuilderProvider } from './components/ai-connector-builder-context';

export default function ApiImportDemoPage() {
  return (
    <AiConnectorBuilderProvider>
      <ApiImport />
    </AiConnectorBuilderProvider>
  );
}
