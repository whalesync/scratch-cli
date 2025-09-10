import { getLogo } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Image } from '@mantine/core';
import { ImageProps } from 'next/image';

export function ConnectorIcon(props: { connector: string | null } & Omit<ImageProps, 'src' | 'alt'>) {
  const iconUrl = props.connector ? getLogo(props.connector as Service) : '';

  return <Image src={iconUrl} w={40} h={40} alt={props.connector || 'Connector icon'} {...props} />;
}
