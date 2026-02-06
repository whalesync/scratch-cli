-- =============================================================================
-- Extract Whalesync Sync Configuration for Migration to Scratch
-- =============================================================================
-- Replace the WHERE clause below with the customer's identifier:
--   u."mostRecentEmail" = 'customer@example.com'
--   OR u."id" = 'some-uuid'
--   OR u."clerkId" = 'some-clerk-id'
-- =============================================================================

WITH target_user AS (
  SELECT u."id" AS user_id, u."firstName", u."lastName", u."mostRecentEmail"
  FROM "User" u
  WHERE u."mostRecentEmail" = 'REPLACE_WITH_EMAIL'
  LIMIT 1
),

-- Get all active CoreBases for this user
bases AS (
  SELECT
    cb."id" AS core_base_id,
    cb."displayName" AS base_name,
    cb."syncState",
    cb."lastSyncTime",
    cb."configExtras"
  FROM "CoreBase" cb
  JOIN target_user tu ON cb."userId" = tu.user_id
  WHERE cb."isPendingDelete" = false
),

-- Get ExternalBases with their connection info
ext_bases AS (
  SELECT
    eb."id" AS external_base_id,
    eb."coreBaseId" AS core_base_id,
    eb."connectorType",
    eb."displayName" AS external_base_name,
    eb."remoteId" AS remote_base_id,
    eb."browserUrl",
    eb."side",
    eb."externalConnectionId",
    ec."connectorType" AS connection_connector_type
  FROM "ExternalBase" eb
  JOIN "ExternalConnection" ec ON eb."externalConnectionId" = ec."id"
  WHERE eb."coreBaseId" IN (SELECT core_base_id FROM bases)
),

-- Get ExternalTables
ext_tables AS (
  SELECT
    et."id" AS external_table_id,
    et."externalBaseId" AS external_base_id,
    et."displayName" AS table_name,
    et."connectorType",
    et."remoteId" AS remote_table_id,
    et."supportsWrite",
    et."category",
    et."availableConfigExtras",
    et."extras",
    et."orphaned"
  FROM "ExternalTable" et
  WHERE et."externalBaseId" IN (SELECT external_base_id FROM ext_bases)
    AND et."orphaned" = false
),

-- Get ExternalColumns
ext_columns AS (
  SELECT
    ec."id" AS external_column_id,
    ec."externalTableId" AS external_table_id,
    ec."displayName" AS column_name,
    ec."connectorType",
    ec."remoteId" AS remote_column_id,
    ec."dataType",
    ec."typeMetadata",
    ec."extras",
    ec."displayOrder",
    ec."orphaned"
  FROM "ExternalColumn" ec
  WHERE ec."externalTableId" IN (SELECT external_table_id FROM ext_tables)
    AND ec."orphaned" = false
),

-- Get CoreTables
core_tables AS (
  SELECT
    ct."id" AS core_table_id,
    ct."coreBaseId" AS core_base_id,
    ct."displayName" AS table_name,
    ct."filter",
    ct."needsInitialSync",
    ct."isPendingDelete"
  FROM "CoreTable" ct
  WHERE ct."coreBaseId" IN (SELECT core_base_id FROM bases)
    AND ct."isPendingDelete" = false
),

-- Get CoreColumns
core_columns AS (
  SELECT
    cc."id" AS core_column_id,
    cc."coreTableId" AS core_table_id,
    cc."displayName" AS column_name,
    cc."displayOrder"
  FROM "CoreColumn" cc
  WHERE cc."coreTableId" IN (SELECT core_table_id FROM core_tables)
),

-- Get TableMappings
table_mappings AS (
  SELECT
    tm."id" AS table_mapping_id,
    tm."coreTableId" AS core_table_id,
    tm."externalTableId" AS external_table_id,
    tm."syncToCoreEnabled",
    tm."syncToExternalEnabled",
    tm."recordDeleteBehavior",
    tm."selectedConfigExtras",
    tm."syncEnabledExternalColumnId"
  FROM "TableMapping" tm
  WHERE tm."coreTableId" IN (SELECT core_table_id FROM core_tables)
),

-- Get ColumnMappings
column_mappings AS (
  SELECT
    cm."id" AS column_mapping_id,
    cm."coreColumnId" AS core_column_id,
    cm."externalColumnId" AS external_column_id,
    cm."connectorType",
    cm."syncToCoreEnabled",
    cm."syncToCoreTransforms",
    cm."syncToExternalEnabled",
    cm."syncToExternalTransforms",
    cm."initializeOnMerge",
    cm."assetUploadPolicy",
    cm."richContentPolicy"
  FROM "ColumnMapping" cm
  WHERE cm."coreColumnId" IN (SELECT core_column_id FROM core_columns)
)

