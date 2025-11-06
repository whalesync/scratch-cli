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

When creating new flags on Posthog **do not** set the `Persist flag across authentication steps` setting for flags. This setting depends on a Posthog feature we are not using and will cause your feature flag to return "FlagNotFoundError" in the system and subsequently return a default value if provided.

## Stripe

Scratch uses Stripe to handle payments and subscriptions via Stripes hosted customer portals and webhooks. The code for this integration and subscriptions is in the [PaymentModule](src/payment/)

- StripePaymentService - handles all the integration with Stripe and processes webhook payloads
- StripeController - contains the Rest API and the webhook endpoint
- `plans.ts` - describes the products in the system
  - The `ScratchpadPlanType` defines the internal unique identifiers for the different plans
  - Each deployment environment has it's own set of plans, with specific stripe product and price IDs

### Testing

To test stripe locally you need to do some additional setup

#### 1. Start `ngrok` for your server (or other tunnel service)

```cmd
ngrok http 3010
```

#### 2. Register a webhook in the **Scratch - Test** Sandbox

1. Got to the [Stripe Dashboard](https://dashboard.stripe.com/)
1. enter sandbox
1. Search for webhooks in the search box at the top and select the Webhooks option from the Workbench session
1. Click on **+ Add destination** to create a new destination
   1. Select "Your account"
   1. Include the following events:
      - checkout.session.completed
      - customer.subscription.created
      - customer.subscription.deleted
      - customer.subscription.updated
      - invoice.paid
      - invoice.payment_failed
   1. Set the endpoint to your ngrok host with the `/payment/webhook` path
   - i.e. https://cafea40927f9.ngrok-free.app/payment/webhook
   1. Copy the signing secret

#### Update your `server/.env`

Set the `STRIPE_WEBHOOK_SECRET` and `STRIPE_API_KEY` with the secret from step 2 and the API key for the **Scratch - Test** Sandbox

#### Restart your server

At this point your local environment can interact with the sandbox account and recieve webhooks, you should be able to go through a full payment workflow.
