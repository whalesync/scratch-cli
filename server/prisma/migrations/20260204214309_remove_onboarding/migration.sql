-- Remove onboarding-related fields from User table
-- First drop the foreign key constraint, then the columns

-- Drop the unique constraint on onboardingWorkbookId
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_onboardingWorkbookId_key";

-- Drop the foreign key constraint
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_onboardingWorkbookId_fkey";

-- Drop the columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "onboarding";
ALTER TABLE "User" DROP COLUMN IF EXISTS "onboardingWorkbookId";
