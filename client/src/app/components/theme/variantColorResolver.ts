import { VariantColorsResolver, defaultVariantColorsResolver, parseThemeColor } from '@mantine/core';

/**
 * NOTE: this isn't used anywhere yet and was just ported from Whalesync. It demonstrates how to get finer 
 * control over the colors for different component variants.
 * 
 * Function that is used to determine which colors will be used in different
 * variants in the components.
 *
 * Link: https://mantine.dev/theming/colors/#colors-variant-resolver
 */
export const variantColorResolver: VariantColorsResolver = (input) => {
  const defaultResolvedColors = defaultVariantColorsResolver(input);
  const parsedColor = parseThemeColor({
    color: input.color || input.theme.primaryColor,
    theme: input.theme,
  });

  switch (input.variant) {
    case 'filled': {
      return {
        ...defaultResolvedColors,
        background: `var(--mantine-color-${parsedColor.color}-8)`,
        hover: `var(--mantine-color-${parsedColor.color}-9)`,
        border: `1px solid var(--mantine-color-${parsedColor.color}-9)`,
      };
    }

    case 'outline': {
      const defaultOutlineTheme = {
        ...defaultResolvedColors,
        background: `white`,
        hover: `var(--mantine-color-${parsedColor.color}-1)`,
        color: `var(--mantine-color-${parsedColor.color}-10)`,
        border: `1px solid var(--mantine-color-${parsedColor.color}-6)`,
      };

      if (parsedColor.color === 'gray') {
        return {
          ...defaultOutlineTheme,
          color: 'var(--mantine-color-gray-11)',
        };
      }

      return defaultOutlineTheme;
    }

    case 'light': {
      return {
        ...defaultResolvedColors,
        background: `var(--mantine-color-${parsedColor.color}-a-2)`,
        hover: `var(--mantine-color-${parsedColor.color}-a-3)`,
        color: `var(--mantine-color-${parsedColor.color}-10)`,
        border: `1px solid transparent`,
      };
    }

    case 'subtle': {
      return {
        ...defaultResolvedColors,
        background: 'transparent',
        hover: `var(--mantine-color-${parsedColor.color}-a-2)`,
        color: `var(--mantine-color-${parsedColor.color}-11)`,
        border: `1px solid transparent`,
      };
    }
  }

  return defaultResolvedColors;
};
