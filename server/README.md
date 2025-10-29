# Scratchpad Server

The NestJS backend for the Scratch application.

## Available Yarn Commands

#### Run in development mode with watch

```bash
yarn run start:dev
```

#### Builds a optimized version for production

```bash
yarn run build
```

#### Starts the optimized version built with `yarn run build`

```bash
yarn run start:prod
```

## Set up

### Install node and dependencies

To get your environment set up, from this directory, run:

```console
# Install and activate the right version of Node
nvm install
nvm use

# Install all of the dependencies:
yarn install
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

### Set up the database

Our docker image has a postgres DB, redis, and MongoDB in it. You'll have to start it after every reboot:

```console
docker compose -f localdev/docker-compose.yml up -d
```

First time only, you'll need to create a postgres database. For this you'll need to install the postgres tools:

```console
brew install libpq
brew link --force libpq
```

Then you'll need an `.env` and conveniently you can just use the sample one: `cp .env.example .env`

Then you can create a database called 'scratchpad':

```console
createdb -h localhost -p 5432 -U postgres scratchpad
```

For the password, use `postgres`.

To update the database's schema to match the code's current state:

```console
yarn run migrate
```

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

## OpenRouter

Scratch utilizes OpenRouter.ai for interfacing with different LLMs. Every request through the agent utilizes an OpenRouter API key scoped to the user making the request. These keys can be provided by the user as Agent Credentials OR they can be provisioned by Scratch automatically at signup.

Each Scratch server has access to a Provisioning Key which allows it to create API keys for users inside our OpenRouter.ai account.

### Managing OpenRouter

There are two management accounts for [OpenRouter](https://openrouter.ai/), one for Production use and one for dev/test use. OpenRouter.ai doesn not support environments natively so we need to access them separately.

#### Production

1. Go to [OpenRouter](https://openrouter.ai/)
1. Login with your Google SSO, i.e. chris@whalesync.com account
1. Switch to the Whalesync organization to see api keys and usage

NOTE: This is the official Whalesync account and has payments linked to it.

#### Test & Staging

1. Go to [OpenRouter](https://openrouter.ai/)
1. Login with your Google SSO, i.e. chris@whalesync.com account
1. Switch to the Whalesync-Test organization
   1. Ask Chris or Ryder for an invite if you don't see it

This organization is owned by an account linked to the team@whalesync.com email address. Creds are in 1Password

## Feature Flags

Feature flags are managed inside of the [ExperimentsService](./src/experiments/experiments.service.ts) and utilize [OpenFeature](https://openfeature.dev/), a vendor agnostic feature flag SDK.

The feature flag configurations are provided via PostHog, using the same projects that are used for analytics:

[Test Feature Flags](https://us.posthog.com/project/225935/feature_flags?tab=overview)

[Production Feature Flags](https://us.posthog.com/project/214130/feature_flags?tab=overview)
