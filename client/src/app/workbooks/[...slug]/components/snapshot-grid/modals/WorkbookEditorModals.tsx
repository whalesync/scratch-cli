import { CreateScratchColumnModal } from './CreateScratchColumnModal';
import { DeleteWorkbookModal } from './DeleteWorkbookModal';
import { KeyboardShortcutHelpModal } from './KeyboardShortcutHelpModal';
import { RefreshTableDataModal } from './RefreshTableDataModal';
import { RenameWorkbookModal } from './RenameWorkbookModal';

/**
 * A container for all of the modals that should be mounted at the top-level of the workbook editor page.
 * All modals here should be triggered through the WorkbookEditorUIStore.
 */
export const WorkbookEditorModals = () => {
  // TODO: Should we instantiate conditionally only if a modal is active?
  return (
    <>
      <CreateScratchColumnModal />
      <KeyboardShortcutHelpModal />
      <RenameWorkbookModal />
      <DeleteWorkbookModal />
      <RefreshTableDataModal />
    </>
  );
};
