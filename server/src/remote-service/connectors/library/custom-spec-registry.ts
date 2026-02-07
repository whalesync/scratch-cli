import { BaseColumnSpec, BaseJsonTableSpec, BaseTableSpec } from '../types';
import { AirtableColumnSpecExtras, AirtableTableSpecExtras } from './airtable/airtable-spec-types';
import { AudiencefulColumnSpecExtras, AudiencefulTableSpecExtras } from './audienceful/audienceful-spec-types';
import { MocoColumnSpecExtras, MocoTableSpecExtras } from './moco/moco-spec-types';
import { NotionColumnSpecExtras, NotionTableSpecExtras } from './notion/notion-spec-types';
import { PostgresColumnSpecExtras, PostgresTableSpecExtras } from './postgres/postgres-spec-types';
import { WebflowColumnSpecExtras, WebflowTableSpecExtras } from './webflow/webflow-spec-types';
import { WixBlogColumnSpecExtras, WixBlogTableSpecExtras } from './wix/wix-blog/wix-blog-spec-types';
import { WordPressColumnSpecExtras, WordPressTableSpecExtras } from './wordpress/wordpress-spec-types';
import { YouTubeColumnSpecExtras, YouTubeTableSpecExtras } from './youtube/youtube-spec-types';

// This holds all of the extra properties a connector can attach to DB entities. They'll get plumbed along with the standard fields..

export type AirtableTableSpec = BaseTableSpec<AirtableColumnSpec> & AirtableTableSpecExtras;
export type AirtableColumnSpec = BaseColumnSpec & AirtableColumnSpecExtras;

export type NotionTableSpec = BaseTableSpec<NotionColumnSpec> & NotionTableSpecExtras;
export type NotionColumnSpec = BaseColumnSpec & NotionColumnSpecExtras;

export type YouTubeColumnSpec = BaseColumnSpec & YouTubeColumnSpecExtras;
export type YouTubeTableSpec = BaseTableSpec<YouTubeColumnSpec> & YouTubeTableSpecExtras;

export type WordPressColumnSpec = BaseColumnSpec & WordPressColumnSpecExtras;
export type WordPressTableSpec = BaseTableSpec<WordPressColumnSpec> & WordPressTableSpecExtras;

export type WebflowColumnSpec = BaseColumnSpec & WebflowColumnSpecExtras;
export type WebflowTableSpec = BaseTableSpec<WebflowColumnSpec> & WebflowTableSpecExtras;

export type WixBlogColumnSpec = BaseColumnSpec & WixBlogColumnSpecExtras;
export type WixBlogTableSpec = BaseTableSpec<WixBlogColumnSpec> & WixBlogTableSpecExtras;

export type AudiencefulColumnSpec = BaseColumnSpec & AudiencefulColumnSpecExtras;
export type AudiencefulTableSpec = BaseTableSpec<AudiencefulColumnSpec> & AudiencefulTableSpecExtras;

export type MocoColumnSpec = BaseColumnSpec & MocoColumnSpecExtras;
export type MocoTableSpec = BaseTableSpec<MocoColumnSpec> & MocoTableSpecExtras;

export type PostgresColumnSpec = BaseColumnSpec & PostgresColumnSpecExtras;
export type PostgresTableSpec = BaseTableSpec<PostgresColumnSpec> & PostgresTableSpecExtras;

export type AnyTableSpec = TableSpecs[keyof TableSpecs] & { columns: AnyColumnSpec[] };
export interface TableSpecs {
  AIRTABLE: AirtableTableSpec;
  NOTION: NotionTableSpec;
  CUSTOM: BaseTableSpec<BaseColumnSpec>; // @deprecated - custom connector is being phased out
  CSV: BaseTableSpec<BaseColumnSpec>;
  YOUTUBE: YouTubeTableSpec;
  WORDPRESS: WordPressTableSpec;
  WEBFLOW: WebflowTableSpec;
  WIX_BLOG: WixBlogTableSpec;
  POSTGRES: PostgresTableSpec;
  AUDIENCEFUL: AudiencefulTableSpec;
  MOCO: MocoTableSpec;
}

export type AnyColumnSpec = ColumnSpecs[keyof ColumnSpecs];
export interface ColumnSpecs {
  AIRTABLE: AirtableColumnSpec;
  NOTION: NotionColumnSpec;
  CUSTOM: BaseColumnSpec; // @deprecated - custom connector is being phased out
  CSV: BaseColumnSpec;
  YOUTUBE: YouTubeColumnSpec;
  WORDPRESS: WordPressColumnSpec;
  WEBFLOW: WebflowColumnSpec;
  WIX_BLOG: WixBlogColumnSpec;
  POSTGRES: PostgresColumnSpec;
  AUDIENCEFUL: AudiencefulColumnSpec;
  MOCO: MocoColumnSpec;
}

// JSON Table Spec types for the new JSON schema method
export type AnyJsonTableSpec = BaseJsonTableSpec;

// Union type for code that handles both old (columns) and new (JSON schema) methods
export type AnySpec = AnyTableSpec | AnyJsonTableSpec;

// Type guards to distinguish between spec types
export function isJsonTableSpec(spec: AnySpec): spec is AnyJsonTableSpec {
  return 'schema' in spec && !('columns' in spec);
}

export function isColumnTableSpec(spec: AnySpec): spec is AnyTableSpec {
  return 'columns' in spec;
}
