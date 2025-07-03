-- CreateTable
CREATE TABLE "SnapshotTableView" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "SnapshotTableView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotTableView_snapshotId_tableId_key" ON "SnapshotTableView"("snapshotId", "tableId");

-- AddForeignKey
ALTER TABLE "SnapshotTableView" ADD CONSTRAINT "SnapshotTableView_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