-- =============================================================================
-- Output as structured JSON
-- =============================================================================
SELECT json_build_object(
  'user', (SELECT row_to_json(tu) FROM target_user tu),

  'coreBases', (
    SELECT json_agg(
      json_build_object(
        'id', b.core_base_id,
        'name', b.base_name,
        'syncState', b."syncState",
        'lastSyncTime', b."lastSyncTime",
        'configExtras', b."configExtras",

        'externalBases', (
          SELECT json_agg(
            json_build_object(
              'id', eb.external_base_id,
              'connectorType', eb."connectorType",
              'name', eb.external_base_name,
              'remoteId', eb.remote_base_id,
              'browserUrl', eb."browserUrl",
              'side', eb.side,
              'externalConnectionId', eb."externalConnectionId",

              'tables', (
                SELECT json_agg(
                  json_build_object(
                    'id', et.external_table_id,
                    'name', et.table_name,
                    'connectorType', et."connectorType",
                    'remoteId', et.remote_table_id,
                    'supportsWrite', et."supportsWrite",
                    'category', et.category,
                    'availableConfigExtras', et."availableConfigExtras",
                    'extras', et.extras,

                    'columns', (
                      SELECT json_agg(
                        json_build_object(
                          'id', ec.external_column_id,
                          'name', ec.column_name,
                          'connectorType', ec."connectorType",
                          'remoteId', ec.remote_column_id,
                          'dataType', ec."dataType",
                          'typeMetadata', ec."typeMetadata",
                          'extras', ec.extras,
                          'displayOrder', ec."displayOrder"
                        ) ORDER BY ec."displayOrder"
                      )
                      FROM ext_columns ec
                      WHERE ec.external_table_id = et.external_table_id
                    )
                  )
                )
                FROM ext_tables et
                WHERE et.external_base_id = eb.external_base_id
              )
            )
          )
          FROM ext_bases eb
          WHERE eb.core_base_id = b.core_base_id
        ),

        'coreTables', (
          SELECT json_agg(
            json_build_object(
              'id', ct.core_table_id,
              'name', ct.table_name,
              'filter', ct.filter,

              'coreColumns', (
                SELECT json_agg(
                  json_build_object(
                    'id', cc.core_column_id,
                    'name', cc.column_name,
                    'displayOrder', cc."displayOrder"
                  ) ORDER BY cc."displayOrder"
                )
                FROM core_columns cc
                WHERE cc.core_table_id = ct.core_table_id
              ),

              'tableMappings', (
                SELECT json_agg(
                  json_build_object(
                    'id', tm.table_mapping_id,
                    'externalTableId', tm.external_table_id,
                    'syncToCoreEnabled', tm."syncToCoreEnabled",
                    'syncToExternalEnabled', tm."syncToExternalEnabled",
                    'recordDeleteBehavior', tm."recordDeleteBehavior",
                    'selectedConfigExtras', tm."selectedConfigExtras",
                    'syncEnabledExternalColumnId', tm."syncEnabledExternalColumnId",

                    'columnMappings', (
                      SELECT json_agg(
                        json_build_object(
                          'id', cmx.column_mapping_id,
                          'coreColumnId', cmx.core_column_id,
                          'externalColumnId', cmx.external_column_id,
                          'connectorType', cmx."connectorType",
                          'syncToCoreEnabled', cmx."syncToCoreEnabled",
                          'syncToCoreTransforms', cmx."syncToCoreTransforms",
                          'syncToExternalEnabled', cmx."syncToExternalEnabled",
                          'syncToExternalTransforms', cmx."syncToExternalTransforms",
                          'initializeOnMerge', cmx."initializeOnMerge",
                          'assetUploadPolicy', cmx."assetUploadPolicy",
                          'richContentPolicy', cmx."richContentPolicy",

                          'coreColumn', (
                            SELECT json_build_object(
                              'id', cc.core_column_id,
                              'name', cc.column_name
                            )
                            FROM core_columns cc
                            WHERE cc.core_column_id = cmx.core_column_id
                          ),
                          'externalColumn', (
                            SELECT json_build_object(
                              'id', ec.external_column_id,
                              'name', ec.column_name,
                              'remoteId', ec.remote_column_id,
                              'dataType', ec."dataType",
                              'typeMetadata', ec."typeMetadata"
                            )
                            FROM ext_columns ec
                            WHERE ec.external_column_id = cmx.external_column_id
                          )
                        )
                      )
                      FROM column_mappings cmx
                      JOIN core_columns ccj ON ccj.core_column_id = cmx.core_column_id
                      WHERE ccj.core_table_id = ct.core_table_id
                        AND cmx.external_column_id IN (
                          SELECT ecj.external_column_id
                          FROM ext_columns ecj
                          WHERE ecj.external_table_id = tm.external_table_id
                        )
                    )
                  )
                )
                FROM table_mappings tm
                WHERE tm.core_table_id = ct.core_table_id
              )
            )
          )
          FROM core_tables ct
          WHERE ct.core_base_id = b.core_base_id
        )
      )
    )
    FROM bases b
  )
) AS sync_config;
