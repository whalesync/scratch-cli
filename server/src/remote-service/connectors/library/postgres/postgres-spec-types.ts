/**
 * Spec types for the PostgreSQL connector.
 *
 * Since PostgreSQL is a JSON-only connector (uses fetchJsonTableSpec and pullRecordFiles),
 * these types are minimal and use the base types.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type PostgresTableSpecExtras = {
  // Add properties here if needed in the future
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type PostgresColumnSpecExtras = {
  // Add properties here if needed in the future
};
