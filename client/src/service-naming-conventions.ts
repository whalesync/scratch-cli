import {Service} from '@/types/server-entities/connector-accounts';
type ServiceNamingConvention = {
  service: string;
  table: string;
  record: string;
  base: string | null
  tables: string;
  records: string;
  bases: string | null
  logo?: string
  oauthLabel?: string
  oauthPrivateLabel?: string
};


export const ServiceNamingConventions: Record<Service, ServiceNamingConvention> = {
  [Service.NOTION]: {
    service: "Notion",
    table: "database",
    record: "page",
    base: null,
    tables: "databases",
    records: "pages",
    bases: null,
    logo: "notion.svg",
    oauthLabel: "OAuth",
  },
  [Service.AIRTABLE]: {
    service: "Airtable",
    table: "table",
    record: "record",
    base: "base",
    tables: "tables",
    records: "records",
    bases: "bases",
    logo: "airtable.svg",
  },
  [Service.YOUTUBE]: {
    service: "YouTube",
    table: "channel",
    record: "video",
    base: null,
    tables: "channels",
    records: "videos",
    bases: null,
    logo: "youtube-color-svgrepo-com.svg",
    oauthLabel: "OAuth (100 api credits/day)",
    oauthPrivateLabel: "Private OAuth (10,000 api credits/day)",
  },
  [Service.CUSTOM]: {
    service: "Custom",
    table: "table",
    record: "record",
    base: null,
    tables: "tables",
    records: "records",
    bases: null,
    logo: "gear-svgrepo-com.svg",
  },
  [Service.CSV]: {
    service: "CSV",
    table: "file",
    record: "row",
    base: null,
    tables: "files",
    records: "rows",
    bases: null,
    logo: "csv-svgrepo-com.svg",
  },
};

export const serviceName = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.service ?? (serviceCode.charAt(0).toUpperCase() + serviceCode.slice(1));
}

export const tableName  = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.table ?? 'table';
}

export const recordName = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.record ?? 'record';
}

export const baseName = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.base ?? 'base';
}

export const tablesName = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.tables ?? 'tables';
}

export const recordsName = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.records ?? 'records';
}

    export const basesName = (serviceCode: Service): string => {
        return ServiceNamingConventions[serviceCode]?.bases ?? 'bases';
    }

export const getLogo = (serviceCode: Service | null | undefined): string => {
    if(!serviceCode) {
      return '/connector-icons/csv.svg';
    }
    const logo = ServiceNamingConventions[serviceCode ?? Service.CUSTOM]?.logo;
    if (logo) {
        return `/connector-icons/${logo}`;
    }
    return '/connector-icons/csv.svg';
}

export const getOauthLabel = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.oauthLabel ?? 'OAuth';
}

export const getOauthPrivateLabel = (serviceCode: Service): string => {
    return ServiceNamingConventions[serviceCode]?.oauthPrivateLabel ?? 'Private OAuth';
}

export const getServiceName = (serviceCode: Service | null | undefined): string => {
    if (!serviceCode) {
        return 'CSV';
    }
    return ServiceNamingConventions[serviceCode]?.service ?? 'Unknown';
}
