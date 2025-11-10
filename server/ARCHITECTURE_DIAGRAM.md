# Scratch Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Clerk SSO  │  Stripe  │  PostHog  │ Airtable │ Notion │ Webflow │ Wix ...  │
└──────┬──────┴────┬─────┴─────┬─────┴────┬─────┴────┬───┴────┬────┴──────┬───┘
       │           │           │          │          │        │           │
       │ OAuth/JWT │  Webhooks │ Events   │          └────────┴───────────┘
       │           │           │          │            API Calls
       │           │           │          │       (fetch connector data)
       │           │           │          │                   │
┌──────▼───────────┼───────────┼──────────┼───────────────────┼─────────────┐
│                  │           │          │                   │             │
│                  CLIENT (Next.js - Vercel)                                │
│                           http://localhost:3000                           │
├───────────────────────────────────────────────────────────────────────────┤
│  UI Layer (React 19 + Mantine UI)                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Workspace │ │ Tables   │ │ AI Chat  │ │Connectors│ │ Settings │         │
│  │  View    │ │ Editor   │ │  View    │ │  Config  │ │  & Sub   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                           │
│  State Management (Zustand) + Data Fetching (SWR)                         │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │  Real-Time Updates: Socket.io Client, WebSocket connections      │     │
│  └──────────────────────────────────────────────────────────────────┘     │
└──────┬─────────────────────────────┬───────────────────────────────┬──────┘
       │ REST API (fetch)            │ WebSocket (live updates)      │
       │ JWT in Authorization header │ Socket.io                     │ WebSocket
       │                             │                               │ (AI Chat)
┌──────▼─────────────────────────────▼───────────────────────────────▼──────┐
│                 SERVER (NestJS + Node.js - Render)                        │
│                        http://localhost:3010                              │
├──────▲─────────────────────▲─────────▲───────────────────────────▲────────┤
       │                     │         │                           │
       │ Webhooks            │ Events  │       API Calls           │
       │ (Stripe, etc.)      │(PostHog)│    (to connectors)        │
       └─────────────────────┴─────────┴───────────────────────────┘
