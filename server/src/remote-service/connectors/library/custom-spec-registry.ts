import { BaseColumnSpec, BaseTableSpec } from '../types';
import { AirtableColumnSpecExtras, AirtableTableSpecExtras } from './airtable/airtable-spec-types';
import { CsvColumnSpecExtras, CsvTableSpecExtras } from './csv/csv-spec-types';
import { CustomColumnSpecExtras, CustomTableSpecExtras } from './custom/custom-spec-types';
import { NotionColumnSpecExtras, NotionTableSpecExtras } from './notion/notion-spec-types';

// This holds all of the extra properties a connector can attach to DB entities. They'll get plumbed along with the standard fields..

export type AirtableTableSpec = BaseTableSpec<AirtableColumnSpec> & AirtableTableSpecExtras;
export type AirtableColumnSpec = BaseColumnSpec & AirtableColumnSpecExtras;

export type NotionTableSpec = BaseTableSpec<NotionColumnSpec> & NotionTableSpecExtras;
export type NotionColumnSpec = BaseColumnSpec & NotionColumnSpecExtras;

export type CustomoColumnSpec = BaseColumnSpec & CustomColumnSpecExtras;
export type CustomTableSpec = BaseTableSpec<CustomoColumnSpec> & CustomTableSpecExtras;

export type CsvColumnSpec = BaseColumnSpec & CsvColumnSpecExtras;
export type CsvTableSpec = BaseTableSpec<CsvColumnSpec> & CsvTableSpecExtras;

export type AnyTableSpec = TableSpecs[keyof TableSpecs] & { columns: AnyColumnSpec[] };
export interface TableSpecs {
  AIRTABLE: AirtableTableSpec;
  NOTION: NotionTableSpec;
  CUSTOM: CustomTableSpec;
  CSV: CsvTableSpec;
}

export type AnyColumnSpec = ColumnSpecs[keyof ColumnSpecs];
export interface ColumnSpecs {
  AIRTABLE: AirtableColumnSpec;
  NOTION: NotionColumnSpec;
  CSV: CsvColumnSpec;
}
