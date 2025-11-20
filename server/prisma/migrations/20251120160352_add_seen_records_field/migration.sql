-- Add seen flag to records in all snapshot tables

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE (
        table_schema LIKE 'wkb\_%' ESCAPE '\'
        OR table_schema LIKE 'sna\_%' ESCAPE '\'
        OR table_schema LIKE 'uploads\_%'
      )
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS __seen BOOLEAN NOT NULL DEFAULT TRUE;',
      r.table_schema,
      r.table_name
    );
  END LOOP;
END $$;