│                                                                           │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     API LAYER (Controllers)                          │ │
│  │  /snapshot │ /users │ /connectors │ /auth │ /payment │ /admin        │ │
│  └────────────┬─────────────────────────────────────────────────────────┘ │
│               │                                                           │
│  ┌────────────▼─────────────────────────────────────────────────────────┐ │
│  │               AUTHENTICATION & AUTHORIZATION                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │ │
│  │  │   auth   │  │  clerk   │  │agent-jwt │  │ WebSocket Guard  │      │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│               │                                                           │
│  ┌────────────▼─────────────────────────────────────────────────────────┐ │
│  │                      CORE BUSINESS LOGIC                             │ │
│  │                                                                      │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │                    snapshot (Central Hub)                     │   │ │
│  │  │  • Create/manage workspaces                                   │   │ │
│  │  │  • Add/remove tables                                          │   │ │
│  │  │  • Download data (job creation)                               │   │ │
│  │  │  • Record CRUD operations                                     │   │ │
│  │  │  • Publish changes back to sources                            │   │ │
│  │  │  • WebSocket Gateway (live table updates)                     │   │ │
│  │  └──────┬─────────────────────────────────┬──────────────────────┘   │ │
│  │         │                                 │                          │ │
│  │  ┌──────▼──────┐  ┌──────────┐  ┌─────────▼──────────┐               │ │
│  │  │   uploads   │  │  users   │  │  connector-account │               │ │
│  │  │ (CSV/MD)    │  │          │  │   (credentials)    │               │ │
│  │  └─────────────┘  └──────────┘  └────────────────────┘               │ │
│  │                                                                      │ │
│  │  ┌────────────────────────────────────────────────────────────────┐  │ │
│  │  │           DATA CONNECTOR LAYER                                 │  │ │
│  │  │  ┌──────────────┐    ┌──────────────────────────────────────┐  │  │ │
│  │  │  │remote-service│───▶│         connectors                   │  │  │ │
│  │  │  │(abstraction) │    │ Airtable│Notion│Webflow│Wix│YouTube  │  │  │ │
│  │  │  └──────────────┘    │ WordPress│PostgreSQL│CSV ...         │  │  │ │
│  │  │                      └──────────────────────────────────────┘  │  │ │
│  │  │  ┌───────────────────┐   ┌─────────────────────────────────┐   │  │ │
│  │  │  │custom-connector   │   │ custom-connector-builder        │   │  │ │
│  │  │  │(user-defined)     │   │ (AI code generation)            │   │  │ │
│  │  │  └───────────────────┘   └─────────────────────────────────┘   │  │ │
│  │  │  ┌───────┐                                                     │  │ │
│  │  │  │ oauth │ (OAuth 2.0 flow management)                         │  │ │
│  │  │  └───────┘                                                     │  │ │
│  │  └────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│               │                                                           │
│  ┌────────────▼─────────────────────────────────────────────────────────┐ │
│  │                   BACKGROUND PROCESSING LAYER                        │ │
│  │                                                                      │ │
│  │  ┌────────────────┐       ┌────────────────────────────────────┐     │ │
│  │  │worker-enqueuer │──────▶│          worker                    │     │ │
│  │  │(job creation)  │       │  • BullMQ + Piscina thread pool    │     │ │
│  │  └────────────────┘       │  • download-records job            │     │ │
│  │                           │  • Progress tracking via SSE       │     │ │
│  │  ┌────────────────┐       │  • Graceful cancellation           │     │ │
│  │  │      job       │       └────────────────────────────────────┘     │ │
│  │  │(lifecycle mgmt)│       ┌────────────────────────────────────┐     │ │
│  │  └────────────────┘       │          cron                      │     │ │
│  │                           │  • Scheduled task execution        │     │ │
│  │                           └────────────────────────────────────┘     │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│               │                                                           │
│  ┌────────────▼─────────────────────────────────────────────────────────┐ │
│  │                      AI & ANALYTICS LAYER                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐      │ │
│  │  │     ai       │  │ openrouter   │  │  agent-session         │      │ │
│  │  │  (Gemini)    │  │(API key mgmt)│  │  (persistent context)  │      │ │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘      │ │
│  │  ┌──────────────────────────────┐  ┌──────────────────────────┐      │ │
│  │  │ ai-agent-token-usage         │  │  experiments             │      │ │
│  │  │ (token tracking)             │  │  (feature flags)         │      │ │
│  │  └──────────────────────────────┘  └──────────────────────────┘      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│               │                                                           │
│  ┌────────────▼─────────────────────────────────────────────────────────┐ │
│  │                    INFRASTRUCTURE LAYER                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │  config  │  │   db     │  │  redis   │  │  audit   │              │ │
│  │  │          │  │(Prisma)  │  │ (pub/sub)│  │  (logs)  │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                            │ │
│  │  │  types   │  │  utils   │  │  slack   │                            │ │
│  │  └──────────┘  └──────────┘  └──────────┘                            │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Service Type Configuration: FRONTEND | WORKER | CRON | MONOLITH          │
└──────┬──────────────────────────────┬──────────────────────────┬──────────┘
       │                              │                          │
       │                              │                          │
       │ API Calls                    │ Redis (pub/sub)          │ PostgreSQL
       │ (fetch snapshot context)     │ (coordination)           │ (shared state)
       │                              │                          │
