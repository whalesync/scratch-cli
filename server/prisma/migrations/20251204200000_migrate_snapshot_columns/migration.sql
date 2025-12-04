DO $$
DECLARE
    schema_record RECORD;
    table_record RECORD;
    schema_name_text TEXT;
    table_name_text TEXT;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'wkb_%'
    LOOP
        schema_name_text := schema_record.schema_name;
        
        FOR table_record IN 
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = schema_name_text
            AND table_type = 'BASE TABLE'
        LOOP
            table_name_text := table_record.table_name;
            
            -- Rename id to __remoteId
            EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN "id" TO "__remoteId"', schema_name_text, table_name_text);
            
            -- Rename wsId to __wsId
            EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN "wsId" TO "__wsId"', schema_name_text, table_name_text);
            
        END LOOP;
    END LOOP;
END $$;
