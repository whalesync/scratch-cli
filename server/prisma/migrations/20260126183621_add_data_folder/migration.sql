-- CreateTable
CREATE TABLE "DataFolder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "workbookId" TEXT NOT NULL,
    "connectorAccountId" TEXT,
    "connectorService" "Service",
    "schema" JSONB,
    "lastSchemaRefreshAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "path" TEXT,
    "lock" TEXT,
    "lastSyncTime" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DataFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataFolder_workbookId_idx" ON "DataFolder"("workbookId");

-- CreateIndex
CREATE INDEX "DataFolder_connectorAccountId_idx" ON "DataFolder"("connectorAccountId");

-- CreateIndex
CREATE INDEX "DataFolder_parentId_idx" ON "DataFolder"("parentId");

-- CreateIndex
CREATE INDEX "DataFolder_path_idx" ON "DataFolder"("path");

-- CreateIndex
CREATE UNIQUE INDEX "DataFolder_workbookId_parentId_name_key" ON "DataFolder"("workbookId", "parentId", "name");

-- AddForeignKey
ALTER TABLE "DataFolder" ADD CONSTRAINT "DataFolder_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "Workbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataFolder" ADD CONSTRAINT "DataFolder_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataFolder" ADD CONSTRAINT "DataFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
