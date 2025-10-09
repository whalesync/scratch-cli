# Scratchpad Server

The NestJS backend for Scratchpaper application.

## Available Yarn Commands

### Run in development mode with watch

```bash
yarn run start:dev
```

### Builds a optimized version for production

```bash
yarn run build
```

### Starts the optimized version built with `yarn run build`

```bash
yarn run start:prod
```

## Set up

### Install node and dependencies

To get your environment set up, from this directory, run:

```console
# Install and activate the right version of Node
$ nvm install
$ nvm use

# Install all of the dependencies:
$ yarn install
```

### Set up the database

[SEE CURRENT DB ENTITY DIAGRAM](prisma/ERD.md)

Our docker image has a postgres DB, redis, and MongoDB in it. You'll have to start it after every reboot:

```console
$ docker compose -f localdev/docker-compose.yml up -d
```

First time only, you'll need to create a postgres database. For this you'll need to install the postgres tools:

```console
$ brew install libpq
$ brew link --force libpq
```

Then you'll need an `.env` and conveniently you can just use the sample one: `cp .env.example .env`

Then you can create a database called 'scratchpad':

```console
$ createdb -h localhost -p 5432 -U postgres scratchpad
```

For the password, use `postgres`.

To update the database's schema to match the code's current state:

```console
$ yarn run prisma migrate
```

### Environment Variables

Create a `.env` file in the root directory by copying `.env.example`.

Tweak the following values as necessary:

```
# The port the server will run on
PORT=3010

# The connection string for the PostgreSQL database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scratchpad?schema=public"
```

Some values will require reaching out to other team members or checking values in 1Password.

### Create an OpenRouter account

The agent server uses OpenRouter to interact with the various LLMs. For running locally you will need an API key and a Provisioning key. The provisioning key is used to create new API keys for new users.

1. Go to [Openrouter.ai](https://openrouter.ai/) and create an account for your Whalesync email account

2. Setup a provisioning key

- Go to [Provisioning Keys](https://openrouter.ai/settings/provisioning-keys) and create a new key for your local environment.
- Set that value into `OPENROUTER_PROVISIONING_KEY` variable in your `.env` file

3. Create your own API key

- Go to [API keys](https://openrouter.ai/settings/keys)
- Create a new API key
- This can be set into your `pydantic-ai-agent/.env` file
- It can also be used by adding an Agent Credential on the Scratchpaper settings screen

### Start the Server

```bash
yarn run start:dev
```

### Admin account

Once you have started the client and server, go to http://localhost:3000 and create an account.

Once the account exists, go into your database and update the `role` of your new user record to `ADMIN` so that you have full access to dev tools locally.

## Production Hosting

The Scratchpad API server is hosted on Render.

[Public URL - https://api.scratchpaper.ai/](https://api.scratchpaper.ai/)

[Manage Render Project](https://dashboard.render.com/web/srv-d347khidbo4c73bouaj0)

- Owned by team@whalesync.com (Credentials in 1Password)

## Tech Stack

### Core Framework

- **NestJS** - Node.js framework for building scalable server-side applications
- **TypeScript** - Type-safe JavaScript with enhanced developer experience
- **Node.js** - JavaScript runtime environment

### Database & ORM

- **PostgreSQL** - Primary relational database
- **Prisma** - Type-safe database ORM with schema management
- **Knex** - SQL builder layer for interacting with snapshot databases
- **Redis** (via ioredis) - Caching and session storage

### Authentication & Authorization

- **Clerk** - User authentication and management
- **JWT** - JSON Web Tokens for API authentication
- **Passport** - Authentication middleware with custom strategies

### Real-time Communication

- **Socket.IO** - WebSocket connections for real-time features
- **NestJS WebSockets** - WebSocket gateway implementation

### Background Processing

- **BullMQ** - Redis-based job queue for background tasks
- **Piscina** - Worker thread pool for CPU-intensive tasks

### Monitoring & Logging

- **Winston** - Structured logging
- **PostHog** - Product analytics and user tracking
