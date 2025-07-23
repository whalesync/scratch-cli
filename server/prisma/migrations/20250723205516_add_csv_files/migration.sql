-- AlterEnum
ALTER TYPE "Service" ADD VALUE 'CSV';

-- CreateTable
CREATE TABLE "CsvFile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CsvFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CsvFile_userId_idx" ON "CsvFile"("userId");

-- AddForeignKey
ALTER TABLE "CsvFile" ADD CONSTRAINT "CsvFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