┌──────▼──────────────────────────────▼──────────────────────────▼──────────┐
│              AI AGENT (FastAPI + Pydantic AI - Render)                    │
│                        http://localhost:8000                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    WebSocket Handler                                 │ │
│  │              /ws/{session_id} (real-time chat)                       │ │
│  └────────────────────────┬─────────────────────────────────────────────┘ │
│                           │                                               │
│  ┌────────────────────────▼─────────────────────────────────────────────┐ │
│  │                    Chat Service                                      │ │
│  │  • Message routing                                                   │ │
│  │  • Session management (auto-cleanup)                                 │ │
│  │  • LLM orchestration                                                 │ │
│  └────────────────────────┬─────────────────────────────────────────────┘ │
│                           │                                               │
│  ┌────────────────────────▼─────────────────────────────────────────────┐ │
│  │                Pydantic AI Agent (Data Operations)                   │ │
│  │                                                                      │ │
│  │  Tool Suite:                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ • fetch_records_tool          • update_records_tool             │ │ │
│  │  │ • add_column_tool             • insert_value_tool               │ │ │
│  │  │ • search_and_replace_field_value_tool                           │ │ │
│  │  │ • fetch_additional_records_tool                                 │ │ │
│  │  │ • upload_content_tool         • url_content_load_tool           │ │ │
│  │  │ • View tools (filtering, sorting)                               │ │ │
│  │  │ • Record fetch by ID                                            │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │          Connector Builder (AI Code Generation)              │    │ │
│  │  │  • Generate CRUD operation functions                         │    │ │
│  │  │  • Schema generation and testing                             │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  External: OpenRouter API (multi-LLM access)                              │
└──────┬───────────────────────────────────────────────────────────────┬────┘
       │                                                               │
       │                                                               │
┌──────▼───────────────────────────────────────────────────────────────▼────┐
│                          DATA & CACHE LAYER                               │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │     PostgreSQL (Cloud SQL)      │  │     Redis (Memorystore)        │  │
│  │  • Users, Snapshots, Tables     │  │  • Pub/Sub messaging           │  │
│  │  • Connector accounts & creds   │  │  • BullMQ job queue            │  │
│  │  • Custom connectors            │  │  • Caching                     │  │
│  │  • Jobs, Uploads, Audit logs    │  │  • Session storage             │  │
│  │  • Billing & subscriptions      │  │  • Cancellation signals        │  │
│  │  • AI credentials & usage       │  │                                │  │
│  └─────────────────────────────────┘  └────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘


                          ┌────────────────────────┐
                          │   INFRASTRUCTURE       │
                          │    (Terraform)         │
                          ├────────────────────────┤
                          │ • GCP VPC              │
                          │ • Cloud SQL            │
                          │ • Memorystore Redis    │
                          │ • IAM & Service Accts  │
                          │ • Cloud Run LB         │
                          └────────────────────────┘

                          ┌────────────────────────┐
                          │      CI/CD             │
                          │   (GitLab CI)          │
                          ├────────────────────────┤
                          │ master → daily deploy  │
                          │ prod branch            │
                          │ • Build & Test         │
                          │ • Migrations           │
                          │ • Deploy to Render     │
                          │ • Deploy to Vercel     │
                          └────────────────────────┘
```

## Data Flow Sequence Diagrams

### 1. User Authentication Flow

```
User              Client           Server           Clerk
  │                 │                 │                │
  │──Sign In───────▶│                 │                │
  │                 │───Google SSO───▶│                │
  │                 │                 │───Validate────▶│
  │                 │                 │◀──JWT Token────│
  │                 │◀──JWT Token─────│                │
  │◀──Success───────│                 │                │
  │                 │                 │                │
  │──API Request───▶│──+ JWT Header──▶│                │
  │                 │                 │───Verify JWT──▶│
  │                 │                 │◀──Valid────────│
  │                 │◀──Response──────│                │
  │◀──Data──────────│                 │                │
