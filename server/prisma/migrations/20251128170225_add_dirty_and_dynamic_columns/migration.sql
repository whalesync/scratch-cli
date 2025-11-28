-- AlterTable: Add dirty column to SnapshotTable
ALTER TABLE "SnapshotTable" ADD COLUMN "dirty" BOOLEAN NOT NULL DEFAULT false;

-- Add __original and __old_remote_id columns to all dynamic tables in wkb_ and sna_ schemas
DO $$
DECLARE
    schema_record RECORD;
    table_record RECORD;
BEGIN
    -- Loop through all schemas that start with wkb_ or sna_
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'wkb_%' OR schema_name LIKE 'sna_%'
    LOOP
        -- Loop through all tables in each schema
        FOR table_record IN 
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = schema_record.schema_name 
            AND table_type = 'BASE TABLE'
        LOOP
            -- Add __original column (defaults to NULL)
            EXECUTE format('ALTER TABLE %I.%I ADD COLUMN __original jsonb', 
                schema_record.schema_name, table_record.table_name);
            
            -- Add __old_remote_id column (defaults to NULL)
            EXECUTE format('ALTER TABLE %I.%I ADD COLUMN __old_remote_id text', 
                schema_record.schema_name, table_record.table_name);
                
            RAISE NOTICE 'Added columns to %.%', schema_record.schema_name, table_record.table_name;
        END LOOP;
    END LOOP;
END $$;
