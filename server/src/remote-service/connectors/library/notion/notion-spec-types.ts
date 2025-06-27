/* eslint-disable @typescript-eslint/no-empty-object-type */

import { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export type NotionTableSpecExtras = {
  // Add properties here and they are saved in the DB and passed back to the connector.
};

export type NotionColumnSpecExtras = {
  notionDataType: DatabaseObjectResponse['properties'][string]['type'];
};
