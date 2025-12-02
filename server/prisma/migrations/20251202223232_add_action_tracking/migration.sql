-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('PUBLISH');

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Action_organizationId_actionType_createdAt_idx" ON "Action"("organizationId", "actionType", "createdAt");

-- CreateIndex
CREATE INDEX "Action_organizationId_createdAt_idx" ON "Action"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Action_userId_createdAt_idx" ON "Action"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