```

### 2. Snapshot Data Download Flow

```
User    Client    Server    Worker    Redis    PostgreSQL    Connector
 │        │         │         │         │          │             │
 │─Create Snapshot─▶│         │         │          │             │
 │        │         │─Save────────────────────────▶│             │
 │◀──Success────────│         │         │          │             │
 │        │         │         │         │          │             │
 │──Add Table──────▶│         │         │          │             │
 │        │         │─Save────────────────────────▶│             │
 │◀──Success────────│         │         │          │             │
 │        │         │         │         │          │             │
 │──Download Data──▶│         │         │          │             │
 │        │         │─Create Job──────────────────▶│             │
 │        │         │─Enqueue Job─────▶│           │             │
 │        │         │         │        │           │             │
 │        │         │         │◀──Pull Job─────────│             │
 │        │         │         │         │          │             │
 │        │         │         │──Fetch Data─────────────────────▶│
 │        │         │         │◀──Records────────────────────────│
 │        │         │         │         │          │             │
 │        │         │         │─Upsert Records──────────────────▶│
 │        │         │         │         │          │             │
 │        │         │         │─Publish Progress──▶│             │
 │        │◀──SSE Progress─────────────────────────│             │
 │◀──Progress───────│         │         │          │             │
 │        │         │         │         │          │             │
 │        │         │         │─Complete Job────────────────────▶│
 │◀──Complete───────│         │         │          │             │
```

### 3. Real-Time Collaboration Flow

```
User A   Client A   Server   Redis   Client B   User B
  │         │         │        │        │         │
  │──Edit Record─────▶│        │        │         │
  │         │         │─Save──────────▶ │         │
  │         │         │        │        │         │
  │         │         │─Publish────────▶│         │
  │         │         │        │───Broadcast─────▶│
  │         │         │        │        │         │
  │         │◀──WebSocket Update────────│         │
  │◀──Live Update─────│        │        │         │
  │         │         │        │        │◀──Live Update
  │         │         │        │        │         │
```

### 4. AI Agent Interaction Flow

```
User   Client   Server   Agent   OpenRouter   PostgreSQL
  │       │       │        │          │            │
  │──Open Chat───▶│        │          │            │
  │       │       │        │          │            │
  │       │───WebSocket Connect──────▶│            │
  │       │       │        │          │            │
  │─Send Message─▶│        │          │            │
  │       │───────────WS──▶│          │            │
  │       │       │        │          │            │
  │       │       │        │──Fetch Context───────▶│
  │       │       │        │◀──Snapshot Data───────│
  │       │       │        │          │            │
  │       │       │        │──LLM Request─────────▶│
  │       │       │        │◀──Response────────────│
  │       │       │        │          │            │
  │       │       │        │──Call Tool (fetch_records)
  │       │       │        │──────────────────────▶│
  │       │       │        │◀──Record Data─────────│
  │       │       │        │          │            │
  │       │       │        │──Call Tool (update_records)
  │       │       │        │──────────────────────▶│
  │       │       │        │          │            │
  │       │       │        │──LLM Request─────────▶│
  │       │       │        │◀──Final Response──────│
  │       │       │        │          │            │
  │       │◀──Stream Response─────────│            │
  │◀──AI Response─│        │          │            │
  │       │       │        │          │            │
  │       │◀──WebSocket Live Update────────────────│
  │◀─Table Update─│        │          │            │
```

## Module Dependency Graph (Server)

```
                                    ┌─────────┐
                                    │   app   │
                                    │  module │
                                    └────┬────┘
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            │                            │                            │
     ┌──────▼──────┐            ┌────────▼────────┐          ┌────────▼───────┐
     │   config    │            │  interceptors   │          │ exception-     │
     │             │            │  & middleware   │          │  filters       │
     └──────┬──────┘            └─────────────────┘          └────────────────┘
            │
            │ (used by all modules)
            │
┌───────────▼────────────────────────────────────────────────────────────────┐
│                         Foundation Layer                                   │
├────────────┬────────────┬────────────┬────────────┬────────────────────────┤
│   types    │   utils    │     db     │   redis    │      wrappers          │
│            │            │  (Prisma)  │  (pub/sub) │                        │
└────────────┴────────────┴────────────┴────────────┴────────────────────────┘
            │                    │           │
            │                    │           │
