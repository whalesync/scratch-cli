import { Menu } from '@mantine/core';
import { ACCEPT_REJECT_GROUP_NAME, FILTERING_GROUP_NAME } from './contextMenu.ts/constants';
import { useSnapshotTableGridContext } from './SnapshotTableGridProvider';

export const HeaderMenu = () => {
  const { headerMenu, closeHeaderMenu, getHeaderMenuItems, handleHeaderMenuAction } = useSnapshotTableGridContext();

  if (!headerMenu) return null;

  return (
    <Menu
      opened={headerMenu.visible}
      onClose={closeHeaderMenu}
      position="bottom-start"
      offset={0}
      styles={{
        dropdown: {
          position: 'fixed',
          left: headerMenu.x,
          top: headerMenu.y,
          zIndex: 1000,
        },
      }}
    >
      <Menu.Target>
        <div
          style={{
            position: 'fixed',
            left: headerMenu.x,
            top: headerMenu.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      </Menu.Target>

      <Menu.Dropdown>
        {getHeaderMenuItems().map((item, index) => {
          // Check if this is a filtering item using the group property
          const isFilteringItem = item.group === FILTERING_GROUP_NAME;
          const isAcceptRejectItem = item.group === ACCEPT_REJECT_GROUP_NAME;

          // If this is the first filtering item, add the Filtering section header
          if (isFilteringItem && index === getHeaderMenuItems().findIndex((i) => i.group === FILTERING_GROUP_NAME)) {
            return (
              <div key={`filtering-section-${index}`}>
                <Menu.Divider />
                <Menu.Label>{FILTERING_GROUP_NAME}</Menu.Label>
                <Menu.Item
                  key={index}
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
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
                onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
              >
                {item.label}
              </Menu.Item>
            );
          }

          // If this is the first accept/reject item, add the Accept/Reject Changes section header
          if (
            isAcceptRejectItem &&
            index === getHeaderMenuItems().findIndex((i) => i.group === ACCEPT_REJECT_GROUP_NAME)
          ) {
            return (
              <div key={`accept-reject-section-${index}`}>
                <Menu.Divider />
                <Menu.Label>{ACCEPT_REJECT_GROUP_NAME}</Menu.Label>
                <Menu.Item
                  key={index}
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
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
                onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
              >
                {item.label}
              </Menu.Item>
            );
          }

          // For non-grouped items, add a divider before the first non-grouped item
          if (!isFilteringItem && !isAcceptRejectItem && index === getHeaderMenuItems().findIndex((i) => !i.group)) {
            return (
              <div key={`other-section-${index}`}>
                <Menu.Divider />
                <Menu.Item
                  key={index}
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
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
              onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
            >
              {item.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
};
