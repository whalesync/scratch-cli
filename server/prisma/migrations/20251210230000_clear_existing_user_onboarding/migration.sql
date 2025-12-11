-- Clear onboarding for all existing users so they don't see the onboarding flow
-- New users will get the onboarding flow initialized in the application code
UPDATE "User" SET "onboarding" = '{}'::jsonb;
