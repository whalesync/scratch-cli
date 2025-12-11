-- Update onboarding data from old format to new format
-- Old format: { gettingStartedV1: { stepKey: boolean } }
-- New format: { gettingStartedV1: { stepKey: { completed: boolean, collapsed: boolean } } }

UPDATE "User"
SET "onboarding" = jsonb_build_object(
  'gettingStartedV1', jsonb_build_object(
    'dataSourceConnected', jsonb_build_object(
      'completed', COALESCE((onboarding->'gettingStartedV1'->>'dataSourceConnected')::boolean, false),
      'collapsed', false
    ),
    'contentEditedWithAi', jsonb_build_object(
      'completed', COALESCE((onboarding->'gettingStartedV1'->>'contentEditedWithAi')::boolean, false),
      'collapsed', false
    ),
    'suggestionsAccepted', jsonb_build_object(
      'completed', COALESCE((onboarding->'gettingStartedV1'->>'suggestionsAccepted')::boolean, false),
      'collapsed', false
    ),
    'dataPublished', jsonb_build_object(
      'completed', COALESCE((onboarding->'gettingStartedV1'->>'dataPublished')::boolean, false),
      'collapsed', false
    )
  )
)
WHERE onboarding IS NOT NULL
  AND onboarding->'gettingStartedV1' IS NOT NULL
  AND jsonb_typeof(onboarding->'gettingStartedV1'->'dataSourceConnected') = 'boolean';
