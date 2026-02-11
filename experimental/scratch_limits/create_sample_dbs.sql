-- Run against the test-sandbox.db server
-- It will drop and recreate sample databases and populate their tables.
-- psql postgresql://postgres:GrgWIusmGLSYfYF9FeCl@test-sandbox-db.whalesync.com:5432/postgres -f create_sample_dbs.sql

-- Drop if exist, then create
DROP DATABASE IF EXISTS test_table_count_at;
DROP DATABASE IF EXISTS test_table_count_over;
DROP DATABASE IF EXISTS test_col_count_at;
DROP DATABASE IF EXISTS test_col_count_over;
DROP DATABASE IF EXISTS test_record_count_at;
DROP DATABASE IF EXISTS test_record_count_over;
DROP DATABASE IF EXISTS test_record_size_at;
DROP DATABASE IF EXISTS test_record_size_over;

CREATE DATABASE test_table_count_at;
CREATE DATABASE test_table_count_over;
CREATE DATABASE test_col_count_at;
CREATE DATABASE test_col_count_over;
CREATE DATABASE test_record_count_at;
CREATE DATABASE test_record_count_over;
CREATE DATABASE test_record_size_at;
CREATE DATABASE test_record_size_over;

-- =========================================================
-- TABLE COUNT — AT LIMIT (300 tables)
-- =========================================================
\c test_table_count_at
DO $$
BEGIN
  FOR i IN 1..300 LOOP
    EXECUTE format('CREATE TABLE t_%s (id serial PRIMARY KEY, data text)', i);
    EXECUTE format('INSERT INTO t_%s (data) SELECT md5(g::text) FROM generate_series(1, 30) AS g', i);
  END LOOP;
END $$;

-- =========================================================
-- TABLE COUNT — OVER LIMIT (301 tables)
-- =========================================================
\c test_table_count_over
DO $$
BEGIN
  FOR i IN 1..301 LOOP
    EXECUTE format('CREATE TABLE t_%s (id serial PRIMARY KEY, data text)', i);
    EXECUTE format('INSERT INTO t_%s (data) SELECT md5(g::text) FROM generate_series(1, 30) AS g', i);
  END LOOP;
END $$;

-- =========================================================
-- COLUMN COUNT — AT LIMIT (250 columns)
-- =========================================================
\c test_col_count_at
DO $$
DECLARE
  col_defs text := '';
  col_vals text := '';
BEGIN
  FOR i IN 1..249 LOOP
    col_defs := col_defs || format(', col_%s text', i);
    col_vals := col_vals || format(', md5((%s * g)::text)', i);
  END LOOP;
  EXECUTE 'CREATE TABLE wide_table (id serial PRIMARY KEY' || col_defs || ')';
  EXECUTE 'INSERT INTO wide_table SELECT g' || col_vals || ' FROM generate_series(1, 30) AS g';
END $$;

-- =========================================================
-- COLUMN COUNT — OVER LIMIT (251 columns)
-- =========================================================
\c test_col_count_over
DO $$
DECLARE
  col_defs text := '';
  col_vals text := '';
BEGIN
  FOR i IN 1..250 LOOP
    col_defs := col_defs || format(', col_%s text', i);
    col_vals := col_vals || format(', md5((%s * g)::text)', i);
  END LOOP;
  EXECUTE 'CREATE TABLE wide_table (id serial PRIMARY KEY' || col_defs || ')';
  EXECUTE 'INSERT INTO wide_table SELECT g' || col_vals || ' FROM generate_series(1, 30) AS g';
END $$;

-- =========================================================
-- RECORD COUNT — AT LIMIT (200,000 records)
-- =========================================================
\c test_record_count_at
CREATE TABLE big_table (id serial PRIMARY KEY, data json);
INSERT INTO big_table (data)
  SELECT json_build_object('id', g, 'value', md5(g::text))
  FROM generate_series(1, 200000) AS g;

-- =========================================================
-- RECORD COUNT — OVER LIMIT (200,001 records)
-- =========================================================
\c test_record_count_over
CREATE TABLE big_table (id serial PRIMARY KEY, data json);
INSERT INTO big_table (data)
  SELECT json_build_object('id', g, 'value', md5(g::text))
  FROM generate_series(1, 200001) AS g;

-- =========================================================
-- RECORD SIZE — AT LIMIT (~100KB JSON)
-- =========================================================
\c test_record_size_at
CREATE TABLE large_records (id serial PRIMARY KEY, data json);
INSERT INTO large_records (data)
  SELECT json_build_object('id', g, 'payload', repeat('x', 99950))
  FROM generate_series(1, 30) AS g;

-- =========================================================
-- RECORD SIZE — OVER LIMIT (>100KB JSON)
-- =========================================================
\c test_record_size_over
CREATE TABLE large_records (id serial PRIMARY KEY, data json);
INSERT INTO large_records (data)
  SELECT json_build_object('id', g, 'payload', repeat('x', 105000))
  FROM generate_series(1, 30) AS g;