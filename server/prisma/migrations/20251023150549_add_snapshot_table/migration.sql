-- CreateTable
CREATE TABLE "SnapshotTable" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "connectorAccountId" TEXT,
    "tableSpec" JSONB NOT NULL,
    "tableContext" JSONB,
    "columnContexts" JSONB NOT NULL DEFAULT '{}',
    "activeRecordSqlFilter" TEXT,

    CONSTRAINT "SnapshotTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SnapshotTable_snapshotId_idx" ON "SnapshotTable"("snapshotId");

-- CreateIndex
CREATE INDEX "SnapshotTable_connectorAccountId_idx" ON "SnapshotTable"("connectorAccountId");

-- AddForeignKey
ALTER TABLE "SnapshotTable" ADD CONSTRAINT "SnapshotTable_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotTable" ADD CONSTRAINT "SnapshotTable_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
