/*
  Warnings:

  - You are about to drop the `GenericTable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GenericTable" DROP CONSTRAINT "GenericTable_userId_fkey";

-- DropTable
DROP TABLE "GenericTable";

-- CreateTable
CREATE TABLE "CustomConnector" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB,
    "userId" TEXT NOT NULL,
    "prompt" TEXT,
    "apiKey" TEXT,
    "listTables" TEXT,
    "tables" TEXT[],
    "fetchSchema" TEXT,
    "schema" JSONB,
    "pollRecords" TEXT,
    "getRecord" TEXT,
    "deleteRecord" TEXT,
    "createRecord" TEXT,
    "updateRecord" TEXT,
    "pollRecordsResponse" JSONB,
    "getRecordResponse" JSONB,

    CONSTRAINT "CustomConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomConnector_userId_idx" ON "CustomConnector"("userId");

-- AddForeignKey
ALTER TABLE "CustomConnector" ADD CONSTRAINT "CustomConnector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
