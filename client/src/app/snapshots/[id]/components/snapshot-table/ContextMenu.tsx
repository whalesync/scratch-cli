import { Menu } from '@mantine/core';
import { ACCEPT_REJECT_GROUP_NAME, FILTERING_GROUP_NAME, FOCUS_GROUP_NAME } from './contextMenu.ts/constants';
import { useSnapshotTableGridContext } from './SnapshotTableGridProvider';

export const ContextMenu = () => {
  const { contextMenu, closeContextMenu, getContextMenuItems, handleContextMenuAction } = useSnapshotTableGridContext();

  if (!contextMenu) return null;

  return (
    <Menu
      opened={contextMenu.visible}
      onClose={closeContextMenu}
      position="bottom-start"
      offset={0}
      styles={{
        dropdown: {
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 1000,
        },
      }}
    >
      <Menu.Target>
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      </Menu.Target>

      <Menu.Dropdown>
        {getContextMenuItems().map((item, index) => {
          // Check if this is a focus item using the group property
          const isFocusItem = item.group === FOCUS_GROUP_NAME;
          const isFilteringItem = item.group === FILTERING_GROUP_NAME;
          const isAcceptRejectItem = item.group === ACCEPT_REJECT_GROUP_NAME;

          // If this is the first focus item, add the Focus section header
          if (isFocusItem && index === getContextMenuItems().findIndex((i) => i.group === FOCUS_GROUP_NAME)) {
            return (
              <div key={`focus-section-${index}`}>
                <Menu.Divider />
                <Menu.Label>{FOCUS_GROUP_NAME}</Menu.Label>
                <Menu.Item
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
                >
                  {item.label}
                </Menu.Item>
              </div>
            );
          }

          // If this is a focus item but not the first one, render normally
          if (isFocusItem) {
            return (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                leftSection={item.leftSection}
                onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
              >
                {item.label}
              </Menu.Item>
            );
          }

          // If this is the first filtering item, add the Filtering section header
          if (isFilteringItem && index === getContextMenuItems().findIndex((i) => i.group === FILTERING_GROUP_NAME)) {
            return (
              <div key={`filtering-section-${index}`}>
                <Menu.Divider />
                <Menu.Label>{FILTERING_GROUP_NAME}</Menu.Label>
                <Menu.Item
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
                >
                  {item.label}
                </Menu.Item>
              </div>
            );
          }

          // If this is a filtering item but not the first one, render normally
          if (isFilteringItem) {
            return (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                leftSection={item.leftSection}
                onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
              >
                {item.label}
              </Menu.Item>
            );
          }

          // If this is the first accept/reject item, add the Accept/Reject Changes section header
          if (
            isAcceptRejectItem &&
            index === getContextMenuItems().findIndex((i) => i.group === ACCEPT_REJECT_GROUP_NAME)
          ) {
            return (
              <div key={`accept-reject-section-${index}`}>
                <Menu.Divider />
                <Menu.Label>{ACCEPT_REJECT_GROUP_NAME}</Menu.Label>
                <Menu.Item
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
                >
                  {item.label}
                </Menu.Item>
              </div>
            );
          }

          // If this is an accept/reject item but not the first one, render normally
          if (isAcceptRejectItem) {
            return (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                leftSection={item.leftSection}
                onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
              >
                {item.label}
              </Menu.Item>
            );
          }

          // For non-grouped items, add a divider before the first non-grouped item
          if (
            !isFocusItem &&
            !isFilteringItem &&
            !isAcceptRejectItem &&
            index === getContextMenuItems().findIndex((i) => !i.group)
          ) {
            return (
              <div key={`other-section-${index}`}>
                <Menu.Divider />
                <Menu.Item
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
                >
                  {item.label}
                </Menu.Item>
              </div>
            );
          }

          // Regular items
          return (
            <Menu.Item
              key={index}
              disabled={item.disabled}
              leftSection={item.leftSection}
              onClick={() => (item.handler ? item.handler() : handleContextMenuAction(item.label))}
            >
              {item.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
};
