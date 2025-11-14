-- Before dropping the CustomConnector table removing the Service.CUSTOM enum, we need to delete all the user data for custom connectors

-- Delete SnapshotTable records that reference CUSTOM service
DELETE FROM "SnapshotTable" WHERE "connectorService" = 'CUSTOM';

-- Delete ConnectorAccount records that use CUSTOM service
DELETE FROM "ConnectorAccount" WHERE "service" = 'CUSTOM';