┌───────────▼────────────────────▼───────────▼───────────────────────────────┐
│                         Authentication Layer                               │
├────────────┬────────────┬────────────┬───────────────────────────┬─────────┤
│   auth     │   clerk    │ agent-jwt  │   WebSocket Auth Guard    │  oauth  │
└────────────┴────────────┴────────────┴───────────────────────────┴─────────┘
            │                    │
            │                    │
┌───────────▼────────────────────▼───────────────────────────────────────────┐
│                         User Management Layer                              │
├────────────┬────────────┬────────────┬─────────────────────────────────────┤
│   users    │  payment   │   audit    │         posthog                     │
│            │  (Stripe)  │            │                                     │
└────────────┴────────────┴────────────┴─────────────────────────────────────┘
            │                    │
            │                    │
┌───────────▼────────────────────▼───────────────────────────────────────────┐
│                         Core Business Logic Layer                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         snapshot (CENTRAL HUB)                       │  │
│  │              • Workspace management • Table CRUD                     │  │
│  │              • Download orchestration • Record updates               │  │
│  │              • Publish to sources • WebSocket Gateway                │  │
│  └────┬────────────────┬────────────────┬──────────────────┬────────────┘  │
│       │                │                │                  │               │
│  ┌────▼─────┐   ┌──────▼─────────┐  ┌────▼────────┐  ┌─────▼──────────┐    │
│  │ uploads  │   │ connector-     │  │   style-    │  │   mentions     │    │
│  │ (CSV/MD) │   │   account      │  │   guide     │  │   (search)     │    │
│  └──────────┘   └────────────────┘  └─────────────┘  └────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
            │
            │
┌───────────▼────────────────────────────────────────────────────────────────┐
│                         Connector Layer                                    │
│                                                                            │
│  ┌─────────────────┐        ┌──────────────────────────────────────────┐   │
│  │ remote-service  │───────▶│            connectors                    │   │
│  │  (abstraction)  │        │  Airtable │ Notion │ Webflow │ Wix       │   │
│  └─────────────────┘        │  YouTube │ WordPress │ PostgreSQL │ CSV  │   │
│                             └──────────────────────────────────────────┘   │
│  ┌──────────────────┐       ┌─────────────────────────────────────────┐    │
│  │ custom-connector │       │  custom-connector-builder               │    │
│  │  (user-defined)  │       │     (AI code generation)                │    │
│  └──────────────────┘       └─────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
            │
            │
┌───────────▼────────────────────────────────────────────────────────────────┐
│                         Background Processing Layer                        │
├────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│worker-enqueuer │     worker      │      job        │        cron           │
│                │   (BullMQ +     │  (lifecycle)    │    (scheduled)        │
│                │    Piscina)     │                 │                       │
└────────────────┴─────────────────┴─────────────────┴───────────────────────┘
            │
            │
┌───────────▼────────────────────────────────────────────────────────────────┐
│                         AI & Analytics Layer                               │
├────────────┬──────────────┬──────────────────┬─────────────────────────────┤
│     ai     │ openrouter   │  agent-session   │  ai-agent-token-usage       │
│  (Gemini)  │ (API keys)   │   (context)      │     (tracking)              │
├────────────┴──────────────┴──────────────────┴─────────────────────────────┤
│                    experiments (feature flags)                             │
└────────────────────────────────────────────────────────────────────────────┘
            │
            │
