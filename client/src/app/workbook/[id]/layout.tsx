'use client';

import { FullPageLoader } from '@/app/components/FullPageLoader';
import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { useWorkbook } from '@/hooks/use-workbook';
import { useNewWorkbookUIStore } from '@/stores/new-workbook-ui-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import type { WorkbookId } from '@spinner/shared-types';
import { ArrowLeftIcon } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { WorkbookLayout } from './components/WorkbookLayout';

interface LayoutProps {
  children: ReactNode;
}

export default function NewWorkbookLayout({ children }: LayoutProps) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workbookId = params.id as WorkbookId;

  const { workbook, isLoading, error } = useWorkbook(workbookId);
  const reset = useNewWorkbookUIStore((state) => state.reset);

  // Initialize the workbook editor store so useDataFolders can work
  // Note: We only set the workbookId, we don't call reconcileWithWorkbook
  // because it would redirect to the old UI URL
  const openWorkbook = useWorkbookEditorUIStore((state) => state.openWorkbook);
  const closeWorkbook = useWorkbookEditorUIStore((state) => state.closeWorkbook);

  // Initialize workbook editor store (just sets workbookId for useDataFolders to work)
  useEffect(() => {
    openWorkbook({ workbookId });

    return () => {
      closeWorkbook();
      reset();
    };
  }, [workbookId, openWorkbook, closeWorkbook, reset]);

  if (isLoading && !workbook) {
    return <FullPageLoader message="Loading workbook..." />;
  }

  if (error || !workbook) {
    return (
      <PageLayout pageTitle="Unknown Workbook">
        <MainContent>
          <MainContent.BasicHeader title="" />
          <MainContent.Body>
            <ErrorInfo
              title="Workbook not found."
              description="We were unable to find the workbook you are looking for."
              action={
                <Info.ActionButton
                  label="Return home"
                  Icon={ArrowLeftIcon}
                  onClick={() => router.push(RouteUrls.homePageUrl)}
                />
              }
            />
          </MainContent.Body>
        </MainContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout pageTitle={workbook.name ?? 'Workbook'} navVariant="drawer">
      <WorkbookLayout workbook={workbook}>{children}</WorkbookLayout>
    </PageLayout>
  );
}
