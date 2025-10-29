-- Back fill organizations for users who don't have an organization yet
-- use the User.clerkId to create a new organization so we can tell which organizations need to be recreated on Clerk later
WITH new_orgs AS (
  INSERT INTO "Organization" (id, "clerkId", name, "createdAt", "updatedAt")
  SELECT 
    'org_' || substr(md5(random()::text), 1, 12) as id,
    u."clerkId",
    COALESCE(u."name", 'New user') || ' organization' as name,
    NOW() as "createdAt",
    NOW() as "updatedAt"
  FROM "User" u
  WHERE u."organizationId" IS NULL 
    AND u."clerkId" IS NOT NULL
  RETURNING id, "clerkId"
)
UPDATE "User" 
SET "organizationId" = new_orgs.id
FROM new_orgs
WHERE "User"."clerkId" = new_orgs."clerkId"
  AND "User"."organizationId" IS NULL;