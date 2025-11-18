# Scratch Server

The NestJS backend for the Scratch application.

---

## Setup & Development

### Install Node and Dependencies

```console
# Install and activate the right version of Node
nvm install
nvm use

# Install all dependencies
yarn install
```

### Environment Variables

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Key variables to configure:

```env
# Server
PORT=3010

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scratchpad?schema=public"

# Service Type (FRONTEND, WORKER, CRON, or MONOLITH)
SERVICE_TYPE=MONOLITH
```

Some values require reaching out to team members or checking 1Password.

### Set Up the Database

Start Docker services (PostgreSQL, Redis):

```console
docker compose -f localdev/docker-compose.yml up -d
```

Install PostgreSQL tools (first time only):

```console
brew install libpq
brew link --force libpq
```

Then you can create a database called 'scratchpad':

```console
createdb -h localhost -p 5432 -U postgres scratchpad
# Password: postgres
```

Run migrations:

```console
yarn run migrate
```

### Create an OpenRouter Account

The agent server uses OpenRouter for LLM access:

1. Create account at [OpenRouter.ai](https://openrouter.ai/)
2. Get provisioning key from [Provisioning Keys](https://openrouter.ai/settings/provisioning-keys)
3. Set `OPENROUTER_PROVISIONING_KEY` in `.env`
4. Create API key from [API keys](https://openrouter.ai/settings/keys)

### Start the Server

```bash
yarn run start:dev
```

### Create Admin Account

1. Go to http://localhost:3000 and create an account
2. Update your user's `role` in the database to `ADMIN` for dev tools access

## Available Commands

```bash
# Development with watch mode
yarn run start:dev

# Build for production
yarn run build

# Run production build
yarn run start:prod

# Run database migrations
yarn run migrate

# Generate Prisma client
yarn run prisma:generate
```

## OpenRouter Management

Scratch uses OpenRouter.ai for LLM access. Each user has a scoped API key (user-provided or auto-provisioned).

### Production

1. Log in at [OpenRouter](https://openrouter.ai/) with Google SSO
2. Switch to Whalesync organization
3. View API keys and usage

### Test & Staging

1. Log in with Google SSO
2. Switch to Whalesync-Test organization
3. Credentials in 1Password (team@whalesync.com)

## Feature Flags

Feature flags are managed in [ExperimentsService](./src/experiments/experiments.service.ts) using [OpenFeature](https://openfeature.dev/) with PostHog as the provider.

- **Test**: [Test Feature Flags](https://us.posthog.com/project/225935/feature_flags?tab=overview)
- **Production**: [Production Feature Flags](https://us.posthog.com/project/214130/feature_flags?tab=overview)

**Important**: Do not set `Persist flag across authentication steps` on PostHog - this will cause FlagNotFoundError.

### Integration Tests

The integration tests run against the test environment by default at https://test.scratch.md. You need a Clerk user ID to run them. The tests will expect the account to have at least one snapshot with at least one table existing already, and will fail if they aren't found.

```
INTEGRATION_TEST_USER_ID=user_xxx yarn run test:integration --verbose
```

You can run them against your local dev stack by setting the hostnames for the services in environment variables. You can create a .env.integration file by copying `.env.integration.example` and adding your local user's clerkId.

```
cp .env.integration.example .env.integration
# edit .env.integration
yarn run test:integration --verbose
```

NOTE: These tests rely on Jest running the cases inside a single describe block in order. When debugging via VS Code, sometimes they seem to execute out of order, regardless of how Jest is configured.

## Stripe Integration

Stripe handles payments via hosted portals and webhooks. See [PaymentModule](src/payment/) for implementation details.

### Testing Stripe Locally

1. **Start ngrok**: `ngrok http 3010`

2. **Register webhook** in [Stripe Dashboard](https://dashboard.stripe.com/) (Test sandbox):
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
   - Endpoint: `https://YOUR_NGROK.ngrok-free.app/payment/webhook`
   - Copy signing secret

3. **Update `.env`**:

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_API_KEY=sk_test_...
   ```

4. **Restart server**

## Additional Resources

Each module contains its own README with detailed documentation:

- Architecture and design
- API endpoints
- Integration points
- Configuration options
- Use cases

Explore the [src/](src/) directory to learn about specific modules.

---

## Architecture Overview

The Scratch server is a modular NestJS application built with a microservice-oriented architecture. It can run as a monolith for local development or as separate services (frontend API, worker, cron) in production.

### Core Concepts

**Snapshots**: Local workspaces that store copies of data from external services, allowing users to view, edit, and publish changes back to the source systems.

**Connectors**: Integrations with external services (Airtable, Notion, Webflow, etc.) that enable bidirectional data synchronization.

**AI-Powered**: Custom connector builder using AI to generate integration code, and AI agents that can operate on snapshot data.

**Real-time**: WebSocket and SSE support for live updates, Redis pub/sub for multi-instance coordination.

## Module Structure

The server is organized into focused modules, each with its own README:

### Foundation Modules

- **[config](src/config/)**: Centralized configuration management with environment-specific settings
- **[db](src/db/)**: Database abstraction layer with Prisma ORM and Knex query builder
- **[types](src/types/)**: Core type definitions for IDs, error handling, and progress tracking
- **[utils](src/utils/)**: Shared utility functions (encryption, CSV streaming, duration, validation)

### Authentication & Authorization

- **[auth](src/auth/)**: Multi-strategy authentication (Clerk JWT, API tokens, agent tokens)
- **[clerk](src/clerk/)**: Clerk identity provider integration
- **[agent-jwt](src/agent-jwt/)**: JWT generation for AI agents

### User Management

- **[users](src/users/)**: User lifecycle, API tokens, and session management
- **[payment](src/payment/)**: Stripe integration for subscriptions and billing
- **[audit](src/audit/)**: Comprehensive event tracking and audit logging

### Data Management

- **[snapshot](src/workbook/)**: Core workspace module for data viewing and editing
- **[uploads](src/uploads/)**: CSV and Markdown file ingestion and storage
- **[style-guide](src/style-guide/)**: Reference document management

### External Integrations

- **[remote-service](src/remote-service/)**: Connector abstraction layer for external services
- **[oauth](src/oauth/)**: OAuth 2.0 flow management for third-party services

### Background Processing

- **[worker](src/worker/)**: Job queue and execution system with BullMQ and Piscina
- **[worker-enqueuer](src/worker-enqueuer/)**: Job queueing service for background tasks
- **[job](src/job/)**: Job lifecycle management and monitoring
- **[cron](src/cron/)**: Scheduled task execution

### AI & Analytics

- **[ai](src/ai/)**: Google Gemini integration for AI-powered features
- **[ai-agent-token-usage](src/ai-agent-token-usage/)**: AI token consumption tracking
- **[agent-session](src/agent-session/)**: Persistent agent session management
- **[openrouter](src/openrouter/)**: OpenRouter API key provisioning and management
- **[posthog](src/posthog/)**: Product analytics and event tracking
- **[experiments](src/experiments/)**: Feature flag management with OpenFeature

### Infrastructure

- **[redis](src/redis/)**: Pub/sub messaging for real-time events
- **[slack](src/slack/)**: Developer notification system
- **[admin](src/admin/)**: Health check and server info endpoints
- **[dev-tools](src/dev-tools/)**: Administrative tools for support and debugging

### Cross-Cutting Concerns

- **[interceptors](src/interceptors/)**: Request logging and middleware
- **[exception-filters](src/exception-filters/)**: Global error handling
- **[wrappers](src/wrappers/)**: External library abstractions
- **[mentions](src/mentions/)**: Search and autocomplete functionality

## Data Flow

### Typical Workflow

1. **User Authentication**: User signs in via Clerk, receives JWT and API tokens
2. **Connector Setup**: User configures connectors to external services (OAuth or API key)
3. **Snapshot Creation**: User creates a snapshot with tables from one or more connectors
4. **Data Download**: Background job fetches data from external services into snapshot schema
5. **Local Editing**: User views and edits data locally, AI suggests improvements
6. **Publishing**: User publishes changes back to external services

### Real-time Updates

- Changes broadcast via Redis pub/sub
- WebSocket gateway pushes updates to connected clients
- SSE provides progress updates for long-running operations
- Multiple server instances coordinate through Redis

## Microservice Architecture

The application supports different service types via the `SERVICE_TYPE` environment variable:

- **FRONTEND**: API server handling HTTP requests
- **WORKER**: Background job processor
- **CRON**: Scheduled task runner
- **MONOLITH**: All services combined (for local development)

This allows horizontal scaling of different concerns in production while maintaining simplicity in development.

## Technology Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: BullMQ with Redis
- **Real-time**: Socket.io for WebSocket, Redis Pub/Sub
- **Authentication**: Clerk for identity, Passport for strategies
- **Payment**: Stripe for subscriptions
- **AI**: Google Gemini and OpenRouter
- **Analytics**: PostHog
- **Feature Flags**: OpenFeature with PostHog provider

---
