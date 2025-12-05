-- Copy description to name, with special handling for SYSTEM source
UPDATE "AiAgentCredential"
SET "name" = CASE
  WHEN "source" = 'SYSTEM' THEN 'OpenRouter API key provided by Scratch'
  WHEN "description" IS NULL OR "description" = '' THEN 'User Key'
  ELSE "description"
END
WHERE "name" IS NULL OR "name" = '';