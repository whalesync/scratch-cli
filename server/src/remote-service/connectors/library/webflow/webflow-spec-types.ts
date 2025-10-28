/* eslint-disable @typescript-eslint/no-empty-object-type */

// Predefined metadata column IDs
export const WEBFLOW_IS_DRAFT_COLUMN_ID = 'isDraft';
export const WEBFLOW_IS_ARCHIVED_COLUMN_ID = 'isArchived';
export const WEBFLOW_LAST_PUBLISHED_COLUMN_ID = 'lastPublished';
export const WEBFLOW_LAST_UPDATED_COLUMN_ID = 'lastUpdated';
export const WEBFLOW_CREATED_ON_COLUMN_ID = 'createdOn';

export const WEBFLOW_METADATA_COLUMNS = [
  WEBFLOW_IS_DRAFT_COLUMN_ID,
  WEBFLOW_IS_ARCHIVED_COLUMN_ID,
  WEBFLOW_LAST_PUBLISHED_COLUMN_ID,
  WEBFLOW_LAST_UPDATED_COLUMN_ID,
  WEBFLOW_CREATED_ON_COLUMN_ID,
];

export type WebflowTableSpecExtras = {};

export type WebflowColumnSpecExtras = {
  // Webflow field type (e.g., 'PlainText', 'RichText', 'Number', etc.)
  webflowFieldType?: string;
  slug?: string;
};
