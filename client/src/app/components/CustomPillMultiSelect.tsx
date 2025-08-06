import { CheckIcon, CloseButton, Combobox, Divider, Group, Input, Pill, PillsInput, useCombobox } from '@mantine/core';
import classes from './CustomPillMultiSelect.module.css';

export interface CustomPillMultiSelectData {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode | null;
}

export interface CustomPillMultiSelectProps {
  values: string[];
  onSelect?: (value: string) => void;
  onRemove?: (value: string) => void;
  data: CustomPillMultiSelectData[];
  placeholder?: string;
  onPillClick?: (value: string) => void;
  hidePickedOptions?: boolean;
}

export function CustomPillMultiSelect({
  values,
  onSelect,
  onRemove,
  data,
  placeholder,
  onPillClick,
  hidePickedOptions,
}: CustomPillMultiSelectProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  });

  const displayItems = values.map((item) => {
    const itemData = data.find((d) => d.value === item);
    if (!itemData) {
      return null;
    }
    return (
      <DisplayPill
        key={item}
        value={item}
        data={itemData}
        onRemove={() => onRemove?.(item)}
        onClick={() => onPillClick?.(item)}
      >
        {item}
      </DisplayPill>
    );
  });

  const options = data.map((item) => {
    if (hidePickedOptions && values.includes(item.value)) {
      return null;
    }

    if (item.value === 'divider') {
      return <Divider key={item.value} />;
    }
    return (
      <Combobox.Option value={item.value} key={item.value} active={values.includes(item.value)}>
        <Group gap="sm">
          {values.includes(item.value) ? <CheckIcon size={12} /> : null}
          <Group gap={7}>
            {item.icon}
            <span>{item.label}</span>
          </Group>
        </Group>
      </Combobox.Option>
    );
  });

  return (
    <Combobox store={combobox} onOptionSubmit={onSelect} withinPortal={false}>
      <Combobox.DropdownTarget>
        <PillsInput
          pointer
          onClick={() => combobox.toggleDropdown()}
          styles={{
            input: {
              border: 'none',
              backgroundColor: 'transparent',
              paddingLeft: '0px',
            },
          }}
        >
          <Pill.Group>
            {displayItems.length > 0 ? (
              displayItems
            ) : (
              <Input.Placeholder>{placeholder || 'Pick one or more values'}</Input.Placeholder>
            )}

            <Combobox.EventsTarget>
              <PillsInput.Field
                type="hidden"
                onBlur={() => combobox.closeDropdown()}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && values.length > 0) {
                    event.preventDefault();
                    onRemove?.(values[values.length - 1]);
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown bd="none">
        <Combobox.Options>{options}</Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

interface DisplayPillProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string;
  data: CustomPillMultiSelectData;
  onRemove?: () => void;
  onClick?: () => void;
}

export function DisplayPill({ data, onRemove, onClick, ...others }: DisplayPillProps) {
  return (
    <div
      className={classes.pill}
      onClick={(event) => {
        if (onClick) {
          event.stopPropagation();
          onClick();
        }
      }}
      {...others}
    >
      {data.icon && <div className={classes.icon}>{data.icon}</div>}
      <div className={classes.label}>{data.label}</div>
      <CloseButton onMouseDown={onRemove} variant="transparent" color="gray" size={22} iconSize={14} tabIndex={-1} />
    </div>
  );
}