┌───────────▼────────────────────────────────────────────────────────────────┐
│                         Support & Admin Layer                              │
├────────────┬────────────┬──────────────────────────────────────────────────┤
│   admin    │ dev-tools  │              slack                               │
│ (health)   │  (support) │        (notifications)                           │
└────────────┴────────────┴──────────────────────────────────────────────────┘
```

## Technology Stack by Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 15 (App Router) • React 19 • TypeScript 5              │
│  Mantine UI • AG-Grid • Glide Data Grid                         │
│  Zustand (state) • SWR (data fetching)                          │
│  Socket.io Client • Clerk Auth • PostHog                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  NestJS • Node.js 22 • TypeScript • Express                     │
│  Socket.io Server • Passport.js                                 │
│  BullMQ • Piscina (workers)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AI ORCHESTRATION LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI • Python 3 • Pydantic AI                               │
│  OpenRouter • Logfire                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Database/Cache
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma ORM + Knex)                                 │
│  Redis (pub/sub, queue, cache)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Infrastructure
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  Terraform • GCP (Cloud SQL, Memorystore, VPC)                  │
│  Render (API/Agent hosting) • Vercel (Client hosting)           │
│  GitLab CI (pipelines) • Docker                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            PRODUCTION                                │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐
│   Vercel CDN    │         │  Render (API)   │         │ Render (AI)  │
│                 │         │                 │         │              │
│  Next.js Client │────────▶│  NestJS Server  │────────▶│ FastAPI      │
│  (Static + SSR) │         │  • FRONTEND     │         │ Agent        │
│                 │         │  • WORKER       │         │              │
│  Port: 443      │         │  • CRON         │         │ Port: 8000   │
└─────────────────┘         │                 │         └──────────────┘
         │                  │  Port: 3010     │                │
         │                  └─────────────────┘                │
         │                           │                         │
         └───────────────────────────┼─────────────────────────┘
                                     │
                 ┌───────────────────┼──────────────────┐
                 │                   │                  │
         ┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼────────┐
         │  Cloud SQL     │  │  Memorystore   │  │  External     │
         │  (PostgreSQL)  │  │  (Redis)       │  │  Services     │
         │                │  │                │  │               │
         │  GCP           │  │  GCP           │  │  • Clerk      │
         └────────────────┘  └────────────────┘  │  • Stripe     │
                                                 │  • PostHog    │
                                                 │  • Connectors │
                                                 └───────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT                                │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐
│  localhost:3000 │────────▶│ localhost:3010  │────────▶│localhost:8000│
│                 │         │                 │         │              │
│  Next.js Dev    │         │  NestJS Dev     │         │ FastAPI Dev  │
│  Server         │         │  (MONOLITH)     │         │ Server       │
└─────────────────┘         └─────────────────┘         └──────────────┘
         │                           │                         │
         └───────────────────────────┼─────────────────────────┘
                                     │
                 ┌───────────────────┤
                 │                   │
         ┌───────▼────────┐  ┌───────▼────────┐
         │  PostgreSQL    │  │     Redis      │
         │  (Docker)      │  │   (Docker)     │
         │                │  │                │
         │  Port: 5432    │  │   Port: 6379   │
         └────────────────┘  └────────────────┘
```

## Key Integration Points

```
┌────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICE INTEGRATIONS                    │
└────────────────────────────────────────────────────────────────────┘

Authentication & Identity
├─ Clerk: Google SSO, JWT tokens, user management
└─ Passport.js: Multi-strategy auth (JWT, API key, custom)

Payment & Billing
└─ Stripe: Subscriptions, invoices, webhooks

AI & LLM
├─ OpenRouter: Multi-LLM access (Claude, GPT, etc.)
├─ Google Gemini: Specific AI features
└─ Logfire: Observability and logging

Analytics & Feature Flags
├─ PostHog: Product analytics + Feature flags (OpenFeature)
└─ Custom analytics: Token usage tracking

Data Sources (Connectors)
├─ Airtable: Full CRUD via REST API
├─ Notion: Database sync via official API
├─ Webflow: CMS items via API
├─ Wix Blog: Blog posts via API
├─ YouTube: Channel/video data via API
├─ WordPress: Posts via REST API
├─ PostgreSQL: Direct database connection
├─ CSV: File-based data import
└─ Custom: User-defined via AI code generation

Notifications & Monitoring
├─ Slack: Developer alerts and notifications
└─ Logfire: Request tracing and monitoring

Infrastructure
├─ Vercel: Client deployment (CD on master merge)
├─ Render: API & Agent deployment (CD on prod push)
├─ GCP Cloud SQL: Managed PostgreSQL
├─ GCP Memorystore: Managed Redis
└─ Terraform: Infrastructure as Code
```
