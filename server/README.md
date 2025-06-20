# Scratchpad Server

The NestJS backend for Scratchpad.

## Install Dependencies

Install initial dependencies.

```bash
yarn install
```

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

### Run tests

```bash
yarn run test
```

## Environment Variables

Create a `.env` file in the root directory by copying `example.env`.

Tweak the following values as necessary:

```
# The port the server will run on
PORT=3001

# The connection string for the PostgreSQL database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scratchpad?schema=public"
```

## Hosting

The Scratchpad server is hosted on Render.

[Public URL - https://scratchpad-server.onrender.com/](https://scratchpad-server.onrender.com/)

[Manage Render Project](https://dashboard.render.com/web/srv-d1a84295pdvs73aisifg)
- Owned by team@whalesync.com (Credentials in 1password)


## Stack

### Nest.js

The server is built using [NestJS](https://nestjs.com/).

