-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastWorkbookId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastWorkbookId_fkey" FOREIGN KEY ("lastWorkbookId") REFERENCES "Workbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Set default lastWorkbookId for existing users who have workbooks
UPDATE "User" u
SET "lastWorkbookId" = (
  SELECT w.id FROM "Workbook" w
  WHERE w."userId" = u.id
  ORDER BY w."createdAt" DESC
  LIMIT 1
)
WHERE u."lastWorkbookId" IS NULL
AND EXISTS (SELECT 1 FROM "Workbook" w WHERE w."userId" = u.id);
