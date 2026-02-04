# Plan: Remove Pydantic AI Agent

## Overview

Remove all AI agent functionality from the Scratch application. The AI agent was a feature that allowed users to interact with their data through natural language, but it's been disabled and is now unused code.

## Background

- The pydantic-ai-agent runs on port 8000 as a FastAPI service
- It communicates with the client via WebSocket and REST APIs
- The server provides supporting modules for auth, sessions, credentials, and usage tracking
- The feature has been hidden in the UI and has no active users

---

## Phase 1: Client Cleanup

### 1.1 Remove UI Components - Workbooks

**Files to delete:**

- [ ] `client/src/app/workbooks-md/[...slug]/components/AIChatPanel/` (entire directory - 14 files)
- [ ] `client/src/app/workbooks-md/[...slug]/components/contexts/agent-chat-context.tsx`

**Files to modify:**

- [ ] `client/src/app/workbooks-md/[...slug]/page.tsx`:
  - Remove `AIAgentSessionManagerProvider` import and wrapper (~lines 18, 231-235)
  - Remove `AIChatPanel` import and component usage

### 1.1b Remove UI Components - Settings

**Files to delete:**

- [ ] `client/src/app/settings/components/AgentCredentialsSection.tsx`
- [ ] `client/src/app/settings/components/EditAgentCredentialsModal.tsx`
- [ ] `client/src/app/settings/components/TokenUsageSection.tsx`
- [ ] `client/src/app/settings/components/CredentialLimit.tsx`
- [ ] `client/src/app/settings/components/DefaultModelSection.tsx` (uses agent model defaults)

**Files to modify:**

- [ ] `client/src/app/settings/page.tsx`:
  - Remove `AgentCredentialsSection` import and usage (lines 9, 30)
- [ ] `client/src/app/settings/components/UserDevToolsSection.tsx`:
  - Remove agentJwt display (lines 33-45)
- [ ] `client/src/types/common.ts`:
  - Check for `DEFAULT_AGENT_MODEL_ID` and `DEFAULT_AGENT_MODEL_CONTEXT_LENGTH` - remove if unused elsewhere

### 1.2 Remove WebSocket Store

**Files to delete:**

- [ ] `client/src/stores/agent-chat-websocket-store.ts`

### 1.3 Remove API SDK and Hooks

**Files to delete:**

- [ ] `client/src/lib/api/agent.ts`
- [ ] `client/src/lib/api/agent-credentials.ts`
- [ ] `client/src/lib/api/agent-pricing.ts`
- [ ] `client/src/lib/api/agent-usage-events.ts`
- [ ] `client/src/hooks/use-agent-credentials.ts`
- [ ] `client/src/hooks/use-agent-pricing.ts`
- [ ] `client/src/hooks/use-agent-usage-stats.ts`
- [ ] `client/src/hooks/use-openrouter-models.ts` (only used for agent model selection)
- [ ] `client/src/utils/agent-cost-calculator.ts`
- [ ] `client/src/app/components/modals/ModelPickerModal.tsx` (only used for agent)

**Files to modify:**

- [ ] `client/src/lib/api/keys.ts` - Remove SWR keys:
  - `agentCredentials` (lines 5-11)
  - `agentUsage` (lines 46-56)
  - `agentSessions` (lines 57-60)
  - `agentPricing` (lines 68-70)

### 1.4 Remove Session Manager Context

**Files to delete:**

- [ ] `client/src/contexts/ai-agent-session-manager-context.tsx`

(Note: The provider is used in workbooks page.tsx, already covered in 1.1)

### 1.5 Remove Agent JWT from User Handling

**Files to modify:**

- [ ] `client/src/lib/api/config.ts` - Remove:
  - `aiAgentApiUrl` and `aiAgentWebSocketUrl` properties (lines 8-9, 20-21)
  - `agentJwt` property and methods (lines 11, 23, 74-82)
  - `agentAxiosInstance` property (line 16)
  - `getAiAgentApiUrl()`, `getAgentAxiosInstance()`, `getAiAgentWebSocketUrl()` methods (lines 70-115)
  - `getAiAgentAuthHeaders()` method (lines 84-88)
- [ ] `client/src/hooks/useScratchpadUser.ts` - Remove:
  - Comment about agent JWT in refreshInterval (line 33)
  - Agent JWT update logic in onSuccess callback (lines 39-41)
