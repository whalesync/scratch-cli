import { Service } from '@/types/server-entities/connector-accounts';
import { capitalize } from 'lodash';
type ServiceNamingConvention = {
  service: string;
  table: string;
  record: string;
  base: string | null;
  tables: string;
  records: string;
  bases: string | null;
  logo?: string;
  oauthLabel?: string;
  oauthPrivateLabel?: string;
  pushOperationName: string;
  pullOperationName: string;
};

export const ServiceNamingConventions: Record<Service, ServiceNamingConvention> = {
  [Service.WEBFLOW]: {
    service: 'Webflow',
    table: 'collection',
    record: 'item',
    base: null,
    tables: 'collections',
    records: 'items',
    bases: null,
    logo: 'webflow.svg',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.WIX_BLOG]: {
    service: 'Wix Blog',
    table: 'site',
    record: 'post',
    base: null,
    tables: 'sites',
    records: 'posts',
    bases: null,
    logo: 'wix.svg',
    oauthLabel: 'OAuth',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.WORDPRESS]: {
    service: 'WordPress',
    table: 'post',
    record: 'post',
    base: null,
    tables: 'posts',
    records: 'posts',
    bases: null,
    logo: 'wordpress.svg',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.NOTION]: {
    service: 'Notion',
    table: 'database',
    record: 'page',
    base: null,
    tables: 'databases',
    records: 'pages',
    bases: null,
    logo: 'notion.svg',
    oauthLabel: 'OAuth',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.AIRTABLE]: {
    service: 'Airtable',
    table: 'table',
    record: 'record',
    base: 'base',
    tables: 'tables',
    records: 'records',
    bases: 'bases',
    logo: 'airtable.svg',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.YOUTUBE]: {
    service: 'YouTube',
    table: 'channel',
    record: 'video',
    base: null,
    tables: 'channels',
    records: 'videos',
    bases: null,
    logo: 'youtube-color-svgrepo-com.svg',
    oauthLabel: 'OAuth (100 api credits/day)',
    oauthPrivateLabel: 'Private OAuth (10,000 api credits/day)',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.CUSTOM]: {
    service: 'Custom',
    table: 'table',
    record: 'record',
    base: null,
    tables: 'tables',
    records: 'records',
    bases: null,
    logo: 'gear-svgrepo-com.svg',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
  [Service.CSV]: {
    service: 'CSV',
    table: 'file',
    record: 'row',
    base: null,
    tables: 'files',
    records: 'rows',
    bases: null,
    logo: 'csv.svg',
    pushOperationName: 'Publish',
    pullOperationName: 'Download',
  },
};

export const serviceName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.service ?? capitalize(serviceCode);
};

export const tableName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.table ?? 'table';
};

export const recordName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.record ?? 'record';
};

export const baseName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.base ?? 'base';
};

export const tablesName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.tables ?? 'tables';
};

export const recordsName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.records ?? 'records';
};

export const basesName = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.bases ?? 'bases';
};

export const getLogo = (serviceCode: Service | null | undefined): string => {
  if (!serviceCode) {
    return '/connector-icons/csv.svg';
  }
  const logo = ServiceNamingConventions[serviceCode ?? Service.CUSTOM]?.logo;
  if (logo) {
    return `/connector-icons/${logo}`;
  }
  return '/connector-icons/csv.svg';
};

export const getOauthLabel = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.oauthLabel ?? 'OAuth';
};

export const getOauthPrivateLabel = (serviceCode: Service): string => {
  return ServiceNamingConventions[serviceCode]?.oauthPrivateLabel ?? 'Private OAuth';
};

export const getServiceName = (serviceCode: Service | null | undefined): string => {
  if (!serviceCode) {
    return 'CSV';
  }
  return ServiceNamingConventions[serviceCode]?.service ?? 'Unknown';
};

export const getPullOperationName = (serviceCode: Service | null | undefined): string => {
  if (!serviceCode) {
    return 'Reload';
  }
  return ServiceNamingConventions[serviceCode]?.pullOperationName ?? 'Download';
};

export const getPushOperationName = (serviceCode: Service | null | undefined): string => {
  if (!serviceCode) {
    return 'Save';
  }
  return ServiceNamingConventions[serviceCode]?.pushOperationName ?? 'Publish';
};
