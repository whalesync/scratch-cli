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

  if(input.variant === 'transparent-hover') {
    return {
      ...defaultResolvedColors,
      color: parsedColor.color,
    }
  }

  return defaultResolvedColors;
};
