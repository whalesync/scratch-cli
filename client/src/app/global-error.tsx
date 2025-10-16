'use client';

import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { ErrorInfo } from './components/InfoPanel';
import { SCRATCHPAD_MANTINE_THEME } from './components/theme/theme';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no" />
      </head>

      <body>
        <MantineProvider theme={SCRATCHPAD_MANTINE_THEME} defaultColorScheme="light">
          <ErrorInfo error={error} title="An error occurred" />
        </MantineProvider>
      </body>
    </html>
  );
}
