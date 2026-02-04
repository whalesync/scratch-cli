# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Scratch** (codename: "Spinner") is a content management system that syncs data between external services (e.g. Airtable, Webflow) and a git-based storage layer. It enables knowledge workers to manage content across services in a unified workspace with a VS Code-like interface.

### Architecture

- **Client** (`/client`): Next.js web app on port 3000
- **Server** (`/server`): NestJS API server on port 3010

**NOTE**: The Next.js web app does **not** run in a serverless environment. It runs in Google Cloud Run.

### Subdirectory-Specific Rules

Each component has its own CLAUDE.md with instructions specific to the project.

## Development Commands

### Initial Setup

**Prerequisites**: Node.js (via nvm), Docker, Yarn

```bash
# Install dependencies
cd client && yarn install
cd server && yarn install

# Setup environment files
# Copy .env.example to .env in each directory and configure

# Start Docker services (PostgreSQL + Redis)
cd server/localdev && docker compose up -d

# Create database (first time only)
# Install: brew install libpq && brew link --force libpq
createdb -h localhost -p 5432 -U postgres scratchpad  # password: postgres

# Run migrations
cd server && yarn run migrate
```

### Package Manager

**IMPORTANT**: This project uses **`yarn`** as the package manager, NOT `npm`.

- Always use `yarn` for installing dependencies (e.g., `yarn add`, `yarn install`)
- Always use `yarn` for running scripts (e.g., `yarn build`, `yarn dev`)
- Never use `npm install` or `npm` commands

### NVM

When running commands that depend on Node, first run `nvm use` in whichever directory you're working in (e.g.
server/, client/). You DON'T need to source `~/.nvm/nvm.sh`.

### Common Commands

**Client:**

```bash
yarn run dev          # Start dev server
yarn run build        # Build for production
yarn run lint         # Run ESLint
yarn run lint-strict  # ESLint with max-warnings=0
```

**Server:**

```bash
yarn run start:dev    # Development with watch mode
yarn run build        # Build TypeScript
yarn run lint         # Run ESLint
yarn run lint-fix     # ESLint with auto-fix
yarn run test         # Run Jest tests
yarn run test:watch   # Tests in watch mode
yarn run migrate      # Deploy Prisma migrations
```

### NestJS DTOs in "server/"

For NestJS DTOs, we use the pattern:

- `class` definitions with 'class-validator' decorators for validation
- All properties are optional (in TypeScript, "?") to pass strict build rules
- A corresponding `Validated...` type where required fields are declared as required, using `Required<>` and `Pick<>`

### Infrastructure

The **`/terraform`** folder defines infrastructure for the application.

- shell scripts and utilities for managing the application
- Terraform files defining the infrastructure for the TEST and Production environnments on GCP
- Documentation on system architecture

### Project Management

We use [Linear](https://linear.app/whalesync/team/DEV) for project management.

## High-Level Architecture

### Server Module Organization

**Key modules:**

- `remote-service` - Connector abstraction layer for external services
- `custom-connector` / `custom-connector-builder` - User-defined and AI-generated connectors
- `worker` / `worker-enqueuer` - Background job processing (BullMQ + Piscina)
- `auth` / `clerk` - Multi-strategy authentication
- `users` / `payment` - User management and Stripe billing

### Microservice Architecture

Server supports different deployment modes via `SERVICE_TYPE` env variable:

- **MONOLITH**: All services in one process (local development)
- **FRONTEND**: HTTP API server only
- **WORKER**: Background job processor only
- **CRON**: Scheduled task runner only

This allows horizontal scaling in production while maintaining simplicity in development.

### Real-time Updates

Changes broadcast through Redis pub/sub → WebSocket gateway → connected clients. Multiple server instances coordinate seamlessly.

## Code Conventions

### Technologies & Patterns

**Client:**

- Next.js App Router (not Pages Router)
- React with Mantine UI components
- Zustand for state management, SWR for data fetching
- **Always use `next/link` for links, never `<a>`**
- Icons from `lucide-react`, wrapped in `StyledLucideIcon`
- Use `console.debug` instead of `console.log`

**Server:**

- NestJS with modular architecture - each feature is a self-contained module
- Prisma ORM + Knex for complex queries
- **Always use Yarn, never npm**
- Files end with newline, not space

### Client/Server Communication Pattern

When creating new REST endpoints, keep these elements in sync:

```
client/src/
├── hooks/use-[resource].ts              # SWR hook for components
├── lib/api/keys.ts                      # SWR cache keys
├── lib/api/[resource].ts                # API fetch methods
└── types/server-entities/[resource].ts  # TypeScript interfaces

server/src/[resource]/
├── [resource].controller.ts             # API endpoints
├── entities/*.entity.ts                 # Database entities
└── dto/*.dto.ts                         # Create/update DTOs
```

### File Structure

Each NestJS module follows this pattern:

```
/module-name/
├── README.md                    # Module documentation
├── module-name.module.ts        # NestJS module
├── module-name.controller.ts    # HTTP endpoints
├── module-name.service.ts       # Business logic
├── module-name.types.ts         # Type definitions
└── __tests__/*.spec.ts          # Jest tests
```

### Code Style

- Prettier with organize-imports plugin
- Single quotes, semicolons, 120 char line width
- Trailing commas everywhere
- kebab-case for files: `user-service.ts`
- PascalCase for classes: `UserService`

## Deployment

**Production URLs:**

- Client: https://app.scratch.md/
- Server: https://api.scratch.md/

**Deployment Process:**

- Main branch: `master` (development)
- Production branch: `prod`
- Scheduled pipeline merges master → prod daily at 9:30am PST

**Manual deployment:**

```bash
git checkout master && git pull
git checkout prod && git pull origin prod
git merge -m "(Auto) Merge branch 'master' into prod" --no-ff -X theirs master
git push origin prod
git checkout master  # Always leave prod immediately
```

## Important Notes

- React Strict Mode runs components twice in dev (affects debugging)
- Feature flags use OpenFeature + PostHog - **do NOT enable "Persist flag across authentication steps"** (causes errors)
- Connection credentials encrypted with `ENCRYPTION_MASTER_KEY`
- Test coverage is critically low (<1%) - see `TEST_COVERAGE.md` for priorities
- Project is rebranding from "ScratchPad" to "Scratch"

## Additional Resources

- Main README: `/README.md`
- Module-specific docs: Each `/server/src/*/README.md`
- GitLab Pipeline Schedules: https://gitlab.com/whalesync/spinner/-/pipeline_schedules