- [ ] `client/src/types/server-entities/users.ts` - Remove `agentJwt` field (line 10)

### 1.6 Remove Environment Variables

**Files to modify:**

- [ ] `client/.env.local.example` - Remove `NEXT_PUBLIC_AI_AGENT_*` variables
- [ ] `client/Dockerfile.monorepo` - Remove agent build args

### 1.7 Verification

- [ ] Run `yarn run build` in client directory
- [ ] Run `yarn run lint` in client directory
- [ ] Verify app loads without errors

---

## Phase 2: Server Cleanup

### 2.1 Remove Agent Modules

**Directories to delete:**

- [ ] `server/src/agent-jwt/`
- [ ] `server/src/agent-session/`
- [ ] `server/src/agent-credentials/`
- [ ] `server/src/agent-pricing/`
- [ ] `server/src/agent-token-usage/`
- [ ] `server/src/openrouter/` (only used by agent modules)

### 2.2 Update App Module

**Files to modify:**

- [ ] `server/src/app.module.ts` - Remove imports for all 6 modules:
  - `AgentJwtModule`
  - `AgentSessionModule`
  - `AgentCredentialsModule`
  - `AgentPricingModule`
  - `AgentTokenUsageModule`
  - `OpenRouterModule`

### 2.3 Update Users Module

**Files to modify:**

- [ ] `server/src/users/users.controller.ts`:
  - Remove `JwtGeneratorService` import and injection (lines 22, 39)
  - Remove `getAvailableModelsForUser` import (line 26)
  - Remove `agentJwt` generation in `currentUser()` (lines 51-58)
  - Update `User` constructor call to remove `agentJwt` param (line 69)
- [ ] `server/src/users/users.module.ts` - Remove `AgentJwtModule` import
- [ ] `server/src/users/entities/user.entity.ts`:
  - Remove `agentJwt` property (lines 27-28)
  - Remove `agentJwt` constructor param and assignment (lines 44, 61)
- [ ] `server/src/users/subscription-utils.ts` - Delete `getAvailableModelsForUser` function (only used for agent)

### 2.4 Remove Config Service Methods

**Files to modify:**

- [ ] `server/src/config/scratchpad-config.service.ts` - Remove:
  - `getScratchpadAgentAuthToken()`
  - `getScratchpadAgentJWTSecret()`
  - `getScratchpadAgentJWTExpiresIn()`

### 2.5 Remove Auth Strategy (if exists)

**Files to check/delete:**

- [ ] `server/src/auth/agent-token.strategy.ts` - Delete if exists

### 2.6 Remove Environment Variables

**Files to modify:**

- [ ] `server/.env.example` - Remove agent-related variables
- [ ] `server/.env.integration.example` - Remove `INTEGRATION_TEST_AGENT_DOMAIN`

### 2.7 Verification

- [ ] Run `yarn run build` in server directory
- [ ] Run `yarn run lint` in server directory
- [ ] Run `yarn run test` in server directory

---

## Phase 3: Shared Types Cleanup

### 3.1 Remove Type Files

**Files to delete:**

- [ ] `packages/shared-types/src/agent-chat.ts`
- [ ] `packages/shared-types/src/agent-credentials.ts`
- [ ] `packages/shared-types/src/agent-usage-events.ts`
- [ ] `packages/shared-types/src/openrouter.ts` (only used for agent pricing)
- [ ] `packages/shared-types/src/dto/agent-credentials/create-agent-credential.dto.ts`
- [ ] `packages/shared-types/src/dto/agent-credentials/update-agent-credential.dto.ts`
- [ ] `packages/shared-types/src/dto/agent-session/create-agent-session.dto.ts`
- [ ] `packages/shared-types/src/dto/agent-session/update-agent-session.dto.ts`
- [ ] `packages/shared-types/src/dto/agent-token-usage/create-agent-token-usage-event.dto.ts`
- [ ] `packages/shared-types/src/dto/agent-credentials/` (directory, if empty after)
- [ ] `packages/shared-types/src/dto/agent-session/` (directory, if empty after)
- [ ] `packages/shared-types/src/dto/agent-token-usage/` (directory, if empty after)

### 3.2 Update Index Exports

**Files to modify:**

