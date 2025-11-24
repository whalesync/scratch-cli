/* eslint-disable @typescript-eslint/no-empty-object-type */

import { NotionProperty } from './property-types';

export type NotionTableSpecExtras = {
  // Add properties here and they are saved in the DB and passed back to the connector.
};

export type NotionColumnSpecExtras = {
  notionDataType: NotionProperty['type'];
};
