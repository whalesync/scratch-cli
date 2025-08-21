-- AlterTable
ALTER TABLE "StyleGuide" ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'markdown',
ADD COLUMN     "lastDownloadedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "tags" TEXT[];
