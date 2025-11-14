import { BaseColumnSpec, BaseTableSpec } from '../types';
import { AirtableColumnSpecExtras, AirtableTableSpecExtras } from './airtable/airtable-spec-types';
import { CsvColumnSpecExtras, CsvTableSpecExtras } from './csv/csv-spec-types';
import { NotionColumnSpecExtras, NotionTableSpecExtras } from './notion/notion-spec-types';
import { WebflowColumnSpecExtras, WebflowTableSpecExtras } from './webflow/webflow-spec-types';
import { WixBlogColumnSpecExtras, WixBlogTableSpecExtras } from './wix/wix-blog/wix-blog-spec-types';
import { WordPressColumnSpecExtras, WordPressTableSpecExtras } from './wordpress/wordpress-spec-types';
import { YouTubeColumnSpecExtras, YouTubeTableSpecExtras } from './youtube/youtube-spec-types';

// This holds all of the extra properties a connector can attach to DB entities. They'll get plumbed along with the standard fields..

export type AirtableTableSpec = BaseTableSpec<AirtableColumnSpec> & AirtableTableSpecExtras;
export type AirtableColumnSpec = BaseColumnSpec & AirtableColumnSpecExtras;

export type NotionTableSpec = BaseTableSpec<NotionColumnSpec> & NotionTableSpecExtras;
export type NotionColumnSpec = BaseColumnSpec & NotionColumnSpecExtras;

export type CsvColumnSpec = BaseColumnSpec & CsvColumnSpecExtras;
export type CsvTableSpec = BaseTableSpec<CsvColumnSpec> & CsvTableSpecExtras;

export type YouTubeColumnSpec = BaseColumnSpec & YouTubeColumnSpecExtras;
export type YouTubeTableSpec = BaseTableSpec<YouTubeColumnSpec> & YouTubeTableSpecExtras;

export type WordPressColumnSpec = BaseColumnSpec & WordPressColumnSpecExtras;
export type WordPressTableSpec = BaseTableSpec<WordPressColumnSpec> & WordPressTableSpecExtras;

export type WebflowColumnSpec = BaseColumnSpec & WebflowColumnSpecExtras;
export type WebflowTableSpec = BaseTableSpec<WebflowColumnSpec> & WebflowTableSpecExtras;

export type WixBlogColumnSpec = BaseColumnSpec & WixBlogColumnSpecExtras;
export type WixBlogTableSpec = BaseTableSpec<WixBlogColumnSpec> & WixBlogTableSpecExtras;

export type AnyTableSpec = TableSpecs[keyof TableSpecs] & { columns: AnyColumnSpec[] };
export interface TableSpecs {
  AIRTABLE: AirtableTableSpec;
  NOTION: NotionTableSpec;
  CUSTOM: CsvTableSpec; // @deprecated - custom connector is being phased out
  CSV: CsvTableSpec;
  YOUTUBE: YouTubeTableSpec;
  WORDPRESS: WordPressTableSpec;
  WEBFLOW: WebflowTableSpec;
  WIX_BLOG: WixBlogTableSpec;
  POSTGRES: CsvTableSpec; // TODO - change to PostgresTableSpec once we implement the connector
}

export type AnyColumnSpec = ColumnSpecs[keyof ColumnSpecs];
export interface ColumnSpecs {
  AIRTABLE: AirtableColumnSpec;
  NOTION: NotionColumnSpec;
  CUSTOM: CsvColumnSpec; // @deprecated - custom connector is being phased out
  CSV: CsvColumnSpec;
  YOUTUBE: YouTubeColumnSpec;
  WORDPRESS: WordPressColumnSpec;
  WEBFLOW: WebflowColumnSpec;
  WIX_BLOG: WixBlogColumnSpec;
  POSTGRES: CsvColumnSpec; // TODO - change to PostgresColumnSpec once we implement the connector
}
