'use client';

import { Box, Button, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import type { FolderId, FolderRefEntity } from '@spinner/shared-types';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, HomeIcon } from 'lucide-react';
import { useState } from 'react';

interface FolderPickerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (folderId: FolderId | null) => void;
  folders: FolderRefEntity[];
  title?: string;
  confirmText?: string;
}

interface FolderTreeNodeProps {
  folder: FolderRefEntity;
  allFolders: FolderRefEntity[];
  depth: number;
  selectedFolderId: FolderId | null;
  expandedFolders: Set<string>;
  onSelect: (folderId: FolderId) => void;
  onToggle: (folderId: FolderId) => void;
}

function FolderTreeNode({
  folder,
  allFolders,
  depth,
  selectedFolderId,
  expandedFolders,
  onSelect,
  onToggle,
}: FolderTreeNodeProps) {
  const childFolders = allFolders.filter((f) => f.parentFolderId === folder.id);
  const hasChildren = childFolders.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const indent = depth * 18;

  return (
    <>
      <Group
        gap="xs"
        h={28}
        pl={indent + 6}
        pr="xs"
        wrap="nowrap"
        onClick={() => onSelect(folder.id)}
        bg={isSelected ? 'var(--mantine-color-blue-1)' : 'transparent'}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
          border: isSelected ? '1px solid var(--mantine-color-blue-4)' : '1px solid transparent',
        }}
        className="folder-tree-node"
      >
        {hasChildren ? (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {isExpanded ? (
              <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
            )}
          </Box>
        ) : (
          <Box w={14} style={{ flexShrink: 0 }} />
        )}
        <FolderIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
        <Text size="sm" c={isSelected ? 'var(--mantine-color-blue-7)' : 'var(--fg-primary)'} truncate style={{ flex: 1, minWidth: 0 }}>
          {folder.name}
        </Text>
      </Group>
      {hasChildren && isExpanded && (
        <>
          {childFolders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </>
      )}
    </>
  );
}

export function FolderPickerModal({
  opened,
  onClose,
  onSelect,
  folders,
  title = 'Select Destination Folder',
  confirmText = 'Confirm',
}: FolderPickerModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<FolderId | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Get root-level folders
  const rootFolders = folders.filter((f) => f.parentFolderId === null);

  const handleToggle = (folderId: FolderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSelect = (folderId: FolderId | null) => {
    setSelectedFolderId(folderId);
  };

  const handleConfirm = () => {
    onSelect(selectedFolderId);
    onClose();
  };

  const isRootSelected = selectedFolderId === null;

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <Stack gap="md">
        <ScrollArea h={250} style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
          <Stack gap={2} p="xs">
            {/* Root option */}
            <Group
              gap="xs"
              h={28}
              px="xs"
              wrap="nowrap"
              onClick={() => handleSelect(null)}
              bg={isRootSelected ? 'var(--mantine-color-blue-1)' : 'transparent'}
              style={{
                cursor: 'pointer',
                borderRadius: '4px',
                border: isRootSelected ? '1px solid var(--mantine-color-blue-4)' : '1px solid transparent',
              }}
            >
              <HomeIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
              <Text size="sm" c={isRootSelected ? 'var(--mantine-color-blue-7)' : 'var(--fg-primary)'} fw={500}>
                Workbook Root
              </Text>
            </Group>

            {/* Folder tree */}
            {rootFolders.map((folder) => (
              <FolderTreeNode
                key={folder.id}
                folder={folder}
                allFolders={folders}
                depth={0}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onSelect={handleSelect}
                onToggle={handleToggle}
              />
            ))}
          </Stack>
        </ScrollArea>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            {confirmText}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
