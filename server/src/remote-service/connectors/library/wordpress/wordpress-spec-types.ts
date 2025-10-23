/* eslint-disable @typescript-eslint/no-empty-object-type */

export type WordPressTableSpecExtras = {
  // Add properties here and they are saved in the DB and passed back to the connector.
};

export type WordPressColumnSpecExtras = {
  // The WordPress data type (used for conversion)
  wordpressDataType?: string;
};
