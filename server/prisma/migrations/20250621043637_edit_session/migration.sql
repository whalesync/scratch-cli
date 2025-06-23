-- CreateEnum
CREATE TYPE "EditSessionStatus" AS ENUM ('CREATING', 'EDITING', 'COMMITTING', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "EditSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "EditSessionStatus" NOT NULL DEFAULT 'CREATING',
    "connectorAccountId" TEXT NOT NULL,

    CONSTRAINT "EditSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditSession_connectorAccountId_idx" ON "EditSession"("connectorAccountId");

-- AddForeignKey
ALTER TABLE "EditSession" ADD CONSTRAINT "EditSession_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
