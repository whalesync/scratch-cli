-- CreateTable
CREATE TABLE "FileIndex" (
    "id" TEXT NOT NULL,
    "workbookId" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "FileIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileReference" (
    "id" TEXT NOT NULL,
    "workbookId" TEXT NOT NULL,
    "sourceFilePath" TEXT NOT NULL,
    "targetFolderPath" TEXT NOT NULL,
    "targetFileName" TEXT,
    "targetFileRecordId" TEXT,
    "branch" TEXT NOT NULL,

    CONSTRAINT "FileReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileIndex_workbookId_folderPath_filename_idx" ON "FileIndex"("workbookId", "folderPath", "filename");

-- CreateIndex
CREATE INDEX "FileIndex_workbookId_folderPath_lastSeenAt_idx" ON "FileIndex"("workbookId", "folderPath", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileIndex_workbookId_folderPath_recordId_key" ON "FileIndex"("workbookId", "folderPath", "recordId");

-- CreateIndex
CREATE INDEX "FileReference_workbookId_targetFolderPath_targetFileName_idx" ON "FileReference"("workbookId", "targetFolderPath", "targetFileName");

-- CreateIndex
CREATE INDEX "FileReference_workbookId_targetFolderPath_targetFileRecordI_idx" ON "FileReference"("workbookId", "targetFolderPath", "targetFileRecordId");

-- CreateIndex
CREATE INDEX "FileReference_workbookId_sourceFilePath_branch_idx" ON "FileReference"("workbookId", "sourceFilePath", "branch");
