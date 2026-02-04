import { DeleteWorkbookModal } from './DeleteWorkbookModal';
import { PullTableDataModal } from './PullTableDataModal';
import { RenameWorkbookModal } from './RenameWorkbookModal';

/**
 * A container for all of the modals that should be mounted at the top-level of the workbook editor page.
 * All modals here should be triggered through the WorkbookEditorUIStore.
 */
export const WorkbookEditorModals = () => {
  // TODO: Should we instantiate conditionally only if a modal is active?
  return (
    <>
      <RenameWorkbookModal />
      <DeleteWorkbookModal />
      <PullTableDataModal />
    </>
  );
};