- [ ] `packages/shared-types/src/index.ts` - Remove these exports:
  - Line 12: `export * from './agent-chat';`
  - Line 13: `export * from './agent-credentials';`
  - Line 14: `export * from './agent-usage-events';`
  - Line 21: `export * from './openrouter';`
  - Lines 28-32: All agent DTO exports

### 3.3 Verification

- [ ] Rebuild shared-types package
- [ ] Verify client and server still build

---

## Phase 4: GitLab CI Cleanup

### 4.1 Remove Build Jobs

**Files to modify:**

- [ ] `gitlab-ci/stages/01-build-and-test.yml`:
  - Remove `build and test agent` job
  - Remove `build agent docker image` job
  - Remove `NEXT_PUBLIC_AI_AGENT_*` build args from client build jobs

### 4.2 Remove Push Jobs

**Files to modify:**

- [ ] `gitlab-ci/stages/03-push-images.yml`:
  - Remove `push agent image to test artifact registry` job
  - Remove `push agent image to production artifact registry` job
  - Remove entire `#region agent` section

### 4.3 Remove Deploy Jobs

**Files to modify:**

- [ ] `gitlab-ci/stages/05-deploy.yml`:
  - Remove `deploy agent service to Cloud Run test environment` job
  - Remove `deploy agent service to Cloud Run production environment` job
  - Update Slack notification `needs` arrays to remove agent references

### 4.4 Remove Integration Test Config

**Files to modify:**

- [ ] `gitlab-ci/stages/06-integration-tests.yml` - Remove `INTEGRATION_TEST_AGENT_DOMAIN` variable

---

## Phase 5: Final Cleanup

### 5.1 Delete Pydantic AI Agent Directory

- [ ] Delete entire `/pydantic-ai-agent` directory

### 5.2 Update Development Scripts

**Files to modify:**

- [ ] `start-dev.sh` - Remove:
  - Agent color definition (MAGENTA)
  - Agent startup function (~lines 151-158)
  - `AGENT_PID` variable and cleanup logic
  - Agent shutdown in SIGINT/SIGTERM handler (~lines 102-105)

### 5.3 Update Documentation

**Files to modify:**

- [ ] `CLAUDE.md` - Remove AI agent references from architecture docs
- [ ] `README.md` - Remove agent from project structure
- [ ] `.claude/CLAUDE.md` - Update architecture section

### 5.4 Terraform Cleanup

**File to modify:**

- [ ] `terraform/modules/env/services.tf` - Remove:
  - `google_cloud_run_v2_service.agent_service` resource (~lines 297-408)
  - `google_cloud_run_service_iam_member.agent_service_public` resource (~line 411)
  - `module.agent_lb` load balancer configuration (~lines 418-430)

**Variables to check/clean:**

- [ ] `terraform/modules/env/variables.tf` - Remove agent-related variables:
  - `agent_service_min_instance_count`
  - `agent_service_max_instance_count`
  - Any agent domain variables

**Outputs to check/clean:**

- [ ] Check for agent-related outputs in Terraform files

---

## Phase 6: Post-Cleanup Verification

### 6.1 Full Build Verification

- [ ] `cd client && yarn run build`
- [ ] `cd server && yarn run build`
- [ ] `cd packages/shared-types && yarn run build` (if applicable)

### 6.2 Test Verification

- [ ] `cd server && yarn run test`
- [ ] `cd client && yarn run lint`
- [ ] `cd server && yarn run lint`

### 6.3 Local Development Verification

- [ ] Start client and server with `start-dev.sh` (modified)
- [ ] Verify app loads and functions without agent

---

## Notes

### Database Tables (Not Removed)

The following Prisma models/tables will remain but be unused:

- `AgentSession`
- Any agent credentials or usage tables

These can be cleaned up in a future migration if desired.

### Environment Variables to Clean Up (Manual)

Production environments (GCP) may have these variables set:

- `NEXT_PUBLIC_AI_AGENT_API_URL`
- `NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL`
- `SCRATCHPAD_AGENT_JWT_SECRET`
- `SCRATCHPAD_AGENT_JWT_EXPIRES_IN`

### False Positive Watch List

Be careful not to remove code that uses "agent" in other contexts:

- User-Agent headers
- Any unrelated "agent" terminology
