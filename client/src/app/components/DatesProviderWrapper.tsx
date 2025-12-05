'use client';

import { DatesProvider } from '@mantine/dates';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

// Extend dayjs with plugins
dayjs.extend(localizedFormat);

export function DatesProviderWrapper({ children }: { children: React.ReactNode }) {
  return <DatesProvider settings={{}}>{children}</DatesProvider>;
}
