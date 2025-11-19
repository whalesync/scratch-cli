import { useDisclosure } from '@mantine/hooks';
import { HelpCircleIcon } from 'lucide-react';
import { useEffect } from 'react';
import { KeyboardShortcutHelpModal } from '../../../../../../components/KeyboardShortcutHelpModal';
import { ToolIconButton } from '../../../../../../components/ToolIconButton';

export const HelpMenuFooterButton = () => {
  const [helpOverlayOpen, { open: openHelpOverlay, close: closeHelpOverlay }] = useDisclosure(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'h') {
        event.preventDefault();
        openHelpOverlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openHelpOverlay]);

  return (
    <>
      <ToolIconButton icon={HelpCircleIcon} onClick={openHelpOverlay} size="md" />
      <KeyboardShortcutHelpModal opened={helpOverlayOpen} onClose={closeHelpOverlay} />
    </>
  );
};
