import { getLogo } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Image, MantineSpacing, StyleProp } from '@mantine/core';
import { ImageProps } from 'next/image';

export function ModelProviderIcon(
  props: { provider: string | null; size?: number; p?: StyleProp<MantineSpacing> } & Omit<ImageProps, 'src' | 'alt'> & {
      withBorder?: boolean;
    },
) {
  const { provider, size, withBorder, p, ...rest } = props;
  const iconUrl = getModalProviderLogo(provider);

  return (
    <Image
      src={iconUrl}
      w={size ?? 40}
      h={size ?? 40}
      alt={provider || 'AI Model providericon'}
      bd={withBorder ? '0.5px solid var(--mantine-color-gray-4)' : 'none'}
      bg={withBorder ? 'var(--bg-base)' : 'transparent'}
      p={p ?? '3.5px'}
      {...rest}
    />
  );
}

export function getModalProviderLogo(modelProvider: string | null): string {
  return getLogo(modelProvider as Service);
}
