-- Migration for sna_* schemas (old style workbook schemas)
-- Combines the column renames: id -> __remoteId, wsId -> __scratchId
-- Only migrates tables that haven't been migrated yet (checks for __remoteId existence)

DO $$
DECLARE
    schema_record RECORD;
    table_record RECORD;
    schema_name_text TEXT;
    table_name_text TEXT;
    column_exists BOOLEAN;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'sna_%'
    LOOP
        schema_name_text := schema_record.schema_name;
        
        FOR table_record IN 
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = schema_name_text
            AND table_type = 'BASE TABLE'
        LOOP
            table_name_text := table_record.table_name;
            
            -- Check if __remoteId column already exists (table already migrated)
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = schema_name_text 
                AND table_name = table_name_text 
                AND column_name = '__remoteId'
            ) INTO column_exists;
            
            -- Only migrate if __remoteId doesn't exist (table not yet migrated)
            IF NOT column_exists THEN
                -- Rename id to __remoteId
                EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN "id" TO "__remoteId"', schema_name_text, table_name_text);
                
                -- Rename wsId to __scratchId (skipping the intermediate __wsId step)
                EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN "wsId" TO "__scratchId"', schema_name_text, table_name_text);
            END IF;
            
        END LOOP;
    END LOOP;
END $$;
