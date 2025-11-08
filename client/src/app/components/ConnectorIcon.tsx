import { getLogo } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Image } from '@mantine/core';
import { ImageProps } from 'next/image';

export function ConnectorIcon(
  props: { connector: string | null; size?: number } & Omit<ImageProps, 'src' | 'alt'> & { withBorder?: boolean },
) {
  const iconUrl = getLogo(props.connector as Service);

  return (
    <Image
      src={iconUrl}
      w={props.size ?? 40}
      h={props.size ?? 40}
      alt={props.connector || 'Connector icon'}
      bd={props.withBorder ? '1px solid var(--mantine-color-gray-4)' : 'none'}
      bg={props.withBorder ? 'var(--bg-base)' : 'transparent'}
      radius="xs"
      {...props}
    />
  );
}
