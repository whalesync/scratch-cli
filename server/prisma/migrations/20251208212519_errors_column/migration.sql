-- Add __errors column to all snapshot tables.

DO $$
DECLARE
    m_schema_name text;
    m_table_name text;
    full_table_name text;
BEGIN
    FOR m_schema_name, m_table_name IN
        SELECT 
            n.nspname,
            c.relname
        FROM 
            pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE 
            c.relkind = 'r'  -- only tables
            AND (n.nspname LIKE 'sna_%' OR n.nspname LIKE 'wkb_%')
            AND c.relname LIKE 'snt_%'
        ORDER BY 
            n.nspname, c.relname
    LOOP
        full_table_name := format('%I.%I', m_schema_name, m_table_name);
        
        -- Check if column already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = m_schema_name 
            AND table_name = m_table_name 
            AND column_name = '__errors'
        ) THEN
            RAISE NOTICE 'Adding __errors column to %', full_table_name;
            EXECUTE format('ALTER TABLE %I.%I ADD COLUMN __errors jsonb DEFAULT ''{}''::jsonb', 
                          m_schema_name, m_table_name);
        ELSE
            RAISE NOTICE 'Column __errors already exists in %', full_table_name;
        END IF;
    END LOOP;
END $$;

