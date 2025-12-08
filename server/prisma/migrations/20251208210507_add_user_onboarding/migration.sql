-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboarding" JSONB DEFAULT '{}';

-- Populate existing users with default onboarding state for testing
UPDATE "User" SET "onboarding" = '{"gettingStartedV1": {"dataSourceConnected": false, "contentEditedWithAi": false, "suggestionsAccepted": false, "dataPublished": false}}';
