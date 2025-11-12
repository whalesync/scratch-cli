import { getLogo } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Image } from '@mantine/core';
import { ImageProps } from 'next/image';

export function ConnectorIcon(
  props: { connector: string | null; size?: number } & Omit<ImageProps, 'src' | 'alt'> & { withBorder?: boolean },
) {
  const { connector, size, withBorder, ...rest } = props;
  const iconUrl = getLogo(connector as Service);

  return (
    <Image
      src={iconUrl}
      w={size ?? 40}
      h={size ?? 40}
      alt={connector || 'Connector icon'}
      bd={withBorder ? '1px solid var(--mantine-color-gray-4)' : 'none'}
      bg={withBorder ? '#F8F8F9' : 'transparent'}
      radius="xs"
      {...rest}
    />
  );
}
