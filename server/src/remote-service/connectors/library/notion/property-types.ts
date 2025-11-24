import { DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client';

/**
 * These are properties not supported in @notionhq/client:3.1.3
 * Drop file this when we upgrade to 4.x.x or 5.x.x
 */

export type NewNotionProperties = ({ type: 'place' } | { type: 'unique_id' } | { type: 'button' }) &
  NotionPropertyFields;
export type NotionPropertyFields = {
  id: string;
  name: string;
};
export type SupportedNotionProperties = DatabaseObjectResponse['properties'][string];
export type NotionProperty = SupportedNotionProperties | NewNotionProperties;

export type SupportedPageResponseTypes = PageObjectResponse['properties'][string];
export type NewPageResponseTypes =
  | {
      type: 'place';
      place: {
        lat: number;
        lon: number;
        name: string;
        address: string;
        aws_place_id: string | null;
        google_place_id: string | null;
      } | null;
    }
  | { type: 'unique_id'; unique_id: { prefix: string | null; number: number } }
  | { type: 'button' };

export type PageObjectResponsePropertyTypes = SupportedPageResponseTypes | NewPageResponseTypes;
