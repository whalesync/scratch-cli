-- AlterTable
ALTER TABLE "GenericTable" ADD COLUMN     "createRecord" TEXT,
ADD COLUMN     "deleteRecord" TEXT,
ADD COLUMN     "getRecord" TEXT,
ADD COLUMN     "getRecordResponse" JSONB,
ADD COLUMN     "pollRecordsResponse" JSONB,
ADD COLUMN     "updateRecord" TEXT;
