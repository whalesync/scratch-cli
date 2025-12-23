import { IconButtonOutline } from '@/app/components/base/buttons';
import { Group, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import DOMPurify from 'dompurify';
import { EyeIcon, TextAlignEndIcon, TextAlignJustifyIcon } from 'lucide-react';
import htmlParser from 'prettier/plugins/html';
import prettier from 'prettier/standalone';
import { useCallback } from 'react';

interface HtmlActionButtonsProps {
  value: string;
  onUpdate: (value: string) => void;
  disabled?: boolean;
}

export const HtmlActionButtons = ({ value, onUpdate, disabled = false }: HtmlActionButtonsProps) => {
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);

  const handleFormatHtml = useCallback(async () => {
    if (disabled) return;
    try {
      const formatted = await prettier.format(value || '', {
        parser: 'html',
        plugins: [htmlParser],
        printWidth: 80,
        tabWidth: 2,
      });
      onUpdate(formatted.trim());
    } catch {
      // If formatting fails, leave as-is
    }
  }, [value, onUpdate, disabled]);

  const handleMinifyHtml = useCallback(() => {
    if (disabled) return;
    const minified = (value || '')
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+>/g, '>') // Remove whitespace before closing >
      .replace(/<\s+/g, '<') // Remove whitespace after opening <
      .trim();
    onUpdate(minified);
  }, [value, onUpdate, disabled]);

  return (
    <>
      <Modal opened={previewOpened} onClose={closePreview} title="HTML Preview" size="xl" centered>
        <iframe
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:8px;font-family:system-ui,sans-serif;">${DOMPurify.sanitize(value || '')}</body></html>`}
          style={{ width: '100%', height: 400, border: 'none' }}
          sandbox="allow-same-origin"
          title="HTML Preview"
        />
      </Modal>
      <Group gap={4}>
        <Tooltip label="Preview" position="bottom" withArrow>
          <IconButtonOutline size="compact-xs" onClick={openPreview} disabled={disabled}>
            <EyeIcon size={13} />
          </IconButtonOutline>
        </Tooltip>
        <Tooltip label="Prettify" position="bottom" withArrow>
          <IconButtonOutline size="compact-xs" onClick={handleFormatHtml} disabled={disabled}>
            <TextAlignEndIcon size={13} />
          </IconButtonOutline>
        </Tooltip>
        <Tooltip label="Minify" position="bottom" withArrow>
          <IconButtonOutline size="compact-xs" onClick={handleMinifyHtml} disabled={disabled}>
            <TextAlignJustifyIcon size={13} />
          </IconButtonOutline>
        </Tooltip>
      </Group>
    </>
  );
};
