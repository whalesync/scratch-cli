'use client';

import { useSnapshot } from '@/hooks/use-snapshot';
import { useUpsertView, useViews } from '@/hooks/use-view';
import { Snapshot } from '@/types/server-entities/snapshot';
import { ColumnView, ViewConfig } from '@/types/server-entities/view';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface SnapshotContextValue {
  snapshot: Snapshot | undefined;
  views: ColumnView[] | undefined;
  currentViewId: string | null;
  currentView: ColumnView | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshViews: (() => Promise<ColumnView[] | undefined>) | undefined;
  publish: (() => Promise<void>) | undefined;
  setCurrentViewId: (viewId: string | null) => void;
  createView: (config: ViewConfig, name?: string) => Promise<string>;
  selectView: (viewId: string | null) => void;
  updateTableInCurrentView: (tableId: string, tableConfig: Record<string, unknown>) => Promise<void>;
}

const SnapshotContext = createContext<SnapshotContextValue | undefined>(undefined);

interface SnapshotProviderProps {
  snapshotId: string;
  children: ReactNode;
}

export const SnapshotProvider = ({ snapshotId, children }: SnapshotProviderProps) => {
  const { snapshot, isLoading: snapshotLoading, error: snapshotError, publish } = useSnapshot(snapshotId);
  const { views, isLoading: viewsLoading, error: viewsError, refreshViews } = useViews(snapshotId);
  const { upsertView } = useUpsertView();
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);

  // Get the current view based on currentViewId
  const currentView = views?.find((v) => v.id === currentViewId);

  const createView = useCallback(
    async (config: ViewConfig, name?: string): Promise<string> => {
      if (!snapshot) {
        throw new Error('Snapshot not available');
      }

      const result = await upsertView({
        snapshotId: snapshot.id,
        config,
        name,
      });

      // Refresh views after creation
      await refreshViews?.();

      return result.id;
    },
    [snapshot, upsertView, refreshViews],
  );

  const selectView = useCallback((viewId: string | null) => {
    setCurrentViewId(viewId);
  }, []);

  const updateTableInCurrentView = useCallback(
    async (tableId: string, tableConfig: Record<string, unknown>): Promise<void> => {
      if (!snapshot || !currentView) {
        throw new Error('Snapshot or current view not available');
      }

      const newConfig = {
        ...currentView.config,
        [tableId]: tableConfig,
      };

      await upsertView({
        id: currentView.id,
        name: currentView.name || undefined,
        snapshotId: snapshot.id,
        config: newConfig,
      });

      // Refresh views after update
      await refreshViews?.();
    },
    [snapshot, currentView, upsertView, refreshViews],
  );

  const value: SnapshotContextValue = {
    snapshot,
    views,
    currentViewId,
    currentView,
    isLoading: snapshotLoading || viewsLoading,
    error: snapshotError || viewsError,
    refreshViews,
    publish,
    setCurrentViewId,
    createView,
    selectView,
    updateTableInCurrentView,
  };

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
};

export const useSnapshotContext = () => {
  const context = useContext(SnapshotContext);
  if (context === undefined) {
    throw new Error('useSnapshotContext must be used within a SnapshotProvider');
  }
  return context;
};
