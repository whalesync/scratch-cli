import { HelpCircleIcon } from 'lucide-react';
import { useWorkbookEditorUIStore, WorkbookModals } from '../../../../../../../stores/workbook-editor-store';
import { ToolIconButton } from '../../../../../../components/ToolIconButton';

export const HelpMenuFooterButton = () => {
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);
  return (
    <>
      <ToolIconButton
        icon={HelpCircleIcon}
        onClick={() => showModal({ type: WorkbookModals.KEYBOARD_SHORTCUT_HELP })}
        size="md"
      />
    </>
  );
};
