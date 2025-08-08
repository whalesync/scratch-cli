import { CSSProperties, getThemeColor, MantineSize, useMantineTheme } from '@mantine/core';
import { Icon, IconWeight } from '@phosphor-icons/react';
import { JSX } from 'react';
import { resolveIconSize, resolveSpacing } from './sizes';

/**
 * Phosphor icons don't known how to take mantine styling props, like size="sm" or color="blue.3".
 * This wraps the icon with a Box component to resolve the mantine-specific things.
 */
export const StyledIcon = ({
  Icon,
  weight,
  c,
  size,
  centerInText,
  mirrored,
  ml,
  mr,
  className,
}: {
  Icon: Icon;
  weight?: IconWeight;
  c?: string;
  size?: MantineSize | number;
  /** Set this if it is embedded in a run of text, to set the vertical alignment to be centered */
  centerInText?: true;
  mirrored?: boolean;
  ml?: MantineSize | number;
  mr?: MantineSize | number;
  className?: string;
}): JSX.Element => {
  const theme = useMantineTheme();
  const resolvedColor = c ? getThemeColor(c, theme) : undefined;
  const resolvedSize = size ? resolveIconSize(size) : undefined;

  // Extra manual style properties for common scenarios.
  const style: CSSProperties = {};
  if (centerInText) {
    style.display = 'inline-block';
    style.verticalAlign = 'baseline';
    style.transform = 'translateY(13%)';
  }
  if (ml) {
    style.marginLeft = resolveSpacing(ml, theme);
  }
  if (mr) {
    style.marginRight = resolveSpacing(mr, theme);
  }
  if (resolvedSize) {
    style.minWidth = resolvedSize;
    style.minHeight = resolvedSize;
  }

  return (
    <Icon
      weight={weight}
      mirrored={mirrored}
      color={resolvedColor}
      size={resolvedSize}
      style={style}
      className={className}
    />
  );
};
