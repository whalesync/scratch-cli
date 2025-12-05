import { Image, MantineSpacing, StyleProp } from '@mantine/core';
import { ImageProps } from 'next/image';

function getModelIconPath(modelName: string | null | undefined): string {
  if (!modelName) {
    return '/model-icons/open-router.svg';
  }

  // Extract the prefix (part before the first "/")
  const prefix = modelName.split('/')[0]?.toLowerCase() || '';

  // Map prefixes to icon files
  const iconMap: Record<string, string> = {
    openai: 'open-ai.svg',
    google: 'gemini.svg',
    meta: 'meta.svg',
    ai21: 'ai21.svg',
    aion: 'aion.svg',
    'aion-labs': 'aion.svg',
    scratch: 'scratch.svg', // used in some special cases for system generated keys / creds
  };

  const iconFile = iconMap[prefix];
  if (iconFile) {
    return `/model-icons/${iconFile}`;
  }

  // Default to open-router.svg if no match
  return '/model-icons/open-router.svg';
}

export function ModelProviderIcon(
  props: { model: string | null; size?: number; p?: StyleProp<MantineSpacing> } & Omit<ImageProps, 'src' | 'alt'> & {
      withBorder?: boolean;
    },
) {
  const { model, size, withBorder, p, ...rest } = props;
  const iconUrl = getModelIconPath(model);

  return (
    <Image
      src={iconUrl}
      w={size ?? 40}
      h={size ?? 40}
      alt={model || 'Model icon'}
      bd={withBorder ? '0.5px solid var(--mantine-color-gray-4)' : 'none'}
      bg={withBorder ? 'var(--bg-base)' : 'transparent'}
      p={p ?? '3.5px'}
      {...rest}
    />
  );
}
