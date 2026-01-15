// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type AirtableTableSpecExtras = {
  // Add properties here and they are saved in the DB and passed back to the connector.
};

export type AirtableColumnSpecExtras = {
  // The Airtable field type (e.g., 'singleLineText', 'richText', 'number', etc.)
  airtableFieldType?: string;
};
